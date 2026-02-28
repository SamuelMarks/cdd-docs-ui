/**
 * @fileoverview Logic for running external CDD tools to generate documentation snippets.
 * Wraps child_process logic and orchestrates code generation across multiple languages.
 */
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs-extra';
import type { CLIOptions, CDDOutput, OpenAPISpec, AllExamples, VariantName } from './types';

const execPromise = util.promisify(exec);

/**
 * Mapping of supported programming languages to their respective CDD CLI tool names.
 */
export const LANGUAGES: Record<string, string> = {
    python: 'cdd_python_client',
    go: 'cdd_go',
    csharp: 'cdd_csharp',
    c: 'cdd_c',
    kotlin: 'cdd_kotlin',
    swift: 'cdd_swift',
    sh: 'cdd_sh',
    web: 'cdd_web_ng',
};

/**
 * Generates mock code examples if the specified CDD tool fails or is unavailable.
 *
 * @param inputPath - Path to the original OpenAPI specification file.
 * @param lang - The target programming language name.
 * @param variant - The targeted generation variant.
 * @returns A Promise resolving to a mocked CDDOutput structure.
 */
export async function generateMockExamples(inputPath: string, lang: string, variant: VariantName): Promise<CDDOutput> {
    const specContent = await fs.readJson(inputPath);
    const spec = specContent as OpenAPISpec;
    const examples: CDDOutput = { endpoints: {} };

    if (spec.paths) {
        for (const [path, methods] of Object.entries(spec.paths)) {
            const endpointRecord: Record<string, string> = {};
            for (const method of Object.keys(methods)) {
                endpointRecord[method] = `FAILED CLI COMMAND cdd_${lang} (variant: ${variant})`;
            }
            examples.endpoints[path] = endpointRecord;
        }
    }
    return examples;
}

/**
 * Invokes a specific CDD CLI tool to retrieve JSON-formatted code examples.
 *
 * @param lang - The target programming language name.
 * @param cmd - The CDD command string to execute.
 * @param inputPath - The path to the OpenAPI spec JSON file.
 * @param options - Additional generation flags (e.g., noImports, noWrapping).
 * @param variant - The active generation variant name (for mocking fallback).
 * @returns A Promise resolving to the parsed CDDOutput. Fallbacks to mocked output on error.
 */
export async function getCodeExamplesForLanguage(
    lang: string,
    cmd: string,
    inputPath: string,
    options: Partial<CLIOptions>,
    variant: VariantName,
): Promise<CDDOutput> {
    let command = `${cmd} to_docs_json -i ${inputPath}`;
    if (options.noImports) {
        command += ' --no-imports';
    }
    if (options.noWrapping) {
        command += ' --no-wrapping';
    }

    try {
        const { stdout } = await execPromise(command);
        return JSON.parse(stdout) as CDDOutput;
    } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        console.warn(
            `[WARN] Failed to run ${cmd} or parse output for variant ${variant}: ${error.message}. Generating mock data for ${lang}.`,
        );
        return generateMockExamples(inputPath, lang, variant);
    }
}

/**
 * Iterates through all registered LANGUAGES and collects their generated code examples for all 4 variants.
 *
 * @param inputPath - The path to the OpenAPI spec JSON file.
 * @returns A Promise resolving to a map of language names to their 4 CDDOutput variants.
 */
export async function collectAllExamples(inputPath: string): Promise<AllExamples> {
    const results: AllExamples = {};
    for (const [lang, cmd] of Object.entries(LANGUAGES)) {
        console.log(`Generating code examples for ${lang}...`);
        results[lang] = {
            default: await getCodeExamplesForLanguage(lang, cmd, inputPath, {}, 'default'),
            noImports: await getCodeExamplesForLanguage(lang, cmd, inputPath, { noImports: true }, 'noImports'),
            noWrapping: await getCodeExamplesForLanguage(lang, cmd, inputPath, { noWrapping: true }, 'noWrapping'),
            noImportsNoWrapping: await getCodeExamplesForLanguage(
                lang,
                cmd,
                inputPath,
                { noImports: true, noWrapping: true },
                'noImportsNoWrapping',
            ),
        };
    }
    return results;
}
