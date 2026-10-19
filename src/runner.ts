/**
 * Subprocess Runner and Fallback Generator for `cdd-ctl`.
 * @module runner
 */

import * as child_process from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Arazzo110, CDDOutput, CodeExample, OpenAPI320 } from './types';
import { isReference, isRecord, getPathOperations, assembleStructuredCodeSnippet } from './parser';

export { assembleStructuredCodeSnippet };

/** Promisified version of `node:child_process.execFile` for non-blocking subprocess execution. */
const execFileAsync = promisify(child_process.execFile);

/**
 * Mapping of canonical UI language identifiers to their corresponding `cdd-ctl` subcommand targets across all 13 CDD repositories.
 */
export const LANGUAGE_MAP: Readonly<Record<string, string>> = {
    c: 'c',
    cpp: 'cpp',
    csharp: 'csharp',
    go: 'go',
    java: 'java',
    kotlin: 'kotlin',
    php: 'php',
    python: 'python-all',
    'python-all': 'python-all',
    ruby: 'ruby',
    rust: 'rust',
    sh: 'sh',
    swift: 'swift',
    ts: 'ts',
    typescript: 'ts',
};

/**
 * Resolves the path to the cdd-ctl binary.
 * Checks the `CDD_CTL_PATH` environment variable, then falls back to a local `'./cdd-ctl'`.
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
 * Parses and validates the stdout from `cdd-ctl` into the `CDDOutput` interface.
 * Supports all 3 output formats emitted across the 13 `cdd-*` `to_docs_json` implementations:
 * 1. `{ endpoints: { '/path': { get: '...' } }, webhooks?: {...}, workflows?: {...} }`
 * 2. `[ { language: 'go', operations: [ { method: 'GET'|'WORKFLOW', path: '/path', operationId?: '...', code: { ... } } ] } ]`
 * 3. `{ endpoints: { '/path': { get: { default: { imports: '...', code: '...' } } } } }`
 * @param stdout The raw string output from the `cdd-ctl` binary.
 * @returns The parsed `CDDOutput` object.
 * @throws {Error} If the output is not valid JSON or doesn't match a recognized `CDDOutput` structure.
 */
export function parseCDDOutput(stdout: string): CDDOutput {
    let parsed: unknown;
    try {
        parsed = JSON.parse(stdout);
    } catch {
        throw new Error('Failed to parse cdd-ctl output as JSON');
    }

    if (Array.isArray(parsed)) {
        const endpoints: Record<string, Record<string, string>> = {};
        const workflows: Record<string, string> = {};
        let hasValidBlock = false;

        for (const block of parsed) {
            if (!isRecord(block) || !Array.isArray(block['operations'])) continue;
            hasValidBlock = true;
            for (const op of block['operations']) {
                if (!isRecord(op)) continue;
                const methodRaw = typeof op['method'] === 'string' ? op['method'] : 'get';
                const pathRaw = typeof op['path'] === 'string' ? op['path'] : '/';
                const opId = typeof op['operationId'] === 'string' ? op['operationId'] : '';
                const codeVal = op['code'];
                const snippet =
                    typeof codeVal === 'string'
                        ? codeVal
                        : isRecord(codeVal)
                          ? assembleStructuredCodeSnippet(codeVal)
                          : '';

                if (methodRaw.toUpperCase() === 'WORKFLOW' || pathRaw.startsWith('/workflows/')) {
                    const wfId = opId || pathRaw.replace(/^\/workflows\//, '') || 'workflow';
                    workflows[wfId] = snippet;
                } else {
                    const routeMap = endpoints[pathRaw] ?? {};
                    routeMap[methodRaw.toLowerCase()] = snippet;
                    endpoints[pathRaw] = routeMap;
                }
            }
        }

        if (!hasValidBlock) {
            throw new Error('Invalid CDDOutput structure: missing endpoints object');
        }

        const out: CDDOutput = { endpoints };
        if (Object.keys(workflows).length > 0) out.workflows = workflows;
        return out;
    }

    if (!isRecord(parsed) || (!isRecord(parsed['endpoints']) && !isRecord(parsed['workflows']))) {
        throw new Error('Invalid CDDOutput structure: missing endpoints object');
    }

    const endpoints: Record<string, Record<string, string>> = {};
    if (isRecord(parsed['endpoints'])) {
        for (const [pathKey, methods] of Object.entries(parsed['endpoints'])) {
            if (!isRecord(methods)) {
                throw new Error(`Invalid CDDOutput structure: endpoints['${pathKey}'] must be an object`);
            }
            const validatedMethods: Record<string, string> = {};
            for (const [methodKey, snippet] of Object.entries(methods)) {
                if (typeof snippet === 'string') {
                    validatedMethods[methodKey] = snippet;
                } else if (isRecord(snippet)) {
                    validatedMethods[methodKey] = assembleStructuredCodeSnippet(snippet);
                } else {
                    throw new Error(
                        `Invalid CDDOutput structure: endpoints['${pathKey}']['${methodKey}'] must be a string`,
                    );
                }
            }
            endpoints[pathKey] = validatedMethods;
        }
    }

    const output: CDDOutput = { endpoints };

    if (isRecord(parsed['webhooks'])) {
        const webhooks: Record<string, Record<string, string>> = {};
        for (const [whKey, methods] of Object.entries(parsed['webhooks'])) {
            if (isRecord(methods)) {
                const validatedMethods: Record<string, string> = {};
                for (const [methodKey, snippet] of Object.entries(methods)) {
                    if (typeof snippet === 'string') {
                        validatedMethods[methodKey] = snippet;
                    } else if (isRecord(snippet)) {
                        validatedMethods[methodKey] = assembleStructuredCodeSnippet(snippet);
                    }
                }
                webhooks[whKey] = validatedMethods;
            }
        }
        output.webhooks = webhooks;
    }

    if (isRecord(parsed['workflows'])) {
        const workflows: Record<string, string> = {};
        for (const [wfId, snippet] of Object.entries(parsed['workflows'])) {
            if (typeof snippet === 'string') {
                workflows[wfId] = snippet;
            } else if (isRecord(snippet)) {
                workflows[wfId] = assembleStructuredCodeSnippet(snippet);
            }
        }
        output.workflows = workflows;
    }

    return output;
}

/**
 * Options for the cdd-ctl execution.
 */
export interface CDDRunOptions {
    /** Optional path to the cdd-ctl binary. Defaults to './cdd-ctl'. */
    cddCtlPath?: string | undefined;
    /** Whether to omit import statements in the generated code. */
    noImports?: boolean | undefined;
    /** Whether to omit function/class wrapping in the generated code. */
    noWrapping?: boolean | undefined;
}

/**
 * Executes the cdd-ctl subprocess securely.
 * @param lang The target language for the snippet.
 * @param specPath The path to the OpenAPI or Arazzo specification file.
 * @param options Additional options for execution.
 * @returns A promise that resolves to the stdout string from the subprocess.
 */
export async function runCddCtl(lang: string, specPath: string, options: CDDRunOptions = {}): Promise<string> {
    const cddCtlPath = options.cddCtlPath || './cdd-ctl';
    const subcommand = LANGUAGE_MAP[lang] ?? lang;
    const args = [subcommand, 'to_docs_json', '-i', specPath];

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
 * @param arazzoSpec Optional Arazzo 1.1.0 specification object to extract workflows from.
 * @returns A CDDOutput containing the mock text.
 */
export function generateMockFallback(
    lang: string,
    spec: OpenAPI320,
    options: CDDRunOptions = {},
    arazzoSpec?: Arazzo110,
): CDDOutput {
    let variant = 'default';
    if (options.noImports && options.noWrapping) variant = 'noImportsNoWrapping';
    else if (options.noImports) variant = 'noImports';
    else if (options.noWrapping) variant = 'noWrapping';

    const msg = `FAILED CLI COMMAND ./cdd-ctl ${lang} (variant: ${variant})`;
    const output: CDDOutput = { endpoints: {} };

    if (spec.paths) {
        for (const [route, pathItem] of Object.entries(spec.paths)) {
            if (isReference(pathItem)) continue;
            const routeEndpoints: Record<string, string> = {};
            for (const [m] of getPathOperations(pathItem)) {
                routeEndpoints[m] = msg;
            }
            output.endpoints[route] = routeEndpoints;
        }
    }

    if (spec.webhooks) {
        const webhooks: Record<string, Record<string, string>> = {};
        for (const [whName, pathItem] of Object.entries(spec.webhooks)) {
            if (isReference(pathItem)) continue;
            const whEndpoints: Record<string, string> = {};
            for (const [m] of getPathOperations(pathItem)) {
                whEndpoints[m] = msg;
            }
            webhooks[whName] = whEndpoints;
        }
        output.webhooks = webhooks;
    }

    if (arazzoSpec && arazzoSpec.workflows.length > 0) {
        const workflows: Record<string, string> = {};
        for (const wf of arazzoSpec.workflows) {
            workflows[wf.workflowId] = msg;
        }
        output.workflows = workflows;
    }

    return output;
}

/** List of all 13 supported target programming languages for snippet generation. */
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
 * @param arazzoSpec Optional parsed Arazzo 1.1.0 spec for workflow fallback generation.
 * @returns A promise that resolves to the parsed CDDOutput (or a mock fallback).
 */
export async function generateVariant(
    lang: string,
    specPath: string,
    spec: OpenAPI320,
    options: CDDRunOptions = {},
    arazzoSpec?: Arazzo110,
): Promise<CDDOutput> {
    try {
        const stdout = await runCddCtl(lang, specPath, options);
        return parseCDDOutput(stdout);
    } catch {
        return generateMockFallback(lang, spec, options, arazzoSpec);
    }
}

/**
 * Configuration for a single SDK code snippet generation variant.
 */
interface SnippetVariantConfig {
    /** Whether the variant includes import statements. */
    includeImports: boolean;
    /** Whether the variant includes function/main wrapper boilerplate. */
    includeWrapping: boolean;
    /** Execution options forwarded to `runCddCtl`. */
    options: CDDRunOptions;
}

/**
 * Generates all snippets concurrently across multiple language targets and variants for OpenAPI endpoints, webhooks, and Arazzo workflows.
 * @param languages The list of target languages.
 * @param specPath The path to the OpenAPI or Arazzo specification file.
 * @param spec The parsed OpenAPI specification object.
 * @param cddCtlPath Optional path to the cdd-ctl binary.
 * @param arazzoSpec Optional parsed Arazzo 1.1.0 specification object.
 * @returns A promise that resolves to an array of CodeExample objects.
 */
export async function generateAllSnippets(
    languages: string[] = SUPPORTED_LANGUAGES,
    specPath: string,
    spec: OpenAPI320,
    cddCtlPath: string = resolveCddCtlPath(),
    arazzoSpec?: Arazzo110,
): Promise<CodeExample[]> {
    const variants: SnippetVariantConfig[] = [
        { includeImports: true, includeWrapping: true, options: { cddCtlPath } },
        { includeImports: false, includeWrapping: true, options: { noImports: true, cddCtlPath } },
        { includeImports: true, includeWrapping: false, options: { noWrapping: true, cddCtlPath } },
        {
            includeImports: false,
            includeWrapping: false,
            options: { noImports: true, noWrapping: true, cddCtlPath },
        },
    ];

    const promises: Promise<CodeExample[]>[] = [];

    for (const lang of languages) {
        const normalizedLang = lang === 'python-all' ? 'python' : lang;
        for (const variant of variants) {
            promises.push(
                generateVariant(lang, specPath, spec, variant.options, arazzoSpec).then(output => {
                    const examples: CodeExample[] = [];
                    for (const [route, methods] of Object.entries(output.endpoints)) {
                        for (const [method, content] of Object.entries(methods)) {
                            examples.push({
                                language: normalizedLang,
                                filepath: `${route.replace(/[^a-zA-Z0-9]/g, '_')}_${method}`,
                                content,
                                includeImports: variant.includeImports,
                                includeWrapping: variant.includeWrapping,
                                route,
                                method: method.toLowerCase(),
                            });
                        }
                    }
                    if (output.webhooks) {
                        for (const [whName, methods] of Object.entries(output.webhooks)) {
                            for (const [method, content] of Object.entries(methods)) {
                                examples.push({
                                    language: normalizedLang,
                                    filepath: `${whName.replace(/[^a-zA-Z0-9]/g, '_')}_${method}`,
                                    content,
                                    includeImports: variant.includeImports,
                                    includeWrapping: variant.includeWrapping,
                                    webhookName: whName,
                                    method: method.toLowerCase(),
                                });
                            }
                        }
                    }
                    if (output.workflows) {
                        for (const [wfId, content] of Object.entries(output.workflows)) {
                            examples.push({
                                language: normalizedLang,
                                filepath: `workflow_${wfId}`,
                                content,
                                includeImports: variant.includeImports,
                                includeWrapping: variant.includeWrapping,
                                workflowId: wfId,
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
