/**
 * OpenAPI 3.2.0 and Swagger 2.0 Parser and Normalizer.
 * @module parser
 */

import * as yaml from 'js-yaml';
import {
    DocData,
    CodeExample,
    OpenAPI320,
    InfoObject,
    ContactObject,
    LicenseObject,
    ServerObject,
    ServerVariableObject,
    PathsObject,
    PathItemObject,
    OperationObject,
    ParameterObject,
    RequestBodyObject,
    MediaTypeObject,
    ResponsesObject,
    ResponseObject,
    HeaderObject,
    LinkObject,
    CallbackObject,
    ExampleObject,
    ReferenceObject,
    EncodingObject,
    TagObject,
    ExternalDocumentationObject,
    SecurityRequirementObject,
    ComponentsObject,
    SchemaObject,
    DiscriminatorObject,
    XMLObject,
    SecuritySchemeObject,
    OAuthFlowsObject,
    OAuthFlowObject,
    JsonValue,
    STANDARD_HTTP_METHODS,
} from './types';
import { transformSwagger2ToOpenAPI3 } from './swagger2';
import { isArazzoSpec, parseArazzoSpec, normalizeArazzoWorkflows, buildWorkflowDag } from './arazzo-parser';

/**
 * Type guard checking if an unknown value is a non-null plain object record.
 * @param val The unknown value to inspect.
 * @returns True if the value is a non-null, non-array object.
 */
export function isRecord(val: unknown): val is Record<string, unknown> {
    return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * Checks if a trimmed specification input string represents a remote URL or local gateway path
 * rather than inline JSON/YAML content or an existing local file path.
 * @param trimmed The trimmed input string to inspect.
 * @param fileExistsCheck Optional predicate checking if a local file path exists on disk.
 * @returns True if the input should be fetched as a URL.
 */
export function isSpecUrl(trimmed: string, fileExistsCheck?: (path: string) => boolean): boolean {
    if (!trimmed) return false;
    if (/^https?:\/\//i.test(trimmed)) {
        return true;
    }
    if (fileExistsCheck && fileExistsCheck(trimmed)) return false;
    if (trimmed.startsWith('/')) {
        return true;
    }
    return (
        !trimmed.includes('\n') &&
        !trimmed.startsWith('{') &&
        !trimmed.includes(': ') &&
        /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(trimmed)
    );
}

/**
 * Normalizes a specification URL string, prepending `https://` when a bare domain path
 * (e.g. `example.com/spec.yaml`) is supplied instead of an explicit `http://`, `https://`, or `/` prefix.
 * @param url The raw URL string.
 * @returns The normalized URL ready for `fetch()`.
 */
export function normalizeSpecUrl(url: string): string {
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/')) {
        return 'https://' + trimmed;
    }
    return trimmed;
}

/**
 * Checks whether a single trimmed source line is an import, include, require, using, package, or shell source statement.
 * @param trimmed The trimmed line of source code.
 * @returns True if the line is an import/include/package declaration.
 */
function isImportOrPackageLine(trimmed: string): boolean {
    return (
        /^<\?php\b/.test(trimmed) ||
        /^declare\s*\(\s*strict_types/.test(trimmed) ||
        /^package\s+[A-Za-z0-9_.]+;?$/.test(trimmed) ||
        /^namespace\s+[A-Za-z0-9_\\]+;$/.test(trimmed) ||
        /^#include\s+[<"].+[>"]$/.test(trimmed) ||
        /^import\s+/.test(trimmed) ||
        /^from\s+[A-Za-z0-9_.]+\s+import\s+/.test(trimmed) ||
        /^using\s+[A-Za-z0-9_.]+;$/.test(trimmed) ||
        /^use\s+[A-Za-z0-9_:\\{}*,\s]+;$/.test(trimmed) ||
        /^require(?:_once|_relative)?[\s(]+['"]/.test(trimmed) ||
        /^(?:\.|source)\s+\.?\/[^\s]+$/.test(trimmed)
    );
}

/**
 * Decomposes a flat source code snippet string into structured `{ imports, wrapper_start, snippet, wrapper_end }`
 * components when imports or outer boilerplate wrappers (`main`, `Example`, `execute`, etc.) are detected.
 * @param rawCode The flat code string to inspect and decompose.
 * @returns A structured record compatible with `expandStructuredCodeVariants`.
 */
export function decomposeFlatCodeString(rawCode: string): Record<string, unknown> {
    const normalized = rawCode.replace(/\r\n/g, '\n').trim();
    if (!normalized) {
        return { snippet: '' };
    }

    const lines = normalized.split('\n');
    const importLines: string[] = [];
    let idx = 0;

    // 1. Collect leading import / include / package / require / source lines
    while (idx < lines.length) {
        const line = lines.slice(idx, idx + 1).join('');
        const trimmed = line.trim();
        if (!trimmed) {
            idx++;
            continue;
        }
        if (isImportOrPackageLine(trimmed)) {
            importLines.push(line);
            idx++;
            // Handle Go multi-line `import ( ... )` block
            if (/^import\s*\($/.test(trimmed)) {
                while (idx < lines.length) {
                    const impLine = lines.slice(idx, idx + 1).join('');
                    importLines.push(impLine);
                    idx++;
                    if (impLine.trim() === ')') break;
                }
            }
            continue;
        }
        break;
    }

    const bodyLines = lines.slice(idx);
    const wrapperStartLines: string[] = [];
    const wrapperEndLines: string[] = [];

    // 2. Detect outer boilerplate wrappers (`def main(): ... if __name__ == "__main__": main()`, `int main`, `func main`, `class Example`, `export async function execute()`, `main() { ... }`)
    if (bodyLines.length >= 3) {
        const firstTrimmed = bodyLines.slice(0, 1).join('').trim();
        const lastTrimmed = bodyLines.slice(-1).join('').trim();

        // Python `def main():` + trailing `if __name__ == "__main__":\n    main()`
        if (/^(?:async\s+)?def\s+main\s*\(/.test(firstTrimmed)) {
            wrapperStartLines.push(...bodyLines.splice(0, 1));
            if (bodyLines.slice(-1).join('').trim() === 'main()') {
                wrapperEndLines.unshift(...bodyLines.splice(-2, 2));
            }
            if (/^\w+\s*=\s*\w*Client\s*\(/.test(bodyLines.slice(0, 1).join('').trim())) {
                wrapperStartLines.push(...bodyLines.splice(0, 1));
            }
        } else if (/^def\s+main\b/.test(firstTrimmed)) {
            // Ruby `def main ... end\nmain if __FILE__ == $0`
            wrapperStartLines.push(...bodyLines.splice(0, 1));
            if (/^main\s+if\s+__FILE__\s*==\s*\$0/.test(lastTrimmed)) {
                wrapperEndLines.unshift(...bodyLines.splice(-1, 1));
            }
            while (!bodyLines.slice(-1).join('').trim()) {
                bodyLines.pop();
            }
            wrapperEndLines.unshift(...bodyLines.splice(-1, 1));
            if (/^\w+\s*=\s*\w+\.new\b/.test(bodyLines.slice(0, 1).join('').trim())) {
                wrapperStartLines.push(...bodyLines.splice(0, 1));
            }
        } else if (/^main\s*\(\)\s*\{$/.test(firstTrimmed)) {
            // Shell `main() { ... }\nmain "$@"`
            wrapperStartLines.push(...bodyLines.splice(0, 1));
            if (/^main\s+"\$@"$/.test(lastTrimmed)) {
                wrapperEndLines.unshift(...bodyLines.splice(-1, 1));
            }
            while (!bodyLines.slice(-1).join('').trim()) {
                bodyLines.pop();
            }
            wrapperEndLines.unshift(...bodyLines.splice(-1, 1));
        } else if (
            // C / C++ / Go / Rust / Kotlin / TS / Java / C# / Swift brace-delimited main or Example wrapper
            /^(?:int\s+main\s*\(|func\s+main\s*\(|suspend\s+fun\s+main\s*\(|fun\s+main\s*\(|#\[tokio::main\]|async\s+fn\s+main\s*\(|export\s+(?:async\s+)?function\s+(?:execute|ExampleComponent)\s*\(|@Component\b|@main\b|<script\s+setup>|(?:public\s+)?class\s+(?:Example|Program)\b)/.test(
                firstTrimmed,
            ) &&
            (lastTrimmed === '}' || lastTrimmed === '</script>')
        ) {
            wrapperStartLines.push(...bodyLines.splice(0, 1));
            wrapperEndLines.unshift(...bodyLines.splice(-1, 1));

            // Peel nested class -> main/execute wrapper if present
            while (
                bodyLines.length >= 3 &&
                /^(?:public\s+static\s+(?:async\s+)?(?:void|Task)\s+Main|public\s+static\s+void\s+main\s*\(|static\s+func\s+main\s*\(|export\s+class\s+\w+|private\s+readonly\s+\w+|async\s+execute\s*\(|async\s+function\s+execute\s*\(|struct\s+Example\b|async\s+fn\s+main\s*\(|try\s*\{)/.test(
                    bodyLines.slice(0, 1).join('').trim(),
                )
            ) {
                wrapperStartLines.push(...bodyLines.splice(0, 1));
                if (/^\}\s*catch\b/.test(bodyLines.slice(-3, -2).join('').trim())) {
                    wrapperEndLines.unshift(...bodyLines.splice(-3, 3));
                } else {
                    wrapperEndLines.unshift(...bodyLines.splice(-1, 1));
                }
            }

            // Peel leading client initialization line into wrapper_start if at least one statement remains in snippet
            if (
                bodyLines.length >= 2 &&
                /^(?:const|let|var|val|auto|struct\s+\w+)\s+\w+\s*(?:=[^;]+;?|;\s*$)/.test(
                    bodyLines.slice(0, 1).join('').trim(),
                )
            ) {
                wrapperStartLines.push(...bodyLines.splice(0, 1));
                if (/^api_init\s*\(/.test(bodyLines.slice(0, 1).join('').trim())) {
                    wrapperStartLines.push(...bodyLines.splice(0, 1));
                }
            }

            // Peel trailing return / Ok(()) / api_cleanup into wrapper_end if at least one statement remains in snippet
            while (
                bodyLines.length >= 2 &&
                /^(?:return\s+(?:0|CDD_C_SUCCESS)\s*;|Ok\(\(\)\)|api_cleanup\s*\()/.test(
                    bodyLines.slice(-1).join('').trim(),
                )
            ) {
                wrapperEndLines.unshift(...bodyLines.splice(-1, 1));
            }
        }
    }

    // Dedent the core snippet lines if an outer wrapper was stripped
    let snippetStr = bodyLines.join('\n').trim();
    if (wrapperStartLines.length > 0) {
        const nonEmptyLines = bodyLines.filter(l => l.trim().length > 0);
        const minIndent = nonEmptyLines.reduce((min, l) => {
            const trimmedLen = l.trimStart().length;
            return Math.min(min, l.length - trimmedLen);
        }, Infinity);
        snippetStr = bodyLines
            .map(l => l.slice(minIndent))
            .join('\n')
            .trim();
    }

    const result: Record<string, unknown> = {
        snippet: snippetStr,
    };
    if (importLines.length > 0) {
        result['imports'] = importLines.join('\n').trim();
    }
    if (wrapperStartLines.length > 0) {
        result['wrapper_start'] = wrapperStartLines.join('\n').trim();
    }
    if (wrapperEndLines.length > 0) {
        result['wrapper_end'] = wrapperEndLines.join('\n').trim();
    }
    return result;
}

/**
 * Checks whether a filepath belongs to a project configuration, build manifest, test suite, or model definition file
 * that should never be displayed as an endpoint SDK usage snippet.
 * @param filepath The file path to inspect.
 * @returns True if the file is non-snippet scaffolding/config/test code.
 */
export function isScaffoldingOrNonSnippetFile(filepath: string): boolean {
    const normalized = filepath.replace(/\\/g, '/').toLowerCase();
    const slashIdx = normalized.lastIndexOf('/');
    const basename = slashIdx !== -1 ? normalized.slice(slashIdx + 1) : normalized;

    if (
        normalized.startsWith('.github/') ||
        normalized.includes('/.github/') ||
        normalized.includes('/tests/') ||
        normalized.includes('/test/') ||
        normalized.includes('/__tests__/') ||
        normalized.includes('/models/') ||
        normalized.includes('/schemas/')
    ) {
        return true;
    }

    const exactExcludedNames = new Set([
        'cargo.toml',
        'cargo.lock',
        'cmakelists.txt',
        'makefile',
        'package.json',
        'package-lock.json',
        'tsconfig.json',
        'composer.json',
        'gemfile',
        'build.gradle',
        'build.gradle.kts',
        'settings.gradle',
        'settings.gradle.kts',
        'pom.xml',
        'package.swift',
        'go.mod',
        'go.sum',
        'pyproject.toml',
        'setup.py',
        'requirements.txt',
        'readme.md',
        '.gitignore',
        'dockerfile',
    ]);
    if (exactExcludedNames.has(basename)) {
        return true;
    }

    return /\.(?:md|toml|lock|csproj|sln|ya?ml|spec\.ts|test\.ts)$|(?:_test\.go|_test\.py|test\.java|test\.kt|tests\.cs|tests\.swift)$|^test_/.test(
        basename,
    );
}

/**
 * Extracts a concise per-operation SDK snippet from a raw multi-operation SDK source file when
 * full `to_sdk` files are supplied instead of `to_docs_json` output.
 * @param content Full source file content.
 * @param operationId Optional target `operationId`.
 * @param route Target HTTP route path (e.g. `'/pets'`).
 * @param method Target lowercase HTTP method (e.g. `'get'`).
 * @returns The extracted concise snippet or `null` if the operation does not appear in `content`.
 */
export function extractOperationSnippetFromSdkFile(
    content: string,
    operationId: string | undefined,
    route: string,
    method: string,
): string | null {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    // If the content is already a concise snippet (<= 25 lines), return it directly
    if (lines.length <= 25) {
        return content;
    }

    const opVariants: string[] = [];
    if (operationId) {
        const snake = operationId.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
        const pascal = operationId.charAt(0).toUpperCase() + operationId.slice(1);
        for (const v of new Set([operationId, snake, pascal])) {
            opVariants.push(v);
        }
    }

    let matchLineIdx = -1;

    // 1. Look for function/method declaration line matching operationId
    for (const variant of opVariants) {
        const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const declRegex = new RegExp(
            `(?:\\bfn\\b|\\bfunc\\b|\\bdef\\b|\\bfun\\b|\\bfunction\\b|\\basync\\b|\\bpublic\\b|\\bstatic\\b)\\s+[^\\n]*\\b${escaped}\\b|\\b${escaped}\\s*\\(`,
            'i',
        );
        for (let i = 0; i < lines.length; i++) {
            if (declRegex.test(lines.slice(i, i + 1).join(''))) {
                matchLineIdx = i;
                break;
            }
        }
        if (matchLineIdx !== -1) break;
    }

    // 2. Fallback: look for a line containing the exact route path and HTTP method nearby
    if (matchLineIdx === -1) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines.slice(i, i + 1).join('');
            if (line.includes(route)) {
                const windowStart = Math.max(0, i - 6);
                const windowEnd = Math.min(lines.length - 1, i + 6);
                const windowText = lines
                    .slice(windowStart, windowEnd + 1)
                    .join('\n')
                    .toLowerCase();
                if (windowText.includes(method.toLowerCase())) {
                    matchLineIdx = windowStart;
                    for (let j = i; j >= windowStart; j--) {
                        if (/\b(?:fn|func|def|fun|function|public|async)\b/.test(lines.slice(j, j + 1).join(''))) {
                            matchLineIdx = j;
                            break;
                        }
                    }
                    break;
                }
            }
        }
    }

    if (matchLineIdx === -1) {
        return null;
    }

    // Extract a concise block (up to 15 lines or until balanced closing brace)
    const maxEnd = Math.min(lines.length, matchLineIdx + 15);
    const extracted: string[] = [];
    let braceDepth = 0;
    let sawOpenBrace = false;

    for (let i = matchLineIdx; i < maxEnd; i++) {
        const line = lines.slice(i, i + 1).join('');
        extracted.push(line);
        for (const ch of line) {
            if (ch === '{') {
                braceDepth++;
                sawOpenBrace = true;
            } else if (ch === '}') {
                braceDepth--;
            }
        }
        if (sawOpenBrace && braceDepth <= 0) {
            break;
        }
    }

    return extracted.join('\n').trim();
}

/**
 * Metadata fields for associating a `CodeExample` with its target operation, webhook, or workflow.
 */
export interface CodeExampleMetadata {
    /** Explicit operationId for deterministic correlation. */
    operationId?: string | undefined;
    /** Explicit HTTP method in lowercase. */
    method?: string | undefined;
    /** Explicit route path. */
    route?: string | undefined;
    /** Explicit webhook name. */
    webhookName?: string | undefined;
    /** Explicit Arazzo workflowId. */
    workflowId?: string | undefined;
}

/**
 * Reconstructs a single code string from a structured code snippet object (`imports`, `wrapperStart` / `wrapper_start`, `snippet` / `code`, `wrapperEnd` / `wrapper_end`),
 * optionally filtering whether imports or wrapper lines are included.
 * @param codeRec The structured code record.
 * @param includeImports Whether to include the `imports` section (defaults to `true`).
 * @param includeWrapping Whether to include `wrapperStart` and `wrapperEnd` sections (defaults to `true`).
 * @returns The assembled code snippet string.
 */
export function assembleStructuredCodeSnippet(
    codeRec: Record<string, unknown>,
    includeImports: boolean = true,
    includeWrapping: boolean = true,
): string {
    if (typeof codeRec['default'] === 'object' && isRecord(codeRec['default'])) {
        return assembleStructuredCodeSnippet(codeRec['default'], includeImports, includeWrapping);
    }
    const parts: string[] = [];
    const imports = codeRec['imports'];
    const wrapperStart = codeRec['wrapperStart'] ?? codeRec['wrapper_start'];
    const snippet = codeRec['snippet'] ?? codeRec['code'];
    const wrapperEnd = codeRec['wrapperEnd'] ?? codeRec['wrapper_end'];

    if (includeImports && typeof imports === 'string' && imports.trim()) parts.push(imports.trim());
    if (includeWrapping && typeof wrapperStart === 'string' && wrapperStart.trim()) parts.push(wrapperStart.trim());
    if (typeof snippet === 'string' && snippet.trim()) parts.push(snippet.trim());
    if (includeWrapping && typeof wrapperEnd === 'string' && wrapperEnd.trim()) parts.push(wrapperEnd.trim());

    return parts.join('\n');
}

/**
 * Expands a structured code snippet record (`imports`, `wrapperStart`, `snippet`, `wrapperEnd`) into
 * either 4 toggleable `CodeExample` variants (when imports or wrapping fields are present) or a single
 * `CodeExample` (when only `snippet`/`code` is present).
 * @param codeRec The structured code record.
 * @param language The target programming language.
 * @param filepath The synthetic filepath slug.
 * @param meta Optional explicit correlation metadata (`operationId`, `method`, `route`, `webhookName`, `workflowId`).
 * @returns Array of expanded `CodeExample` items.
 */
export function expandStructuredCodeVariants(
    codeRec: Record<string, unknown>,
    language: string,
    filepath: string,
    meta: CodeExampleMetadata = {},
): CodeExample[] {
    const targetRec =
        typeof codeRec['default'] === 'object' && isRecord(codeRec['default']) ? codeRec['default'] : codeRec;
    const hasImports = typeof targetRec['imports'] === 'string' && targetRec['imports'].trim().length > 0;
    const wrapperStart = targetRec['wrapperStart'] ?? targetRec['wrapper_start'];
    const wrapperEnd = targetRec['wrapperEnd'] ?? targetRec['wrapper_end'];
    const hasWrapping =
        (typeof wrapperStart === 'string' && wrapperStart.trim().length > 0) ||
        (typeof wrapperEnd === 'string' && wrapperEnd.trim().length > 0);

    if (!hasImports && !hasWrapping) {
        const assembled = assembleStructuredCodeSnippet(targetRec, true, true);
        if (!assembled) return [];
        return [
            {
                language,
                filepath,
                content: assembled,
                includeImports: false,
                includeWrapping: false,
                ...meta,
            },
        ];
    }

    const variants: Array<{
        /** Whether to include import statements in this variant. */
        includeImports: boolean;
        /** Whether to include wrapper lines in this variant. */
        includeWrapping: boolean;
    }> = [
        { includeImports: true, includeWrapping: true },
        { includeImports: false, includeWrapping: true },
        { includeImports: true, includeWrapping: false },
        { includeImports: false, includeWrapping: false },
    ];

    const out: CodeExample[] = [];
    for (const v of variants) {
        const assembled = assembleStructuredCodeSnippet(targetRec, v.includeImports, v.includeWrapping);
        out.push({
            language,
            filepath,
            content: assembled,
            includeImports: v.includeImports,
            includeWrapping: v.includeWrapping,
            ...meta,
        });
    }
    return out;
}

/**
 * Extracts `CodeExample` items from a `CDDOutput`-shaped record (`endpoints`, `operations`, `webhooks`, `workflows`).
 * @param rec The record containing `endpoints`, `operations`, `webhooks`, and/or `workflows`.
 * @param lang The programming language identifier.
 * @returns Array of extracted `CodeExample` objects.
 */
export function extractExamplesFromCddOutputRecord(rec: Record<string, unknown>, lang: string): CodeExample[] {
    const out: CodeExample[] = [];
    const expandStringOrRecord = (snippet: unknown, filepath: string, meta: CodeExampleMetadata): CodeExample[] => {
        if (typeof snippet === 'string') {
            if (!snippet.trim()) {
                return [
                    {
                        language: lang,
                        filepath,
                        content: snippet,
                        includeImports: false,
                        includeWrapping: false,
                        ...meta,
                    },
                ];
            }
            return expandStructuredCodeVariants(decomposeFlatCodeString(snippet), lang, filepath, meta);
        }
        if (isRecord(snippet)) {
            return expandStructuredCodeVariants(snippet, lang, filepath, meta);
        }
        return [];
    };

    const extractRouteMap = (routeMap: Record<string, unknown>, isWebhook: boolean): void => {
        for (const [routePath, methods] of Object.entries(routeMap)) {
            if (!isRecord(methods)) continue;
            for (const [method, snippet] of Object.entries(methods)) {
                const filepath = `${routePath.replace(/[^a-zA-Z0-9]/g, '_')}_${method.toLowerCase()}`;
                const meta: CodeExampleMetadata = isWebhook
                    ? { webhookName: routePath, method: method.toLowerCase() }
                    : { route: routePath, method: method.toLowerCase() };
                out.push(...expandStringOrRecord(snippet, filepath, meta));
            }
        }
    };

    if (isRecord(rec['endpoints'])) {
        extractRouteMap(rec['endpoints'], false);
    }
    if (isRecord(rec['operations'])) {
        for (const [opKey, opVal] of Object.entries(rec['operations'])) {
            if (!isRecord(opVal)) continue;
            const opId = typeof opVal['operationId'] === 'string' ? opVal['operationId'] : opKey;
            const opRoute = typeof opVal['path'] === 'string' ? opVal['path'] : undefined;
            const opMethod = typeof opVal['method'] === 'string' ? opVal['method'].toLowerCase() : undefined;
            const filepath = `op_${opId.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const meta: CodeExampleMetadata = {
                operationId: opId,
                route: opRoute,
                method: opMethod,
            };
            const codeField = opVal['code'] ?? opVal;
            out.push(...expandStringOrRecord(codeField, filepath, meta));
        }
    }
    if (isRecord(rec['webhooks'])) {
        extractRouteMap(rec['webhooks'], true);
    }
    if (isRecord(rec['workflows'])) {
        for (const [wfId, snippet] of Object.entries(rec['workflows'])) {
            const filepath = `workflow_${wfId}`;
            const meta: CodeExampleMetadata = { workflowId: wfId };
            out.push(...expandStringOrRecord(snippet, filepath, meta));
        }
    }
    return out;
}

/**
 * Coerces an unknown value into a safe `JsonValue` recursively.
 * @param val The value to coerce.
 * @returns A valid `JsonValue`.
 */
export function toJsonValue(val: unknown): JsonValue {
    if (val === null || typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        return val;
    }
    if (Array.isArray(val)) {
        return val.map(toJsonValue);
    }
    if (isRecord(val)) {
        const out: { [key: string]: JsonValue } = {};
        for (const [k, v] of Object.entries(val)) {
            if (v !== undefined) {
                out[k] = toJsonValue(v);
            }
        }
        return out;
    }
    return String(val);
}

/**
 * Parses a raw info object into a normalized InfoObject.
 * @param obj The raw info object from the spec.
 * @returns A normalized InfoObject.
 * @throws {Error} If the info object is missing.
 */
export function parseInfo(obj: unknown): InfoObject {
    if (!isRecord(obj)) throw new Error('Missing info object');
    return {
        title: String(obj['title'] || ''),
        summary: obj['summary'] ? String(obj['summary']) : undefined,
        description: obj['description'] ? String(obj['description']) : undefined,
        termsOfService: obj['termsOfService'] ? String(obj['termsOfService']) : undefined,
        contact: isRecord(obj['contact']) ? parseContact(obj['contact']) : undefined,
        license: isRecord(obj['license']) ? parseLicense(obj['license']) : undefined,
        version: String(obj['version'] || ''),
    };
}

/**
 * Parses a raw contact object into a normalized ContactObject.
 * @param obj The raw contact object from the spec.
 * @returns A normalized ContactObject.
 */
export function parseContact(obj: unknown): ContactObject {
    const rec = isRecord(obj) ? obj : {};
    return {
        name: rec['name'] ? String(rec['name']) : undefined,
        url: rec['url'] ? String(rec['url']) : undefined,
        email: rec['email'] ? String(rec['email']) : undefined,
    };
}

/**
 * Parses a raw license object into a normalized LicenseObject.
 * @param obj The raw license object from the spec.
 * @returns A normalized LicenseObject.
 */
export function parseLicense(obj: unknown): LicenseObject {
    const rec = isRecord(obj) ? obj : {};
    return {
        name: String(rec['name'] || ''),
        identifier: rec['identifier'] ? String(rec['identifier']) : undefined,
        url: rec['url'] ? String(rec['url']) : undefined,
    };
}

/**
 * Parses a raw server variable object into a normalized ServerVariableObject.
 * @param obj The raw server variable object from the spec.
 * @returns A normalized ServerVariableObject.
 */
export function parseServerVariable(obj: unknown): ServerVariableObject {
    const rec = isRecord(obj) ? obj : {};
    return {
        enum: Array.isArray(rec['enum']) ? rec['enum'].map(String) : undefined,
        default: String(rec['default'] || ''),
        description: rec['description'] ? String(rec['description']) : undefined,
    };
}

/**
 * Parses a raw server object into a normalized ServerObject.
 * @param obj The raw server object from the spec.
 * @returns A normalized ServerObject.
 */
export function parseServer(obj: unknown): ServerObject {
    const rec = isRecord(obj) ? obj : {};
    const server: ServerObject = {
        url: String(rec['url'] || ''),
    };
    if (rec['description']) server.description = String(rec['description']);
    const variables = rec['variables'];
    if (isRecord(variables)) {
        server.variables = {};
        for (const [k, v] of Object.entries(variables)) {
            server.variables[k] = parseServerVariable(v);
        }
    }
    return server;
}

/**
 * Parses a raw reference object into a normalized ReferenceObject.
 * @param obj The raw reference object from the spec.
 * @returns A normalized ReferenceObject.
 */
export function parseReference(obj: unknown): ReferenceObject {
    const rec = isRecord(obj) ? obj : {};
    return {
        $ref: String(rec['$ref'] || ''),
        summary: rec['summary'] ? String(rec['summary']) : undefined,
        description: rec['description'] ? String(rec['description']) : undefined,
    };
}

/**
 * Checks if an object is a ReferenceObject.
 * @param obj The object to check.
 * @returns True if the object has a string `$ref` property.
 */
export function isReference(obj: unknown): obj is ReferenceObject {
    return isRecord(obj) && typeof obj['$ref'] === 'string';
}

/**
 * Parses a raw discriminator object into a normalized DiscriminatorObject.
 * @param obj The raw discriminator object from the spec.
 * @returns A normalized DiscriminatorObject.
 */
export function parseDiscriminator(obj: Record<string, unknown>): DiscriminatorObject {
    const disc: DiscriminatorObject = {
        propertyName: String(obj['propertyName'] || ''),
    };
    const mapping = obj['mapping'];
    if (isRecord(mapping)) {
        disc.mapping = {};
        for (const [k, v] of Object.entries(mapping)) {
            disc.mapping[k] = String(v);
        }
    }
    if (obj['defaultMapping'] !== undefined) {
        disc.defaultMapping = String(obj['defaultMapping']);
    }
    return disc;
}

/**
 * Parses a raw XML metadata object into a normalized XMLObject.
 * @param obj The raw XML object from the spec.
 * @returns A normalized XMLObject.
 */
export function parseXml(obj: Record<string, unknown>): XMLObject {
    return {
        name: obj['name'] ? String(obj['name']) : undefined,
        namespace: obj['namespace'] ? String(obj['namespace']) : undefined,
        prefix: obj['prefix'] ? String(obj['prefix']) : undefined,
        attribute: typeof obj['attribute'] === 'boolean' ? obj['attribute'] : undefined,
        wrapped: typeof obj['wrapped'] === 'boolean' ? obj['wrapped'] : undefined,
        nodeType: obj['nodeType'] ? String(obj['nodeType']) : undefined,
    };
}

/**
 * Parses a raw schema object into a normalized SchemaObject or ReferenceObject.
 * @param obj The raw schema object from the spec.
 * @returns A normalized SchemaObject or ReferenceObject.
 */
export function parseSchema(obj: unknown): SchemaObject | ReferenceObject {
    if (isReference(obj)) return parseReference(obj);
    const rec = isRecord(obj) ? obj : {};

    const schema: SchemaObject = {};
    if (rec['type']) schema.type = String(rec['type']);
    if (rec['description']) schema.description = String(rec['description']);
    if (rec['format']) schema.format = String(rec['format']);
    if (rec['title']) schema.title = String(rec['title']);
    if (typeof rec['multipleOf'] === 'number') schema.multipleOf = rec['multipleOf'];
    if (typeof rec['maximum'] === 'number') schema.maximum = rec['maximum'];
    if (typeof rec['exclusiveMaximum'] === 'boolean') schema.exclusiveMaximum = rec['exclusiveMaximum'];
    if (typeof rec['minimum'] === 'number') schema.minimum = rec['minimum'];
    if (typeof rec['exclusiveMinimum'] === 'boolean') schema.exclusiveMinimum = rec['exclusiveMinimum'];
    if (typeof rec['maxLength'] === 'number') schema.maxLength = rec['maxLength'];
    if (typeof rec['minLength'] === 'number') schema.minLength = rec['minLength'];
    if (rec['pattern']) schema.pattern = String(rec['pattern']);
    if (typeof rec['maxItems'] === 'number') schema.maxItems = rec['maxItems'];
    if (typeof rec['minItems'] === 'number') schema.minItems = rec['minItems'];
    if (typeof rec['uniqueItems'] === 'boolean') schema.uniqueItems = rec['uniqueItems'];
    if (typeof rec['maxProperties'] === 'number') schema.maxProperties = rec['maxProperties'];
    if (typeof rec['minProperties'] === 'number') schema.minProperties = rec['minProperties'];
    if (Array.isArray(rec['required'])) schema.required = rec['required'].map(String);
    if (Array.isArray(rec['enum'])) schema.enum = rec['enum'].map(toJsonValue);
    if (Array.isArray(rec['allOf'])) schema.allOf = rec['allOf'].map(parseSchema);
    if (Array.isArray(rec['oneOf'])) schema.oneOf = rec['oneOf'].map(parseSchema);
    if (Array.isArray(rec['anyOf'])) schema.anyOf = rec['anyOf'].map(parseSchema);
    if (rec['not']) schema.not = parseSchema(rec['not']);
    if (rec['items']) schema.items = parseSchema(rec['items']);
    const properties = rec['properties'];
    if (isRecord(properties)) {
        schema.properties = {};
        for (const [k, v] of Object.entries(properties)) {
            schema.properties[k] = parseSchema(v);
        }
    }
    const additionalProps = rec['additionalProperties'];
    if (additionalProps !== undefined) {
        schema.additionalProperties =
            typeof additionalProps === 'boolean' ? additionalProps : parseSchema(additionalProps);
    }
    if (rec['default'] !== undefined) schema.default = toJsonValue(rec['default']);
    if (typeof rec['nullable'] === 'boolean') schema.nullable = rec['nullable'];
    if (typeof rec['readOnly'] === 'boolean') schema.readOnly = rec['readOnly'];
    if (typeof rec['writeOnly'] === 'boolean') schema.writeOnly = rec['writeOnly'];
    if (rec['example'] !== undefined) schema.example = toJsonValue(rec['example']);
    if (typeof rec['deprecated'] === 'boolean') schema.deprecated = rec['deprecated'];

    const disc = rec['discriminator'];
    if (isRecord(disc)) {
        schema.discriminator = parseDiscriminator(disc);
    }
    const xml = rec['xml'];
    if (isRecord(xml)) {
        schema.xml = parseXml(xml);
    }
    if (rec['externalDocs']) schema.externalDocs = parseExternalDocs(rec['externalDocs']);

    return schema;
}

/**
 * Parses a raw example object into a normalized ExampleObject or ReferenceObject.
 * @param obj The raw example object from the spec.
 * @returns A normalized ExampleObject or ReferenceObject.
 */
export function parseExample(obj: unknown): ExampleObject | ReferenceObject {
    if (isReference(obj)) return parseReference(obj);
    const rec = isRecord(obj) ? obj : {};
    return {
        summary: rec['summary'] ? String(rec['summary']) : undefined,
        description: rec['description'] ? String(rec['description']) : undefined,
        value: rec['value'] !== undefined ? toJsonValue(rec['value']) : undefined,
        externalValue: rec['externalValue'] ? String(rec['externalValue']) : undefined,
    };
}

/**
 * Parses a raw header object into a normalized HeaderObject or ReferenceObject.
 * @param obj The raw header object from the spec.
 * @returns A normalized HeaderObject or ReferenceObject.
 */
export function parseHeader(obj: unknown): HeaderObject | ReferenceObject {
    if (isReference(obj)) return parseReference(obj);
    const rec = isRecord(obj) ? obj : {};
    const header: HeaderObject = {};
    if (rec['description']) header.description = String(rec['description']);
    if (typeof rec['required'] === 'boolean') header.required = rec['required'];
    if (typeof rec['deprecated'] === 'boolean') header.deprecated = rec['deprecated'];
    if (rec['schema']) header.schema = parseSchema(rec['schema']);
    if (rec['example'] !== undefined) header.example = toJsonValue(rec['example']);
    return header;
}

/**
 * Parses a raw encoding object into a normalized EncodingObject.
 * @param obj The raw encoding object from the spec.
 * @returns A normalized EncodingObject.
 */
export function parseEncoding(obj: unknown): EncodingObject {
    const rec = isRecord(obj) ? obj : {};
    const encoding: EncodingObject = {};
    if (rec['contentType']) encoding.contentType = String(rec['contentType']);
    const headers = rec['headers'];
    if (isRecord(headers)) {
        encoding.headers = {};
        for (const [k, v] of Object.entries(headers)) {
            encoding.headers[k] = parseHeader(v);
        }
    }
    if (rec['style']) encoding.style = String(rec['style']);
    if (typeof rec['explode'] === 'boolean') encoding.explode = rec['explode'];
    if (typeof rec['allowReserved'] === 'boolean') encoding.allowReserved = rec['allowReserved'];

    const prefixEncoding = rec['prefixEncoding'];
    if (isRecord(prefixEncoding)) {
        encoding.prefixEncoding = {};
        for (const [k, v] of Object.entries(prefixEncoding)) {
            encoding.prefixEncoding[k] = parseEncoding(v);
        }
    }
    const itemEncoding = rec['itemEncoding'];
    if (isRecord(itemEncoding)) {
        encoding.itemEncoding = {};
        for (const [k, v] of Object.entries(itemEncoding)) {
            encoding.itemEncoding[k] = parseEncoding(v);
        }
    }

    return encoding;
}

/**
 * Parses a raw media type object into a normalized MediaTypeObject.
 * @param obj The raw media type object from the spec.
 * @returns A normalized MediaTypeObject.
 */
export function parseMediaType(obj: unknown): MediaTypeObject {
    const rec = isRecord(obj) ? obj : {};
    const mt: MediaTypeObject = {};
    if (rec['schema']) mt.schema = parseSchema(rec['schema']);
    if (rec['itemSchema']) mt.itemSchema = parseSchema(rec['itemSchema']);
    if (rec['example'] !== undefined) mt.example = toJsonValue(rec['example']);
    const examples = rec['examples'];
    if (isRecord(examples)) {
        mt.examples = {};
        for (const [k, v] of Object.entries(examples)) {
            mt.examples[k] = parseExample(v);
        }
    }
    const encoding = rec['encoding'];
    if (isRecord(encoding)) {
        mt.encoding = {};
        for (const [k, v] of Object.entries(encoding)) {
            mt.encoding[k] = parseEncoding(v);
        }
    }
    const prefixEncoding = rec['prefixEncoding'];
    if (isRecord(prefixEncoding)) {
        mt.prefixEncoding = {};
        for (const [k, v] of Object.entries(prefixEncoding)) {
            mt.prefixEncoding[k] = parseEncoding(v);
        }
    }
    const itemEncoding = rec['itemEncoding'];
    if (isRecord(itemEncoding)) {
        mt.itemEncoding = {};
        for (const [k, v] of Object.entries(itemEncoding)) {
            mt.itemEncoding[k] = parseEncoding(v);
        }
    }
    return mt;
}

/**
 * Parses a raw request body object into a normalized RequestBodyObject or ReferenceObject.
 * @param obj The raw request body object from the spec.
 * @returns A normalized RequestBodyObject or ReferenceObject.
 */
export function parseRequestBody(obj: unknown): RequestBodyObject | ReferenceObject {
    if (isReference(obj)) return parseReference(obj);
    const rec = isRecord(obj) ? obj : {};
    const rb: RequestBodyObject = { content: {} };
    if (rec['description']) rb.description = String(rec['description']);
    if (typeof rec['required'] === 'boolean') rb.required = rec['required'];
    const content = rec['content'];
    if (isRecord(content)) {
        for (const [k, v] of Object.entries(content)) {
            rb.content[k] = parseMediaType(v);
        }
    }
    return rb;
}

/**
 * Type guard checking if a value is a valid parameter `in` location.
 * @param val The value to check.
 * @returns True if the value is 'query', 'header', 'path', or 'cookie'.
 */
function isParameterIn(val: unknown): val is 'query' | 'header' | 'path' | 'cookie' {
    return val === 'query' || val === 'header' || val === 'path' || val === 'cookie';
}

/**
 * Parses a raw parameter object into a normalized ParameterObject or ReferenceObject.
 * @param obj The raw parameter object from the spec.
 * @returns A normalized ParameterObject or ReferenceObject.
 */
export function parseParameter(obj: unknown): ParameterObject | ReferenceObject {
    if (isReference(obj)) return parseReference(obj);
    const rec = isRecord(obj) ? obj : {};
    const inVal = rec['in'];
    const param: ParameterObject = {
        name: String(rec['name'] || 'Unknown'),
        in: isParameterIn(inVal) ? inVal : 'query',
    };
    if (rec['description']) param.description = String(rec['description']);
    if (typeof rec['required'] === 'boolean') param.required = rec['required'];
    if (typeof rec['deprecated'] === 'boolean') param.deprecated = rec['deprecated'];
    if (typeof rec['allowEmptyValue'] === 'boolean') param.allowEmptyValue = rec['allowEmptyValue'];
    if (rec['style']) param.style = String(rec['style']);
    if (typeof rec['explode'] === 'boolean') param.explode = rec['explode'];
    if (typeof rec['allowReserved'] === 'boolean') param.allowReserved = rec['allowReserved'];
    if (rec['schema']) param.schema = parseSchema(rec['schema']);
    if (rec['example'] !== undefined) param.example = toJsonValue(rec['example']);
    const examples = rec['examples'];
    if (isRecord(examples)) {
        param.examples = {};
        for (const [k, v] of Object.entries(examples)) {
            param.examples[k] = parseExample(v);
        }
    }
    const content = rec['content'];
    if (isRecord(content)) {
        param.content = {};
        for (const [k, v] of Object.entries(content)) {
            param.content[k] = parseMediaType(v);
        }
    }
    return param;
}

/**
 * Parses a raw link object into a normalized LinkObject or ReferenceObject.
 * @param obj The raw link object from the spec.
 * @returns A normalized LinkObject or ReferenceObject.
 */
export function parseLink(obj: unknown): LinkObject | ReferenceObject {
    if (isReference(obj)) return parseReference(obj);
    const rec = isRecord(obj) ? obj : {};
    const link: LinkObject = {};
    if (rec['operationRef']) link.operationRef = String(rec['operationRef']);
    if (rec['operationId']) link.operationId = String(rec['operationId']);
    const parameters = rec['parameters'];
    if (isRecord(parameters)) {
        link.parameters = {};
        for (const [k, v] of Object.entries(parameters)) {
            link.parameters[k] = toJsonValue(v);
        }
    }
    if (rec['requestBody'] !== undefined) link.requestBody = toJsonValue(rec['requestBody']);
    if (rec['description']) link.description = String(rec['description']);
    if (rec['server']) link.server = parseServer(rec['server']);
    return link;
}

/**
 * Parses a raw response object into a normalized ResponseObject or ReferenceObject.
 * @param obj The raw response object from the spec.
 * @returns A normalized ResponseObject or ReferenceObject.
 */
export function parseResponse(obj: unknown): ResponseObject | ReferenceObject {
    if (isReference(obj)) return parseReference(obj);
    const rec = isRecord(obj) ? obj : {};
    const resp: ResponseObject = {
        description: String(rec['description'] || ''),
    };
    const headers = rec['headers'];
    if (isRecord(headers)) {
        resp.headers = {};
        for (const [k, v] of Object.entries(headers)) {
            resp.headers[k] = parseHeader(v);
        }
    }
    const content = rec['content'];
    if (isRecord(content)) {
        resp.content = {};
        for (const [k, v] of Object.entries(content)) {
            resp.content[k] = parseMediaType(v);
        }
    }
    const links = rec['links'];
    if (isRecord(links)) {
        resp.links = {};
        for (const [k, v] of Object.entries(links)) {
            resp.links[k] = parseLink(v);
        }
    }
    return resp;
}

/**
 * Parses a raw responses object into a normalized ResponsesObject.
 * @param obj The raw responses object from the spec.
 * @returns A normalized ResponsesObject.
 */
export function parseResponses(obj: unknown): ResponsesObject {
    const rec = isRecord(obj) ? obj : {};
    const responses: ResponsesObject = {};
    for (const [k, v] of Object.entries(rec)) {
        if (k === 'default') {
            responses.default = parseResponse(v);
        } else {
            responses[k] = parseResponse(v);
        }
    }
    return responses;
}

/**
 * Parses a raw callback object into a normalized CallbackObject or ReferenceObject.
 * @param obj The raw callback object from the spec.
 * @returns A normalized CallbackObject or ReferenceObject.
 */
export function parseCallback(obj: unknown): CallbackObject | ReferenceObject {
    if (isReference(obj)) return parseReference(obj);
    const rec = isRecord(obj) ? obj : {};
    const cb: CallbackObject = {};
    for (const [k, v] of Object.entries(rec)) {
        cb[k] = parsePathItem(v);
    }
    return cb;
}

/**
 * Parses a raw external documentation object into a normalized ExternalDocumentationObject.
 * @param obj The raw external documentation object from the spec.
 * @returns A normalized ExternalDocumentationObject.
 */
export function parseExternalDocs(obj: unknown): ExternalDocumentationObject {
    const rec = isRecord(obj) ? obj : {};
    return {
        url: String(rec['url'] || ''),
        description: rec['description'] ? String(rec['description']) : undefined,
    };
}

/**
 * Parses a raw security requirement object into a normalized SecurityRequirementObject.
 * @param obj The raw security requirement object from the spec.
 * @returns A normalized SecurityRequirementObject.
 */
export function parseSecurityRequirement(obj: unknown): SecurityRequirementObject {
    const rec = isRecord(obj) ? obj : {};
    const req: SecurityRequirementObject = {};
    for (const [k, v] of Object.entries(rec)) {
        req[k] = Array.isArray(v) ? v.map(String) : [];
    }
    return req;
}

/**
 * Parses a raw operation object into a normalized OperationObject.
 * @param obj The raw operation object from the spec.
 * @returns A normalized OperationObject.
 */
export function parseOperation(obj: unknown): OperationObject {
    const rec = isRecord(obj) ? obj : {};
    const op: OperationObject = {};
    if (Array.isArray(rec['tags'])) op.tags = rec['tags'].map(String);
    if (rec['summary']) op.summary = String(rec['summary']);
    if (rec['description']) op.description = String(rec['description']);
    if (rec['externalDocs']) op.externalDocs = parseExternalDocs(rec['externalDocs']);
    if (rec['operationId']) op.operationId = String(rec['operationId']);
    if (Array.isArray(rec['parameters'])) op.parameters = rec['parameters'].map(parseParameter);
    if (rec['requestBody']) op.requestBody = parseRequestBody(rec['requestBody']);
    if (rec['responses']) op.responses = parseResponses(rec['responses']);
    const callbacks = rec['callbacks'];
    if (isRecord(callbacks)) {
        op.callbacks = {};
        for (const [k, v] of Object.entries(callbacks)) {
            op.callbacks[k] = parseCallback(v);
        }
    }
    if (typeof rec['deprecated'] === 'boolean') op.deprecated = rec['deprecated'];
    if (Array.isArray(rec['security'])) op.security = rec['security'].map(parseSecurityRequirement);
    if (Array.isArray(rec['servers'])) op.servers = rec['servers'].map(parseServer);
    return op;
}

/**
 * Parses a raw path item object into a normalized PathItemObject or ReferenceObject.
 * @param obj The raw path item object from the spec.
 * @returns A normalized PathItemObject or ReferenceObject.
 */
export function parsePathItem(obj: unknown): PathItemObject | ReferenceObject {
    if (isReference(obj)) return parseReference(obj);
    const rec = isRecord(obj) ? obj : {};
    const item: PathItemObject = {};
    if (rec['summary']) item.summary = String(rec['summary']);
    if (rec['description']) item.description = String(rec['description']);
    if (rec['get']) item.get = parseOperation(rec['get']);
    if (rec['put']) item.put = parseOperation(rec['put']);
    if (rec['post']) item.post = parseOperation(rec['post']);
    if (rec['delete']) item.delete = parseOperation(rec['delete']);
    if (rec['options']) item.options = parseOperation(rec['options']);
    if (rec['head']) item.head = parseOperation(rec['head']);
    if (rec['patch']) item.patch = parseOperation(rec['patch']);
    if (rec['trace']) item.trace = parseOperation(rec['trace']);
    if (rec['query']) item.query = parseOperation(rec['query']);
    const additionalOps = rec['additionalOperations'];
    if (isRecord(additionalOps)) {
        item.additionalOperations = {};
        for (const [k, v] of Object.entries(additionalOps)) {
            item.additionalOperations[k] = parseOperation(v);
        }
    }
    if (Array.isArray(rec['servers'])) item.servers = rec['servers'].map(parseServer);
    if (Array.isArray(rec['parameters'])) item.parameters = rec['parameters'].map(parseParameter);
    return item;
}

/**
 * Parses a raw paths object into a normalized PathsObject.
 * @param obj The raw paths object from the spec.
 * @returns A normalized PathsObject.
 */
export function parsePaths(obj: unknown): PathsObject {
    const rec = isRecord(obj) ? obj : {};
    const paths: PathsObject = {};
    for (const [k, v] of Object.entries(rec)) {
        if (k.startsWith('/')) {
            paths[k] = parsePathItem(v);
        }
    }
    return paths;
}

/**
 * Parses a raw OAuth flow object into a normalized OAuthFlowObject.
 * @param obj The raw OAuth flow object from the spec.
 * @returns A normalized OAuthFlowObject.
 */
export function parseOAuthFlow(obj: unknown): OAuthFlowObject {
    const rec = isRecord(obj) ? obj : {};
    const flow: OAuthFlowObject = { scopes: {} };
    if (rec['authorizationUrl']) flow.authorizationUrl = String(rec['authorizationUrl']);
    if (rec['tokenUrl']) flow.tokenUrl = String(rec['tokenUrl']);
    if (rec['refreshUrl']) flow.refreshUrl = String(rec['refreshUrl']);
    if (rec['deviceAuthorizationUrl']) flow.deviceAuthorizationUrl = String(rec['deviceAuthorizationUrl']);
    const scopes = rec['scopes'];
    if (isRecord(scopes)) {
        for (const [k, v] of Object.entries(scopes)) {
            flow.scopes[k] = String(v);
        }
    }
    return flow;
}

/**
 * Type guard checking if a value is a valid SecurityScheme `type`.
 * @param val The value to check.
 * @returns True if the value is a valid SecuritySchemeObject type.
 */
function isSecuritySchemeType(val: unknown): val is 'apiKey' | 'http' | 'mutualTLS' | 'oauth2' | 'openIdConnect' {
    return val === 'apiKey' || val === 'http' || val === 'mutualTLS' || val === 'oauth2' || val === 'openIdConnect';
}

/**
 * Type guard checking if a value is a valid SecurityScheme `in` location.
 * @param val The value to check.
 * @returns True if the value is 'query', 'header', or 'cookie'.
 */
function isSecuritySchemeIn(val: unknown): val is 'query' | 'header' | 'cookie' {
    return val === 'query' || val === 'header' || val === 'cookie';
}

/**
 * Parses a raw security scheme object into a normalized SecuritySchemeObject or ReferenceObject.
 * @param obj The raw security scheme object from the spec.
 * @returns A normalized SecuritySchemeObject or ReferenceObject.
 */
export function parseSecurityScheme(obj: unknown): SecuritySchemeObject | ReferenceObject {
    if (isReference(obj)) return parseReference(obj);
    const rec = isRecord(obj) ? obj : {};
    const typeVal = rec['type'];
    const scheme: SecuritySchemeObject = {
        type: isSecuritySchemeType(typeVal) ? typeVal : 'http',
    };
    if (rec['description']) scheme.description = String(rec['description']);
    if (rec['name']) scheme.name = String(rec['name']);
    const inVal = rec['in'];
    if (isSecuritySchemeIn(inVal)) scheme.in = inVal;
    if (rec['scheme']) scheme.scheme = String(rec['scheme']);
    if (rec['bearerFormat']) scheme.bearerFormat = String(rec['bearerFormat']);
    if (rec['openIdConnectUrl']) scheme.openIdConnectUrl = String(rec['openIdConnectUrl']);
    if (rec['oauth2MetadataUrl']) scheme.oauth2MetadataUrl = String(rec['oauth2MetadataUrl']);

    const flows = rec['flows'];
    if (isRecord(flows)) {
        const parsedFlows: OAuthFlowsObject = {};
        if (flows['implicit']) parsedFlows.implicit = parseOAuthFlow(flows['implicit']);
        if (flows['password']) parsedFlows.password = parseOAuthFlow(flows['password']);
        if (flows['clientCredentials']) parsedFlows.clientCredentials = parseOAuthFlow(flows['clientCredentials']);
        if (flows['authorizationCode']) parsedFlows.authorizationCode = parseOAuthFlow(flows['authorizationCode']);
        if (flows['deviceAuthorization'])
            parsedFlows.deviceAuthorization = parseOAuthFlow(flows['deviceAuthorization']);
        scheme.flows = parsedFlows;
    }
    return scheme;
}

/**
 * Parses a raw components object into a normalized ComponentsObject.
 * @param obj The raw components object from the spec.
 * @returns A normalized ComponentsObject.
 */
export function parseComponents(obj: unknown): ComponentsObject {
    const rec = isRecord(obj) ? obj : {};
    const comp: ComponentsObject = {};
    const schemas = rec['schemas'];
    if (isRecord(schemas)) {
        comp.schemas = {};
        for (const [k, v] of Object.entries(schemas)) comp.schemas[k] = parseSchema(v);
    }
    const responses = rec['responses'];
    if (isRecord(responses)) {
        comp.responses = {};
        for (const [k, v] of Object.entries(responses)) comp.responses[k] = parseResponse(v);
    }
    const parameters = rec['parameters'];
    if (isRecord(parameters)) {
        comp.parameters = {};
        for (const [k, v] of Object.entries(parameters)) comp.parameters[k] = parseParameter(v);
    }
    const examples = rec['examples'];
    if (isRecord(examples)) {
        comp.examples = {};
        for (const [k, v] of Object.entries(examples)) comp.examples[k] = parseExample(v);
    }
    const requestBodies = rec['requestBodies'];
    if (isRecord(requestBodies)) {
        comp.requestBodies = {};
        for (const [k, v] of Object.entries(requestBodies)) comp.requestBodies[k] = parseRequestBody(v);
    }
    const headers = rec['headers'];
    if (isRecord(headers)) {
        comp.headers = {};
        for (const [k, v] of Object.entries(headers)) comp.headers[k] = parseHeader(v);
    }
    const securitySchemes = rec['securitySchemes'];
    if (isRecord(securitySchemes)) {
        comp.securitySchemes = {};
        for (const [k, v] of Object.entries(securitySchemes)) comp.securitySchemes[k] = parseSecurityScheme(v);
    }
    const links = rec['links'];
    if (isRecord(links)) {
        comp.links = {};
        for (const [k, v] of Object.entries(links)) comp.links[k] = parseLink(v);
    }
    const callbacks = rec['callbacks'];
    if (isRecord(callbacks)) {
        comp.callbacks = {};
        for (const [k, v] of Object.entries(callbacks)) comp.callbacks[k] = parseCallback(v);
    }
    const pathItems = rec['pathItems'];
    if (isRecord(pathItems)) {
        comp.pathItems = {};
        for (const [k, v] of Object.entries(pathItems)) comp.pathItems[k] = parsePathItem(v);
    }
    const mediaTypes = rec['mediaTypes'];
    if (isRecord(mediaTypes)) {
        comp.mediaTypes = {};
        for (const [k, v] of Object.entries(mediaTypes)) comp.mediaTypes[k] = parseMediaType(v);
    }
    return comp;
}

/**
 * Parses a raw tag object into a normalized TagObject.
 * @param obj The raw tag object from the spec.
 * @returns A normalized TagObject.
 */
export function parseTag(obj: unknown): TagObject {
    const rec = isRecord(obj) ? obj : {};
    const tag: TagObject = { name: String(rec['name'] || 'Unknown') };
    if (rec['summary']) tag.summary = String(rec['summary']);
    if (rec['description']) tag.description = String(rec['description']);
    if (rec['externalDocs']) tag.externalDocs = parseExternalDocs(rec['externalDocs']);
    if (rec['parent']) tag.parent = String(rec['parent']);
    if (rec['kind']) tag.kind = String(rec['kind']);
    return tag;
}

/**
 * Normalizes an OpenAPI 3.2.0, Swagger 2.0, or Arazzo 1.1.0 specification string (JSON or YAML)
 * into the internal `DocData` representation.
 * @param specContent Raw OpenAPI or Arazzo spec string (YAML/JSON).
 * @param companionArazzoContent Optional companion Arazzo 1.1.0 spec string (YAML/JSON) to link with an OpenAPI spec.
 * @returns Normalized DocData.
 * @throws {Error} If the spec format is invalid.
 */
export function normalizeSpec(specContent: string, companionArazzoContent?: string): DocData {
    let parsed: unknown;
    try {
        parsed = yaml.load(specContent);
    } catch {
        throw new Error('Invalid OpenAPI specification format.');
    }

    if (!isRecord(parsed)) {
        throw new Error('Invalid OpenAPI specification format.');
    }

    if (isArazzoSpec(parsed)) {
        const arazzoSpec = parseArazzoSpec(specContent);
        const workflows = normalizeArazzoWorkflows(arazzoSpec);
        const workflowDag = buildWorkflowDag(arazzoSpec);
        const spec: OpenAPI320 = {
            openapi: '3.2.0',
            info: {
                title: arazzoSpec.info.title,
                summary: arazzoSpec.info.summary,
                description: arazzoSpec.info.description,
                version: arazzoSpec.info.version,
            },
        };
        if (arazzoSpec.$self) {
            spec.$self = arazzoSpec.$self;
        }
        return {
            specKind: 'arazzo',
            spec,
            codeExamples: {},
            arazzoSpec,
            workflows,
            sourceDescriptions: arazzoSpec.sourceDescriptions,
            workflowCodeExamples: {},
            workflowDag,
        };
    }

    transformSwagger2ToOpenAPI3(parsed);

    const spec: OpenAPI320 = {
        openapi: String(parsed['openapi'] || '3.2.0'),
        info: parseInfo(parsed['info']),
    };

    if (parsed['$self']) spec.$self = String(parsed['$self']);
    if (parsed['jsonSchemaDialect']) spec.jsonSchemaDialect = String(parsed['jsonSchemaDialect']);
    if (Array.isArray(parsed['servers'])) spec.servers = parsed['servers'].map(parseServer);
    if (isRecord(parsed['paths'])) spec.paths = parsePaths(parsed['paths']);
    const webhooks = parsed['webhooks'];
    if (isRecord(webhooks)) {
        spec.webhooks = {};
        for (const [k, v] of Object.entries(webhooks)) {
            spec.webhooks[k] = parsePathItem(v);
        }
    }
    if (isRecord(parsed['components'])) {
        spec.components = parseComponents(parsed['components']);
    }
    if (Array.isArray(parsed['security'])) {
        spec.security = parsed['security'].map(parseSecurityRequirement);
    }
    if (Array.isArray(parsed['tags'])) {
        spec.tags = parsed['tags'].map(parseTag);
    }
    if (parsed['externalDocs']) {
        spec.externalDocs = parseExternalDocs(parsed['externalDocs']);
    }

    if (companionArazzoContent && companionArazzoContent.trim()) {
        const arazzoSpec = parseArazzoSpec(companionArazzoContent);
        const workflows = normalizeArazzoWorkflows(arazzoSpec, spec);
        const workflowDag = buildWorkflowDag(arazzoSpec);
        return {
            specKind: 'combined',
            spec,
            codeExamples: {},
            arazzoSpec,
            workflows,
            sourceDescriptions: arazzoSpec.sourceDescriptions,
            workflowCodeExamples: {},
            workflowDag,
        };
    }

    return {
        specKind: 'openapi',
        spec,
        codeExamples: {},
    };
}

/**
 * Extracts all operations (including standard HTTP methods and `additionalOperations`) from a `PathItemObject`.
 * @param pathItem The path item object to inspect.
 * @returns Array of `[methodName, OperationObject]` tuples.
 */
export function getPathOperations(pathItem: PathItemObject): Array<[string, OperationObject]> {
    const entries: Array<[string, OperationObject]> = [];
    for (const m of STANDARD_HTTP_METHODS) {
        const op = pathItem[m];
        if (op) {
            entries.push([m, op]);
        }
    }
    if (pathItem.additionalOperations) {
        for (const [customMethod, op] of Object.entries(pathItem.additionalOperations)) {
            entries.push([customMethod.toLowerCase(), op]);
        }
    }
    return entries;
}

/**
 * Represents a mapped OpenAPI or webhook operation entry used when correlating SDK code examples.
 */
interface OperationEntry {
    /** The route path or webhook name. */
    route: string;
    /** The lowercase HTTP method name. */
    method: string;
    /** The parsed OpenAPI operation object. */
    op: OperationObject;
    /** Whether this operation originates from `spec.webhooks`. */
    isWebhook: boolean;
}

/**
 * Maps generated SDK code examples to their respective operations and Arazzo workflows in the documentation data.
 * @param docData The documentation data to update.
 * @param generatedFiles The list of generated code examples.
 */
export function mapSdkExamples(docData: DocData, generatedFiles: CodeExample[]): void {
    const operationMap: Record<string, OperationEntry> = {};

    if (docData.spec.paths) {
        for (const [route, pathItem] of Object.entries(docData.spec.paths)) {
            if (isReference(pathItem)) continue;
            for (const [method, op] of getPathOperations(pathItem)) {
                const id = op.operationId || `${method}-${route}`;
                operationMap[id] = { route, method, op, isWebhook: false };
            }
        }
    }

    if (docData.spec.webhooks) {
        for (const [webhookName, pathItem] of Object.entries(docData.spec.webhooks)) {
            if (isReference(pathItem)) continue;
            for (const [method, op] of getPathOperations(pathItem)) {
                const id = op.operationId || `webhook-${method}-${webhookName}`;
                operationMap[id] = { route: webhookName, method, op, isWebhook: true };
            }
        }
    }

    const operations = Object.entries(operationMap);
    const operationsByOpIdLength = [...operations].sort(
        (a, b) => (b[1].op.operationId?.length ?? 0) - (a[1].op.operationId?.length ?? 0),
    );
    const operationsByRouteLength = [...operations].sort((a, b) => b[1].route.length - a[1].route.length);

    const workflows = docData.workflows ?? [];
    const workflowsByIdLength = [...workflows].sort(
        (a, b) => b.workflow.workflowId.length - a.workflow.workflowId.length,
    );

    for (const file of generatedFiles) {
        if (
            !file.operationId &&
            !file.route &&
            !file.webhookName &&
            !file.workflowId &&
            isScaffoldingOrNonSnippetFile(file.filepath)
        ) {
            continue;
        }
        const normalizedFilepath = file.filepath.toLowerCase();

        // Check if this example matches an Arazzo workflow first
        if (workflows.length > 0) {
            let matchedWfId: string | null = null;
            if (file.workflowId && workflows.some(nw => nw.workflow.workflowId === file.workflowId)) {
                matchedWfId = file.workflowId;
            } else {
                for (const nw of workflowsByIdLength) {
                    const wfId = nw.workflow.workflowId;
                    const wfSlug = wfId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                    if (
                        normalizedFilepath === `workflow_${wfId.toLowerCase()}` ||
                        normalizedFilepath === `workflow_${wfSlug}` ||
                        normalizedFilepath.includes(`_workflows_${wfSlug}`) ||
                        normalizedFilepath.includes(wfId.toLowerCase())
                    ) {
                        matchedWfId = wfId;
                        break;
                    }
                }
            }
            if (matchedWfId) {
                if (!docData.workflowCodeExamples) {
                    docData.workflowCodeExamples = {};
                }
                const list = docData.workflowCodeExamples[matchedWfId] ?? [];
                list.push(file);
                docData.workflowCodeExamples[matchedWfId] = list;
                continue;
            }
        }

        if (operations.length === 0) continue;

        let matchedId: string | null = null;

        // 0. Try explicit metadata match first
        if (file.operationId && operationMap[file.operationId]) {
            matchedId = file.operationId;
        } else if ((file.webhookName || file.route) && file.method) {
            const isWh = Boolean(file.webhookName);
            const targetRoute = file.webhookName || file.route;
            for (const [id, info] of operations) {
                if (
                    info.isWebhook === isWh &&
                    info.route === targetRoute &&
                    info.method === file.method.toLowerCase()
                ) {
                    matchedId = id;
                    break;
                }
            }
        }

        // 1. Try match with operationId (sorted longest first so 'getUserProfile' matches before 'get')
        if (!matchedId) {
            for (const [id, info] of operationsByOpIdLength) {
                if (info.op.operationId && normalizedFilepath.includes(info.op.operationId.toLowerCase())) {
                    matchedId = id;
                    break;
                }
            }
        }

        // 2. Try match with route and method (sorted longest route first)
        if (!matchedId) {
            for (const [id, info] of operationsByRouteLength) {
                const routeSlug = info.route.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                if (normalizedFilepath.includes(routeSlug) && normalizedFilepath.includes(info.method.toLowerCase())) {
                    matchedId = id;
                    break;
                }
            }
        }

        if (matchedId) {
            const matchedInfo = operationMap[matchedId];
            let fileToStore = file;
            if (matchedInfo && file.content.split('\n').length > 25) {
                const sliced = extractOperationSnippetFromSdkFile(
                    file.content,
                    matchedInfo.op.operationId,
                    matchedInfo.route,
                    matchedInfo.method,
                );
                fileToStore = { ...file, content: sliced ?? file.content };
            }
            const list = docData.codeExamples[matchedId] ?? [];
            list.push(fileToStore);
            docData.codeExamples[matchedId] = list;
        } else if (file.content.split('\n').length > 1) {
            // 3. If a raw multi-operation SDK client file (e.g. `client.py`, `api.ts`) was passed from `to_sdk`,
            // extract concise per-operation snippets for any operation found inside the file.
            for (const [id, info] of operations) {
                const sliced = extractOperationSnippetFromSdkFile(
                    file.content,
                    info.op.operationId,
                    info.route,
                    info.method,
                );
                if (sliced) {
                    const list = docData.codeExamples[id] ?? [];
                    list.push({
                        ...file,
                        content: sliced,
                        operationId: id,
                        route: info.route,
                        method: info.method,
                    });
                    docData.codeExamples[id] = list;
                }
            }
        }
    }
}
