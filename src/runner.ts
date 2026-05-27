import * as child_process from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CDDOutput, OpenAPI320, OperationObject, ReferenceObject } from './types';
import { isReference } from './parser';

const execFileAsync = promisify(child_process.execFile);

/**
 * Resolves the path to the cdd-ctl binary.
 * Checks the CDD_CTL_PATH environment variable, then falls back to a local './cdd-ctl'.
 * @returns The resolved path to the cdd-ctl binary.
 */
export function resolveCddCtlPath(): string {
    const cddPath = process.env['CDD_CTL_PATH'];
    if (cddPath && existsSync(cddPath)) {
        return resolve(cddPath);
    }
    const localPath = resolve(process.cwd(), 'cdd-ctl');
    if (existsSync(localPath)) {
        return localPath;
    }
    return './cdd-ctl';
}

/**
 * Parses and validates the stdout from cdd-ctl strictly into the CDDOutput interface.
 * @param stdout The raw string output from the cdd-ctl binary.
 * @returns The parsed CDDOutput object.
 * @throws Error if the output is not valid JSON or doesn't match the CDDOutput structure.
 */
export function parseCDDOutput(stdout: string): CDDOutput {
    let parsed: any;
    try {
        parsed = JSON.parse(stdout);
    } catch (e) {
        throw new Error('Failed to parse cdd-ctl output as JSON');
    }

    if (!parsed || typeof parsed !== 'object' || !parsed.endpoints || typeof parsed.endpoints !== 'object') {
        throw new Error('Invalid CDDOutput structure: missing endpoints object');
    }

    // Strict validation
    for (const path of Object.keys(parsed.endpoints)) {
        const methods = parsed.endpoints[path];
        if (!methods || typeof methods !== 'object') {
            throw new Error(`Invalid CDDOutput structure: endpoints['${path}'] must be an object`);
        }
        for (const method of Object.keys(methods)) {
            if (typeof methods[method] !== 'string') {
                throw new Error(`Invalid CDDOutput structure: endpoints['${path}']['${method}'] must be a string`);
            }
        }
    }

    return parsed as CDDOutput;
}

/**
 * Options for the cdd-ctl execution.
 */
export interface CDDRunOptions {
    /** Optional path to the cdd-ctl binary. Defaults to './cdd-ctl'. */
    cddCtlPath?: string;
    /** Whether to omit import statements in the generated code. */
    noImports?: boolean;
    /** Whether to omit function/class wrapping in the generated code. */
    noWrapping?: boolean;
}

/**
 * Executes the cdd-ctl subprocess securely.
 * @param lang The target language for the snippet.
 * @param specPath The path to the OpenAPI specification file.
 * @param options Additional options for execution.
 * @returns A promise that resolves to the stdout string from the subprocess.
 */
export async function runCddCtl(lang: string, specPath: string, options: CDDRunOptions = {}): Promise<string> {
    const cddCtlPath = options.cddCtlPath || './cdd-ctl';
    const args = [lang, 'to_docs_json', '-i', specPath];

    if (options.noImports) {
        args.push('--no-imports');
    }
    if (options.noWrapping) {
        args.push('--no-wrapping');
    }

    const { stdout } = await execFileAsync(cddCtlPath, args);
    return stdout;
}

/**
 * Generates mock fallback snippets if the cdd-ctl compiler is missing or fails.
 * @param lang The target language.
 * @param spec The OpenAPI specification object to extract endpoints from.
 * @param options The run options used (to include variant details in the mock message).
 * @returns A CDDOutput containing the mock text.
 */
export function generateMockFallback(lang: string, spec: OpenAPI320, options: CDDRunOptions = {}): CDDOutput {
    let variant = 'default';
    if (options.noImports && options.noWrapping) variant = 'noImportsNoWrapping';
    else if (options.noImports) variant = 'noImports';
    else if (options.noWrapping) variant = 'noWrapping';

    const msg = `FAILED CLI COMMAND ./cdd-ctl ${lang} (variant: ${variant})`;
    const output: CDDOutput = { endpoints: {} };

    if (!spec.paths) return output;

    for (const [route, pathItem] of Object.entries(spec.paths)) {
        if (isReference(pathItem)) continue;
        output.endpoints[route] = {};
        const methods = ['get', 'post', 'put', 'delete', 'patch'] as const;
        for (const m of methods) {
            if ((pathItem as any)[m]) {
                output.endpoints[route][m] = msg;
            }
        }
    }

    return output;
}

export const SUPPORTED_LANGUAGES = [
    'c',
    'cpp',
    'csharp',
    'go',
    'java',
    'kotlin',
    'php',
    'python-all',
    'ruby',
    'rust',
    'sh',
    'swift',
    'ts',
];

/**
 * Orchestrates generating a variant by calling runCddCtl and trapping failures gracefully to return a mock fallback.
 * @param lang The target language.
 * @param specPath The path to the spec.
 * @param spec The parsed OpenAPI spec.
 * @param options The run options.
 * @returns A promise that resolves to the parsed CDDOutput (or a mock fallback).
 */
export async function generateVariant(
    lang: string,
    specPath: string,
    spec: OpenAPI320,
    options: CDDRunOptions = {},
): Promise<CDDOutput> {
    try {
        const stdout = await runCddCtl(lang, specPath, options);
        return parseCDDOutput(stdout);
    } catch (e) {
        // Graceful fallback mocking on error
        return generateMockFallback(lang, spec, options);
    }
}

import { CodeExample } from './types';

/**
 * Generates all snippets concurrently across multiple language targets and variants.
 * @param languages The list of target languages.
 * @param specPath The path to the OpenAPI specification file.
 * @param spec The parsed OpenAPI specification object.
 * @param cddCtlPath Optional path to the cdd-ctl binary.
 * @returns A promise that resolves to an array of CodeExample objects.
 */
export async function generateAllSnippets(
    languages: string[] = SUPPORTED_LANGUAGES,
    specPath: string,
    spec: OpenAPI320,
    cddCtlPath: string = resolveCddCtlPath(),
): Promise<CodeExample[]> {
    const variants: { includeImports: boolean; includeWrapping: boolean; options: CDDRunOptions }[] = [
        { includeImports: true, includeWrapping: true, options: { cddCtlPath } },
        { includeImports: false, includeWrapping: true, options: { noImports: true, cddCtlPath } },
        { includeImports: true, includeWrapping: false, options: { noWrapping: true, cddCtlPath } },
        { includeImports: false, includeWrapping: false, options: { noImports: true, noWrapping: true, cddCtlPath } },
    ];

    const promises: Promise<CodeExample[]>[] = [];

    for (const lang of languages) {
        for (const variant of variants) {
            promises.push(
                generateVariant(lang, specPath, spec, variant.options).then(output => {
                    const examples: CodeExample[] = [];
                    for (const route of Object.keys(output.endpoints)) {
                        const methods = output.endpoints[route];
                        if (!methods) continue;
                        for (const method of Object.keys(methods)) {
                            const content = methods[method];
                            if (content === undefined) continue;
                            examples.push({
                                language: lang === 'python-all' ? 'python' : lang,
                                filepath: `${route.replace(/[^a-zA-Z0-9]/g, '_')}_${method}`,
                                content: content,
                                includeImports: variant.includeImports,
                                includeWrapping: variant.includeWrapping,
                            });
                        }
                    }
                    return examples;
                }),
            );
        }
    }

    const results = await Promise.all(promises);
    return results.flat();
}
