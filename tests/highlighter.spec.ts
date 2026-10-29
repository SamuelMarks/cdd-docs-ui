/**
 * Unit tests for the zero-dependency syntax highlighter and tokenizer (`src/highlighter.ts`).
 * @module highlighter.spec
 */
import { describe, it, expect } from 'vitest';
import { escapeTokenHtml, normalizeSyntaxLanguage, highlightCode } from '../src/highlighter';

describe('escapeTokenHtml & normalizeSyntaxLanguage', () => {
    it('should escape HTML special characters in token text', () => {
        expect(escapeTokenHtml(`<tag attr="val" & 'single'>`)).toBe(
            '&lt;tag attr=&quot;val&quot; &amp; &#39;single&#39;&gt;',
        );
    });

    it('should normalize all language aliases into canonical syntax languages', () => {
        expect(normalizeSyntaxLanguage('c')).toBe('c');
        expect(normalizeSyntaxLanguage('cpp')).toBe('cpp');
        expect(normalizeSyntaxLanguage('c++')).toBe('cpp');
        expect(normalizeSyntaxLanguage('cxx')).toBe('cpp');
        expect(normalizeSyntaxLanguage('csharp')).toBe('csharp');
        expect(normalizeSyntaxLanguage('cs')).toBe('csharp');
        expect(normalizeSyntaxLanguage('c#')).toBe('csharp');
        expect(normalizeSyntaxLanguage('dotnet')).toBe('csharp');
        expect(normalizeSyntaxLanguage('go')).toBe('go');
        expect(normalizeSyntaxLanguage('golang')).toBe('go');
        expect(normalizeSyntaxLanguage('java')).toBe('java');
        expect(normalizeSyntaxLanguage('kotlin')).toBe('kotlin');
        expect(normalizeSyntaxLanguage('kt')).toBe('kotlin');
        expect(normalizeSyntaxLanguage('php')).toBe('php');
        expect(normalizeSyntaxLanguage('python')).toBe('python');
        expect(normalizeSyntaxLanguage('python-all')).toBe('python');
        expect(normalizeSyntaxLanguage('py')).toBe('python');
        expect(normalizeSyntaxLanguage('ruby')).toBe('ruby');
        expect(normalizeSyntaxLanguage('rb')).toBe('ruby');
        expect(normalizeSyntaxLanguage('rust')).toBe('rust');
        expect(normalizeSyntaxLanguage('rs')).toBe('rust');
        expect(normalizeSyntaxLanguage('sh')).toBe('sh');
        expect(normalizeSyntaxLanguage('bash')).toBe('sh');
        expect(normalizeSyntaxLanguage('shell')).toBe('sh');
        expect(normalizeSyntaxLanguage('zsh')).toBe('sh');
        expect(normalizeSyntaxLanguage('curl')).toBe('sh');
        expect(normalizeSyntaxLanguage('swift')).toBe('swift');
        expect(normalizeSyntaxLanguage('json')).toBe('json');
        expect(normalizeSyntaxLanguage('ts')).toBe('ts');
        expect(normalizeSyntaxLanguage('typescript')).toBe('ts');
        expect(normalizeSyntaxLanguage('js')).toBe('ts');
        expect(normalizeSyntaxLanguage('javascript')).toBe('ts');
        expect(normalizeSyntaxLanguage('unknown')).toBe('ts');
    });
});

describe('highlightCode across all 13 languages, bash, and json', () => {
    it('should return empty string for empty input', () => {
        expect(highlightCode('', 'ts')).toBe('');
    });

    it('should highlight C and C++ code including preprocessor, comments, hex numbers, and types', () => {
        const cCode = `#include <stdio.h>
/* multi-line\n   comment */
int main(void) {
    // single-line comment
    cdd_c_error_t err = 0x1A;
    const char *msg = "hello \\"world\\"";
    return NULL;
}`;
        const cHtml = highlightCode(cCode, 'c');
        expect(cHtml).toContain('<span class="cdd-tok-keyword">#include &lt;stdio.h&gt;</span>');
        expect(cHtml).toContain('<span class="cdd-tok-comment">/* multi-line\n   comment */</span>');
        expect(cHtml).toContain('<span class="cdd-tok-comment">// single-line comment</span>');
        expect(cHtml).toContain('<span class="cdd-tok-type">cdd_c_error_t</span>');
        expect(cHtml).toContain('<span class="cdd-tok-number">0x1A</span>');
        expect(cHtml).toContain('<span class="cdd-tok-number">NULL</span>');

        // Unclosed comment and preprocessor at EOF
        expect(highlightCode('/* unclosed', 'cpp')).toContain('<span class="cdd-tok-comment">/* unclosed</span>');
        expect(highlightCode('// eof comment', 'cpp')).toContain('<span class="cdd-tok-comment">// eof comment</span>');
        expect(highlightCode('#pragma once', 'cpp')).toContain('<span class="cdd-tok-keyword">#pragma once</span>');
    });

    it('should highlight C#, Java, Kotlin, and Swift including annotations, decorators, and triple-quoted strings', () => {
        const csHtml = highlightCode('using System;\nvar x = await client.GetAsync(true);', 'csharp');
        expect(csHtml).toContain('<span class="cdd-tok-keyword">using</span>');
        expect(csHtml).toContain('<span class="cdd-tok-keyword">await</span>');
        expect(csHtml).toContain('<span class="cdd-tok-function">GetAsync</span>');
        expect(csHtml).toContain('<span class="cdd-tok-number">true</span>');

        const javaHtml = highlightCode('@Override\npublic class Example { int a = 42; }', 'java');
        expect(javaHtml).toContain('<span class="cdd-tok-type">@Override</span>');
        expect(javaHtml).toContain('<span class="cdd-tok-type">Example</span>');

        const ktHtml = highlightCode('suspend fun main() {\n    val raw = """triple"""\n}', 'kotlin');
        expect(ktHtml).toContain('<span class="cdd-tok-keyword">suspend</span>');
        expect(ktHtml).toContain('<span class="cdd-tok-string">&quot;&quot;&quot;triple&quot;&quot;&quot;</span>');

        const swiftHtml = highlightCode('@main\nstruct App {\n    let u = URL(string: "https://a.b")\n}', 'swift');
        expect(swiftHtml).toContain('<span class="cdd-tok-type">@main</span>');
        expect(swiftHtml).toContain('<span class="cdd-tok-type">URL</span>');
    });

    it('should highlight Go, Rust, Python, Ruby, PHP, Shell, TypeScript/Vue, and JSON', () => {
        const goHtml = highlightCode('package main\nfunc main() {\n\ts := `raw`\n\treturn nil\n}', 'go');
        expect(goHtml).toContain('<span class="cdd-tok-keyword">package</span>');
        expect(goHtml).toContain('<span class="cdd-tok-string">`raw`</span>');
        expect(goHtml).toContain('<span class="cdd-tok-number">nil</span>');

        const rustHtml = highlightCode(
            "#[tokio::main]\n#![allow(dead_code)]\nasync fn run<'static>(x: &'static str) {\n    println!(\"hi\");\n    let c = 'z';\n}",
            'rust',
        );
        expect(rustHtml).toContain('<span class="cdd-tok-type">#[tokio::main]</span>');
        expect(rustHtml).toContain('<span class="cdd-tok-type">#![allow(dead_code)]</span>');
        expect(rustHtml).toContain('<span class="cdd-tok-type">&#39;static</span>');
        expect(rustHtml).toContain('<span class="cdd-tok-function">println!</span>');
        expect(rustHtml).toContain('<span class="cdd-tok-string">&#39;z&#39;</span>');
        expect(highlightCode('#[unclosed', 'rust')).toContain('<span class="cdd-tok-type">#[unclosed</span>');

        const pyHtml = highlightCode(
            '# py comment\nfrom m import C\ndef f():\n    s1 = f"val"\n    s2 = r\x27\x27\x27raw\x27\x27\x27\n    s3 = \x27\x27\x27triple\x27\x27\x27\n    return None\n# eof',
            'python',
        );
        expect(pyHtml).toContain('<span class="cdd-tok-comment"># py comment</span>');
        expect(pyHtml).toContain('<span class="cdd-tok-string">f&quot;val&quot;</span>');
        expect(pyHtml).toContain('<span class="cdd-tok-string">r&#39;&#39;&#39;raw&#39;&#39;&#39;</span>');
        expect(pyHtml).toContain('<span class="cdd-tok-string">&#39;&#39;&#39;triple&#39;&#39;&#39;</span>');
        expect(pyHtml).toContain('<span class="cdd-tok-number">None</span>');

        const rbHtml = highlightCode(
            'require "json"\n@ivar = :sym_name\nif defined?(Foo::Bar) && $0\n  puts "unclosed',
            'ruby',
        );
        expect(rbHtml).toContain('<span class="cdd-tok-variable">@ivar</span>');
        expect(rbHtml).toContain('<span class="cdd-tok-string">:sym_name</span>');
        expect(rbHtml).toContain('<span class="cdd-tok-keyword">defined?</span>');
        expect(rbHtml).toContain('<span class="cdd-tok-variable">$0</span>');
        expect(rbHtml).toContain('<span class="cdd-tok-string">&quot;unclosed</span>');

        const phpHtml = highlightCode('<?php\n$client = new ApiClient();\n$res = $client->get();\n?>', 'php');
        expect(phpHtml).toContain('<span class="cdd-tok-keyword">&lt;?php</span>');
        expect(phpHtml).toContain('<span class="cdd-tok-variable">$client</span>');
        expect(phpHtml).toContain('<span class="cdd-tok-keyword">?&gt;</span>');

        const shHtml = highlightCode('curl -X POST --header `cmd` "Auth: ${TOKEN}" ${VAL} $URL ${UNCLOSED', 'bash');
        expect(shHtml).toContain('<span class="cdd-tok-keyword">curl</span>');
        expect(shHtml).toContain('<span class="cdd-tok-variable">-X</span>');
        expect(shHtml).toContain('<span class="cdd-tok-variable">--header</span>');
        expect(shHtml).toContain('<span class="cdd-tok-variable">$URL</span>');
        expect(shHtml).toContain('<span class="cdd-tok-variable">${UNCLOSED</span>');
        expect(highlightCode('$', 'bash')).toBe('$');

        const vueHtml = highlightCode('<script setup>\nconst MAX_VAL = 10;\n</script>\n<script unclosed', 'ts');
        expect(vueHtml).toContain('<span class="cdd-tok-keyword">&lt;script setup&gt;</span>');
        expect(vueHtml).toContain('<span class="cdd-tok-keyword">&lt;/script&gt;</span>');
        expect(vueHtml).toContain('<span class="cdd-tok-keyword">&lt;script unclosed</span>');

        const jsonHtml = highlightCode(
            '{\n  "key": "value",\n  "count": -42.5,\n  "active": true,\n  "nil": null\n}',
            'json',
        );
        expect(jsonHtml).toContain('<span class="cdd-tok-variable">&quot;key&quot;</span>');
        expect(jsonHtml).toContain('<span class="cdd-tok-string">&quot;value&quot;</span>');
        expect(jsonHtml).toContain('<span class="cdd-tok-number">-42.5</span>');
        expect(jsonHtml).toContain('<span class="cdd-tok-number">true</span>');
        expect(jsonHtml).toContain('<span class="cdd-tok-number">null</span>');
    });
});
