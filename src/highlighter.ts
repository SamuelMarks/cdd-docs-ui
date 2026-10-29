/**
 * Zero-dependency syntax highlighter and tokenizer for all 13 CDD target languages, shell/cURL, and JSON.
 * Produces Shadow-DOM-compatible `<span class="cdd-tok-*">` elements while safely escaping HTML entities.
 * @module highlighter
 */

/**
 * Supported syntax token categories mapped to `.cdd-tok-${kind}` CSS classes.
 */
export type SyntaxTokenKind =
    'plain' | 'keyword' | 'string' | 'comment' | 'number' | 'function' | 'type' | 'variable' | 'operator';

/**
 * Normalized language family used by the tokenizer.
 */
export type NormalizedSyntaxLanguage =
    | 'c'
    | 'cpp'
    | 'csharp'
    | 'go'
    | 'java'
    | 'kotlin'
    | 'php'
    | 'python'
    | 'ruby'
    | 'rust'
    | 'sh'
    | 'swift'
    | 'ts'
    | 'json';

/**
 * Escapes HTML special characters in a raw token string so it can be safely embedded inside HTML.
 * @param raw The unescaped source text.
 * @returns The HTML-escaped string.
 */
export function escapeTokenHtml(raw: string): string {
    return raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Normalizes an arbitrary language identifier (e.g. `'typescript'`, `'bash'`, `'python-all'`, `'c#'`)
 * into a canonical `NormalizedSyntaxLanguage`.
 * @param language The raw language identifier string.
 * @returns The canonical `NormalizedSyntaxLanguage`.
 */
export function normalizeSyntaxLanguage(language: string): NormalizedSyntaxLanguage {
    const clean = language.trim().toLowerCase();
    switch (clean) {
        case 'c':
            return 'c';
        case 'cpp':
        case 'c++':
        case 'cxx':
            return 'cpp';
        case 'csharp':
        case 'cs':
        case 'c#':
        case 'dotnet':
            return 'csharp';
        case 'go':
        case 'golang':
            return 'go';
        case 'java':
            return 'java';
        case 'kotlin':
        case 'kt':
            return 'kotlin';
        case 'php':
            return 'php';
        case 'python':
        case 'python-all':
        case 'py':
            return 'python';
        case 'ruby':
        case 'rb':
            return 'ruby';
        case 'rust':
        case 'rs':
            return 'rust';
        case 'sh':
        case 'bash':
        case 'shell':
        case 'zsh':
        case 'curl':
            return 'sh';
        case 'swift':
            return 'swift';
        case 'json':
            return 'json';
        case 'ts':
        case 'typescript':
        case 'js':
        case 'javascript':
        default:
            return 'ts';
    }
}

/**
 * Language-specific keyword sets for all supported target languages.
 */
const LANGUAGE_KEYWORDS: Readonly<Record<NormalizedSyntaxLanguage, ReadonlySet<string>>> = {
    c: new Set([
        'auto',
        'break',
        'case',
        'const',
        'continue',
        'default',
        'do',
        'else',
        'enum',
        'extern',
        'for',
        'goto',
        'if',
        'inline',
        'register',
        'restrict',
        'return',
        'sizeof',
        'static',
        'struct',
        'switch',
        'typedef',
        'union',
        'volatile',
        'while',
        'NULL',
    ]),
    cpp: new Set([
        'alignas',
        'alignof',
        'auto',
        'break',
        'case',
        'catch',
        'class',
        'const',
        'constexpr',
        'continue',
        'co_await',
        'co_return',
        'co_yield',
        'decltype',
        'default',
        'delete',
        'do',
        'else',
        'enum',
        'explicit',
        'export',
        'extern',
        'false',
        'for',
        'friend',
        'goto',
        'if',
        'inline',
        'mutable',
        'namespace',
        'new',
        'noexcept',
        'nullptr',
        'operator',
        'override',
        'private',
        'protected',
        'public',
        ' return',
        'return',
        'sizeof',
        'static',
        'static_cast',
        'struct',
        'switch',
        'template',
        'this',
        'throw',
        'true',
        'try',
        'typedef',
        'typename',
        'union',
        'using',
        'virtual',
        'volatile',
        'while',
    ]),
    csharp: new Set([
        'abstract',
        'as',
        'async',
        'await',
        'base',
        'break',
        'case',
        'catch',
        'checked',
        'class',
        'const',
        'continue',
        'default',
        'delegate',
        'do',
        'else',
        'enum',
        'event',
        'explicit',
        'extern',
        'false',
        'finally',
        'fixed',
        'for',
        'foreach',
        'goto',
        'if',
        'implicit',
        'in',
        'interface',
        'internal',
        'is',
        'lock',
        'namespace',
        'new',
        'null',
        'operator',
        'out',
        'override',
        'params',
        'private',
        'protected',
        'public',
        'readonly',
        'record',
        'ref',
        'return',
        'sealed',
        'sizeof',
        'stackalloc',
        'static',
        'struct',
        'switch',
        'this',
        'throw',
        'true',
        'try',
        'typeof',
        'unchecked',
        'unsafe',
        'using',
        'var',
        'virtual',
        'void',
        'volatile',
        'while',
        'yield',
    ]),
    go: new Set([
        'break',
        'case',
        'chan',
        'const',
        'continue',
        'default',
        'defer',
        'else',
        'fallthrough',
        'false',
        'for',
        'func',
        'go',
        'goto',
        'if',
        'import',
        'interface',
        'map',
        'nil',
        'package',
        'range',
        'return',
        'select',
        'struct',
        'switch',
        'true',
        'type',
        'var',
    ]),
    java: new Set([
        'abstract',
        'assert',
        'break',
        'case',
        'catch',
        'class',
        'const',
        'continue',
        'default',
        'do',
        'else',
        'enum',
        'extends',
        'false',
        'final',
        'finally',
        'for',
        'goto',
        'if',
        'implements',
        'import',
        'instanceof',
        'interface',
        'native',
        'new',
        'null',
        'package',
        'private',
        'protected',
        'public',
        'record',
        'return',
        'static',
        'strictfp',
        'super',
        'switch',
        'synchronized',
        'this',
        'throw',
        'throws',
        'transient',
        'true',
        'try',
        'var',
        'void',
        'volatile',
        'while',
    ]),
    kotlin: new Set([
        'abstract',
        'actual',
        'annotation',
        'as',
        'break',
        'by',
        'catch',
        'class',
        'companion',
        'const',
        'constructor',
        'continue',
        'crossinline',
        'data',
        'do',
        'else',
        'enum',
        'expect',
        'external',
        'false',
        'final',
        'finally',
        'for',
        'fun',
        'get',
        'if',
        'import',
        'in',
        'infix',
        'init',
        'inline',
        'inner',
        'interface',
        'internal',
        'is',
        'it',
        'lateinit',
        'noinline',
        'null',
        'object',
        'open',
        'operator',
        'out',
        'override',
        'package',
        'private',
        'protected',
        'public',
        'reified',
        'return',
        'sealed',
        'set',
        'super',
        'suspend',
        'tailrec',
        'this',
        'throw',
        'true',
        'try',
        'typealias',
        'val',
        'var',
        'vararg',
        'when',
        'where',
        'while',
    ]),
    php: new Set([
        'abstract',
        'and',
        'array',
        'as',
        'break',
        'callable',
        'case',
        'catch',
        'class',
        'clone',
        'const',
        'continue',
        'declare',
        'default',
        'die',
        'do',
        'echo',
        'else',
        'elseif',
        'empty',
        'enddeclare',
        'endfor',
        'endforeach',
        'endif',
        'endswitch',
        'endwhile',
        'eval',
        'exit',
        'extends',
        'false',
        'final',
        'finally',
        'fn',
        'for',
        'foreach',
        'function',
        'global',
        'goto',
        'if',
        'implements',
        'include',
        'include_once',
        'instanceof',
        'insteadof',
        'interface',
        'isset',
        'list',
        'match',
        'namespace',
        'new',
        'null',
        'or',
        'print',
        'private',
        'protected',
        'public',
        'readonly',
        'require',
        'require_once',
        'return',
        'self',
        'static',
        'switch',
        'throw',
        'trait',
        'true',
        'try',
        'unset',
        'use',
        'var',
        'void',
        'while',
        'xor',
        'yield',
    ]),
    python: new Set([
        'False',
        'None',
        'True',
        'and',
        'as',
        'assert',
        'async',
        'await',
        'break',
        'class',
        'continue',
        'def',
        'del',
        'elif',
        'else',
        'except',
        'finally',
        'for',
        'from',
        'global',
        'if',
        'import',
        'in',
        'is',
        'lambda',
        'match',
        'nonlocal',
        'not',
        'or',
        'pass',
        'raise',
        'return',
        'self',
        'try',
        'while',
        'with',
        'yield',
    ]),
    ruby: new Set([
        'BEGIN',
        'END',
        '__ENCODING__',
        '__FILE__',
        '__LINE__',
        'alias',
        'and',
        'begin',
        'break',
        'case',
        'class',
        'def',
        'defined?',
        'do',
        'else',
        'elsif',
        'end',
        'ensure',
        'false',
        'for',
        'if',
        'in',
        'module',
        'next',
        'nil',
        'not',
        'or',
        'puts',
        'raise',
        'redo',
        'require',
        'require_relative',
        'rescue',
        'retry',
        'return',
        'self',
        'super',
        'then',
        'true',
        'undef',
        'unless',
        'until',
        'when',
        'while',
        'yield',
    ]),
    rust: new Set([
        'Self',
        'as',
        'async',
        'await',
        'break',
        'const',
        'continue',
        'crate',
        'dyn',
        'else',
        'enum',
        'extern',
        'false',
        'fn',
        'for',
        'if',
        'impl',
        'in',
        'let',
        'loop',
        'match',
        'mod',
        'move',
        'mut',
        'pub',
        'ref',
        'return',
        'self',
        'static',
        'struct',
        'super',
        'trait',
        'true',
        'type',
        'unsafe',
        'use',
        'where',
        'while',
    ]),
    sh: new Set([
        'case',
        'curl',
        'do',
        'done',
        'echo',
        'elif',
        'else',
        'esac',
        'exit',
        'export',
        'fi',
        'for',
        'function',
        'if',
        'in',
        'jq',
        'local',
        'printf',
        'read',
        'return',
        'select',
        'set',
        'shift',
        'source',
        'then',
        'trap',
        'unset',
        'until',
        'while',
    ]),
    swift: new Set([
        'Any',
        'Protocol',
        'Self',
        'Type',
        'actor',
        'as',
        'associatedtype',
        'async',
        'await',
        'break',
        'case',
        'catch',
        'class',
        'continue',
        'default',
        'defer',
        'deinit',
        'do',
        'else',
        'enum',
        'extension',
        'fallthrough',
        'false',
        'fileprivate',
        'final',
        'for',
        'func',
        'guard',
        'if',
        'import',
        'in',
        'init',
        'inout',
        'internal',
        'is',
        'isolated',
        'lazy',
        'let',
        'mutating',
        'nil',
        'nonisolated',
        'open',
        'operator',
        'optional',
        'override',
        'private',
        'protocol',
        'public',
        'repeat',
        'required',
        'rethrows',
        'return',
        'self',
        'some',
        'static',
        'struct',
        'subscript',
        'super',
        'switch',
        'throw',
        'throws',
        'true',
        'try',
        'typealias',
        'unowned',
        'var',
        'weak',
        'where',
        'while',
    ]),
    ts: new Set([
        'abstract',
        'any',
        'as',
        'async',
        'await',
        'break',
        'case',
        'catch',
        'class',
        'const',
        'constructor',
        'continue',
        'debugger',
        'declare',
        'default',
        'delete',
        'do',
        'else',
        'enum',
        'export',
        'extends',
        'false',
        'finally',
        'for',
        'from',
        'function',
        'get',
        'if',
        'implements',
        'import',
        'in',
        'infer',
        'instanceof',
        'interface',
        'is',
        'keyof',
        'let',
        'module',
        'namespace',
        'never',
        'new',
        'null',
        'of',
        'package',
        'private',
        'protected',
        'public',
        'readonly',
        ' override',
        'override',
        'require',
        'return',
        'satisfies',
        'set',
        'static',
        'super',
        'switch',
        'this',
        'throw',
        'true',
        'try',
        'type',
        'typeof',
        'undefined',
        'unique',
        'unknown',
        'var',
        'void',
        'while',
        'with',
        'yield',
    ]),
    json: new Set(['true', 'false', 'null']),
};

/**
 * Primitive and built-in type names recognized as `.cdd-tok-type`.
 */
const BUILTIN_TYPES: ReadonlySet<string> = new Set([
    'bool',
    'boolean',
    'byte',
    'char',
    'double',
    'error',
    'f32',
    'f64',
    'float',
    'i8',
    'i16',
    'i32',
    'i64',
    'i128',
    'int',
    'int8_t',
    'int16_t',
    'int32_t',
    'int64_t',
    'isize',
    'long',
    'number',
    'object',
    'short',
    'size_t',
    'str',
    'string',
    'u8',
    'u16',
    'u32',
    'u64',
    'u128',
    'uint',
    'uint8_t',
    'uint16_t',
    'uint32_t',
    'uint64_t',
    'uintptr',
    'unsigned',
    'usize',
    'void',
    'cdd_c_error_t',
    'Result',
    'Option',
    'Ok',
    'Err',
    'Some',
    'Box',
    'Vec',
    'String',
    'Task',
    'Promise',
    'Observable',
    'URL',
    'URLRequest',
    'URLSession',
]);

/**
 * Wraps a raw token string in a `<span class="cdd-tok-${kind}">` element (or returns escaped text for `'plain'`).
 * @param kind The syntax token category.
 * @param raw The raw unescaped token text.
 * @returns HTML string for the token.
 */
function wrapToken(kind: SyntaxTokenKind, raw: string): string {
    const escaped = escapeTokenHtml(raw);
    if (kind === 'plain') {
        return escaped;
    }
    return `<span class="cdd-tok-${kind}">${escaped}</span>`;
}

/**
 * Checks whether a character is a valid identifier start character (`[A-Za-z_]`).
 * @param ch Single character to inspect.
 * @returns True if `ch` starts an identifier.
 */
function isIdentStart(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

/**
 * Checks whether a character is a valid identifier continuation character (`[A-Za-z0-9_]`).
 * @param ch Single character to inspect.
 * @returns True if `ch` continues an identifier.
 */
function isIdentPart(ch: string): boolean {
    return isIdentStart(ch) || (ch >= '0' && ch <= '9');
}

/**
 * Checks whether a character is an ASCII decimal digit (`[0-9]`).
 * @param ch Single character to inspect.
 * @returns True if `ch` is a digit.
 */
function isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
}

/**
 * Scans forward from `index` past any horizontal whitespace to inspect the next non-whitespace character.
 * @param code Full source code string.
 * @param index Starting index.
 * @returns The next non-space character or `''`.
 */
function peekNonSpaceChar(code: string, index: number): string {
    let i = index;
    while (i < code.length && (code.charAt(i) === ' ' || code.charCodeAt(i) === 9)) {
        i++;
    }
    return code.charAt(i);
}

/**
 * Scans a quoted or raw string literal starting at `start` and returns the exclusive end index.
 * Handles escaped characters (``) and multi-character delimiters such as Python `"""` / `'''`.
 * @param code Full source code string.
 * @param start Index of the opening quote.
 * @param delimiter The opening quote delimiter (`"`, `'`, `` ` ``, `"""`, `'''`).
 * @param allowEscape Whether backslash escapes are active inside the string.
 * @returns Exclusive end index of the string literal.
 */
function scanStringLiteral(code: string, start: number, delimiter: string, allowEscape: boolean): number {
    let i = start + delimiter.length;
    while (i < code.length) {
        if (allowEscape && code.charCodeAt(i) === 92) {
            i += 2;
            continue;
        }
        if (code.startsWith(delimiter, i)) {
            return i + delimiter.length;
        }
        i++;
    }
    return code.length;
}

/**
 * Tokenizes and highlights source code for the specified language into HTML `<span class="cdd-tok-*">` tags.
 * @param code The raw source code string to highlight.
 * @param language The language identifier (e.g. `'ts'`, `'python'`, `'rust'`, `'bash'`, `'json'`).
 * @returns Highlighted HTML string safe for insertion inside `<code>...</code>`.
 */
export function highlightCode(code: string, language: string): string {
    if (!code) return '';
    const lang = normalizeSyntaxLanguage(language);
    const keywords = LANGUAGE_KEYWORDS[lang];
    const supportsHashComment = lang === 'python' || lang === 'ruby' || lang === 'sh' || lang === 'php';
    const supportsPreprocessor = lang === 'c' || lang === 'cpp' || lang === 'csharp';
    const supportsDollarVar = lang === 'php' || lang === 'sh' || lang === 'ruby';

    const out: string[] = [];
    let i = 0;
    const len = code.length;

    while (i < len) {
        const ch = code.charAt(i);
        const next = code.charAt(i + 1);

        // 1. PHP opening/closing tags `<?php`, `?>`
        if (lang === 'php' && (code.startsWith('<?php', i) || code.startsWith('?>', i))) {
            const tagLen = code.startsWith('<?php', i) ? 5 : 2;
            out.push(wrapToken('keyword', code.slice(i, i + tagLen)));
            i += tagLen;
            continue;
        }

        // 2. Vue / HTML tags in TS/Vue snippets (`<script setup>`, `</script>`)
        if (lang === 'ts' && (code.startsWith('<script', i) || code.startsWith('</script>', i))) {
            const closeIdx = code.indexOf('>', i);
            const endIdx = closeIdx !== -1 ? closeIdx + 1 : len;
            out.push(wrapToken('keyword', code.slice(i, endIdx)));
            i = endIdx;
            continue;
        }

        // 3. Multi-line C-style comments `/* ... */`
        if (ch === '/' && next === '*') {
            const closeIdx = code.indexOf('*/', i + 2);
            const endIdx = closeIdx !== -1 ? closeIdx + 2 : len;
            out.push(wrapToken('comment', code.slice(i, endIdx)));
            i = endIdx;
            continue;
        }

        // 4. Single-line `//` comments (all C-family, Go, Rust, Swift, TS, Kotlin, Java, PHP)
        if (ch === '/' && next === '/' && lang !== 'sh' && lang !== 'python' && lang !== 'ruby' && lang !== 'json') {
            const nlIdx = code.indexOf(String.fromCharCode(10), i + 2);
            const endIdx = nlIdx !== -1 ? nlIdx : len;
            out.push(wrapToken('comment', code.slice(i, endIdx)));
            i = endIdx;
            continue;
        }

        // 5. Rust attributes `#[...]` / `#![...]`
        if (lang === 'rust' && ch === '#' && (next === '[' || (next === '!' && code.charAt(i + 2) === '['))) {
            const closeIdx = code.indexOf(']', i + 2);
            const endIdx = closeIdx !== -1 ? closeIdx + 1 : len;
            out.push(wrapToken('type', code.slice(i, endIdx)));
            i = endIdx;
            continue;
        }

        // 6. C / C++ / C# preprocessor directives `#include`, `#pragma`, `#define`, etc.
        if (supportsPreprocessor && ch === '#') {
            const nlIdx = code.indexOf(String.fromCharCode(10), i + 1);
            const endIdx = nlIdx !== -1 ? nlIdx : len;
            out.push(wrapToken('keyword', code.slice(i, endIdx)));
            i = endIdx;
            continue;
        }

        // 7. Hash `#` comments (Python, Ruby, Shell, PHP)
        if (supportsHashComment && ch === '#') {
            const nlIdx = code.indexOf(String.fromCharCode(10), i + 1);
            const endIdx = nlIdx !== -1 ? nlIdx : len;
            out.push(wrapToken('comment', code.slice(i, endIdx)));
            i = endIdx;
            continue;
        }

        // 8. Python prefixed strings (`f"..."`, `r"..."`, `b"..."`, `f'...'`) and triple-quoted strings
        if (lang === 'python' && /^[frb]$/i.test(ch) && (next === '"' || next === "'")) {
            const isTriple = code.startsWith(next.repeat(3), i + 1);
            const delim = isTriple ? next.repeat(3) : next;
            const endIdx = scanStringLiteral(code, i + 1, delim, true);
            out.push(wrapToken('string', code.slice(i, endIdx)));
            i = endIdx;
            continue;
        }

        // 9. Triple-quoted strings (`"""` or `'''`) in Python, Kotlin, Swift
        if (code.startsWith('"""', i) || (lang === 'python' && code.startsWith("'''", i))) {
            const delim = code.slice(i, i + 3);
            const endIdx = scanStringLiteral(code, i, delim, true);
            out.push(wrapToken('string', code.slice(i, endIdx)));
            i = endIdx;
            continue;
        }

        // 10. Standard quoted strings (`"..."`, `'...'`, and backtick `` `...` `` in TS/Go/Sh)
        if (ch === '"' || ch === "'" || (ch === '`' && (lang === 'ts' || lang === 'go' || lang === 'sh'))) {
            // In Rust, `'a` lifetimes should not swallow the rest of the line as an unclosed char literal
            if (lang === 'rust' && ch === "'" && isIdentStart(next) && code.charAt(i + 2) !== "'") {
                let endIdx = i + 2;
                while (isIdentPart(code.charAt(endIdx))) {
                    endIdx++;
                }
                out.push(wrapToken('type', code.slice(i, endIdx)));
                i = endIdx;
                continue;
            }

            const endIdx = scanStringLiteral(code, i, ch, ch !== '`');
            const rawStr = code.slice(i, endIdx);
            if (lang === 'json' && ch === '"' && peekNonSpaceChar(code, endIdx) === ':') {
                out.push(wrapToken('variable', rawStr));
            } else {
                out.push(wrapToken('string', rawStr));
            }
            i = endIdx;
            continue;
        }

        // 11. Decorators / Annotations / Ruby instance variables (`@Component`, `@main`, `@Override`, `@ivar`)
        if (ch === '@' && isIdentStart(next)) {
            let endIdx = i + 2;
            while (isIdentPart(code.charAt(endIdx))) {
                endIdx++;
            }
            const kind: SyntaxTokenKind = lang === 'ruby' ? 'variable' : 'type';
            out.push(wrapToken(kind, code.slice(i, endIdx)));
            i = endIdx;
            continue;
        }

        // 12. Shell / PHP / Ruby `$variable`, `${VAR}`, `$0`, `$@`
        if (supportsDollarVar && ch === '$') {
            if (next === '{') {
                const closeIdx = code.indexOf('}', i + 2);
                const endIdx = closeIdx !== -1 ? closeIdx + 1 : len;
                out.push(wrapToken('variable', code.slice(i, endIdx)));
                i = endIdx;
                continue;
            }
            if (isIdentStart(next) || isDigit(next)) {
                let endIdx = i + 2;
                while (isIdentPart(code.charAt(endIdx))) {
                    endIdx++;
                }
                out.push(wrapToken('variable', code.slice(i, endIdx)));
                i = endIdx;
                continue;
            }
        }

        // 13. Ruby `:symbol` literals (when not `::` namespace resolution)
        if (lang === 'ruby' && ch === ':' && isIdentStart(next)) {
            let endIdx = i + 2;
            while (isIdentPart(code.charAt(endIdx))) {
                endIdx++;
            }
            out.push(wrapToken('string', code.slice(i, endIdx)));
            i = endIdx;
            continue;
        }

        // 14. Shell CLI flags (`-X`, `-H`, `--header`, `-d`)
        if (
            lang === 'sh' &&
            ch === '-' &&
            (i === 0 || /\s/.test(code.charAt(i - 1))) &&
            (isIdentStart(next) || (next === '-' && isIdentStart(code.charAt(i + 2))))
        ) {
            let endIdx = i + 1;
            while (isIdentPart(code.charAt(endIdx)) || code.charAt(endIdx) === '-') {
                endIdx++;
            }
            out.push(wrapToken('variable', code.slice(i, endIdx)));
            i = endIdx;
            continue;
        }

        // 15. Numeric literals (decimal, hex `0x...`, float, scientific notation)
        if (isDigit(ch) || (ch === '-' && isDigit(next) && lang === 'json')) {
            let endIdx = i + 1;
            if (ch === '0' && /^[xX]$/.test(next)) {
                endIdx += 1;
                while (/[0-9a-fA-F_]/.test(code.charAt(endIdx))) {
                    endIdx++;
                }
            } else {
                while (/[0-9._eE+-]/.test(code.charAt(endIdx))) {
                    endIdx++;
                }
            }
            out.push(wrapToken('number', code.slice(i, endIdx)));
            i = endIdx;
            continue;
        }

        // 16. Identifiers, Keywords, Built-in Types, Macros, and Function Calls
        if (isIdentStart(ch)) {
            let endIdx = i + 1;
            while (endIdx < len && isIdentPart(code.charAt(endIdx))) {
                endIdx++;
            }
            // Include trailing `?` or `!` for Ruby methods (`defined?`) or Rust macros (`println!`)
            if ((lang === 'rust' && code.charAt(endIdx) === '!') || (lang === 'ruby' && code.charAt(endIdx) === '?')) {
                endIdx++;
            }
            const word = code.slice(i, endIdx);
            const nextChar = peekNonSpaceChar(code, endIdx);

            if (keywords.has(word)) {
                const isLiteralConst = /^(?:true|false|True|False|null|nil|None|nullptr|NULL)$/.test(word);
                out.push(wrapToken(isLiteralConst ? 'number' : 'keyword', word));
            } else if (BUILTIN_TYPES.has(word)) {
                out.push(wrapToken('type', word));
            } else if (nextChar === '(' || (lang === 'rust' && word.endsWith('!'))) {
                out.push(wrapToken('function', word));
            } else if (/^[A-Z]/.test(word) && !/^[A-Z0-9_]+$/.test(word)) {
                out.push(wrapToken('type', word));
            } else {
                out.push(wrapToken('plain', word));
            }
            i = endIdx;
            continue;
        }

        // 17. Multi-character and single-character operators (`->`, `=>`, `::`, `:=`, `==`, `!=`, etc.)
        if ('+-*/%=<>!&|^~?:'.includes(ch)) {
            let endIdx = i + 1;
            while (endIdx < len && '+-*/%=<>!&|^~?:'.includes(code.charAt(endIdx))) {
                endIdx++;
            }
            out.push(wrapToken('operator', code.slice(i, endIdx)));
            i = endIdx;
            continue;
        }

        // 18. Whitespace and punctuation (`{`, `}`, `(`, `)`, `[`, `]`, `;`, `,`, `.`)
        let endIdx = i + 1;
        while (
            endIdx < len &&
            !isIdentStart(code.charAt(endIdx)) &&
            !isDigit(code.charAt(endIdx)) &&
            !'"+-*/%=<>!&|^~?:#@`$\x27'.includes(code.charAt(endIdx))
        ) {
            endIdx++;
        }
        out.push(wrapToken('plain', code.slice(i, endIdx)));
        i = endIdx;
    }

    return out.join('');
}
