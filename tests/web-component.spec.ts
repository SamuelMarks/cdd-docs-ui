/**
 * Unit tests for progressive enhancement and the `<cdd-api-docs>` custom web component (`src/web-component.ts`).
 * @module web-component.spec
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as aotGenerator from '../src/aot-generator';
import { initApiDocs, CDDApiDocs, normalizeSdkExamplesInput, registerWebComponent } from '../src/web-component';

/**
 * Helper to create a `<cdd-api-docs>` custom element.
 * @returns A strongly-typed `CDDApiDocs` element instance.
 */
function createApiDocsElement(): CDDApiDocs {
    return document.createElement('cdd-api-docs');
}

/**
 * Queries a required element matching `selector` and verifies its runtime constructor type.
 * @param root The parent node to query within.
 * @param selector The CSS selector to query.
 * @param ctor The expected element constructor for `instanceof` narrowing.
 * @returns The narrowed element instance.
 */
function getRequiredElement<T extends Element>(root: ParentNode, selector: string, ctor: new () => T): T {
    const el = root.querySelector(selector);
    if (!(el instanceof ctor)) {
        throw new Error(`Expected element matching "${selector}"`);
    }
    return el;
}

describe('normalizeSdkExamplesInput', () => {
    it('should normalize strings, CDDOutput objects, docs.json payloads, operations arrays, and invalid inputs', () => {
        expect(normalizeSdkExamplesInput(null)).toEqual([]);
        expect(normalizeSdkExamplesInput('invalid json')).toEqual([]);
        expect(normalizeSdkExamplesInput(42)).toEqual([]);
        expect(normalizeSdkExamplesInput([null, 123])).toEqual([]);

        const fromObject = normalizeSdkExamplesInput({
            endpoints: {
                '/pets': {
                    get: 'fetch("/pets")',
                    post: '',
                },
            },
        });
        expect(fromObject).toHaveLength(2);
        expect(fromObject[0]?.language).toBe('typescript');
        expect(fromObject[0]?.filepath).toBe('_pets_get');
        expect(fromObject[0]?.content).toBe('fetch("/pets")');
        expect(fromObject[1]?.content).toBe('');

        const fromDocsJson = normalizeSdkExamplesInput([
            {
                language: 'ruby',
                filepath: 'docs.json',
                content: JSON.stringify({
                    endpoints: {
                        '/pets': {
                            get: "puts 'hello pets'",
                            post: '',
                        },
                        '/invalid': 'not-an-object',
                    },
                }),
            },
            {
                filepath: 'ops.json',
                content: JSON.stringify([
                    null,
                    {
                        language: 'go',
                        operations: [
                            null,
                            {
                                path: '/items',
                                method: 'POST',
                                code: { snippet: 'fmt.Println("items")' },
                            },
                            {
                                code: {},
                            },
                            {
                                path: '/no-code',
                                method: 'GET',
                            },
                        ],
                    },
                    {
                        language: 'rust',
                        operations: 'not-array',
                    },
                    {
                        operations: [],
                    },
                ]),
            },
            {
                language: 'python',
                filepath: 'docs.json',
                content: '{"endpoints": malformed',
            },
            {
                language: 'python',
                filepath: 'other.json',
                content: JSON.stringify({ unrelated: true }),
            },
            {
                endpoints: {
                    '/inline': { delete: 'del()' },
                    '/bad': null,
                },
            },
            {
                filepath: 'raw.ts',
                content: 'console.log(1)',
                includeImports: true,
                includeWrapping: false,
            },
            {
                language: 'python',
                filepath: 'no-content.py',
            },
        ]);

        expect(fromDocsJson.some(e => e.language === 'ruby' && e.filepath === '_pets_get')).toBe(true);
        expect(fromDocsJson.some(e => e.language === 'go' && e.filepath === '_items_post')).toBe(true);
        expect(fromDocsJson.some(e => e.language === 'typescript' && e.filepath === '_inline_delete')).toBe(true);
        const rawTs = fromDocsJson.find(e => e.filepath === 'raw.ts');
        expect(rawTs?.includeImports).toBe(true);
        expect(rawTs?.includeWrapping).toBe(false);
    });
});

describe('progressive-enhancement', () => {
    beforeEach(() => {
        let store: Record<string, string> = {};
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: (key: string) => store[key] || null,
                setItem: (key: string, value: string) => {
                    store[key] = value.toString();
                },
                removeItem: (key: string) => {
                    delete store[key];
                },
                clear: () => {
                    store = {};
                },
            },
            writable: true,
        });

        document.body.innerHTML = `
      <input type="radio" id="lang-opt-rust" name="global-lang">
      <input type="checkbox" id="opt-imports">
      <input type="checkbox" id="opt-wrapping">
      
      <div class="cdd-layout">
        <aside class="cdd-sidebar-right">
          <div class="cdd-sidebar-title">Settings</div>
          <input type="radio" name="ui-lang-proxy" id="proxy-rust">
          <input type="checkbox" data-onchange-proxy="document.getElementById('opt-imports').checked = this.checked">
          <input type="checkbox" data-onchange-proxy="document.getElementById('opt-wrapping').checked = this.checked">
        </aside>
        <aside class="cdd-sidebar-left">
           <div class="cdd-sidebar-title">Paths</div>
           <a href="#get-users" class="cdd-toc-item">GET /users</a>
        </aside>
        <main class="cdd-main">
           <article id="get-users" class="cdd-endpoint">Content</article>
           <div style="position: relative;">
             <button class="cdd-copy-btn">Copy</button>
             <pre><code>Some test code</code></pre>
           </div>
           <div style="position: relative;">
             <div class="no-code-parent">
               <button class="cdd-copy-btn">Copy</button>
             </div>
           </div>
        </main>
      </div>
    `;
    });

    it('should initialize search without duplicating input on repeated calls and toggle visibility', () => {
        vi.useFakeTimers();

        initApiDocs();
        initApiDocs(); // calling twice must reuse existing .cdd-search-input
        const searchInputs = document.querySelectorAll<HTMLInputElement>('.cdd-search-input');
        expect(searchInputs.length).toBe(1);

        const searchInput = getRequiredElement(document, '.cdd-search-input', HTMLInputElement);
        expect(searchInput.getAttribute('aria-label')).toBe('Search endpoints...');

        const item = getRequiredElement(document, '.cdd-toc-item', HTMLElement);
        const section = getRequiredElement(document, '.cdd-endpoint', HTMLElement);

        searchInput.value = 'non';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.value = 'nonexistent';
        searchInput.dispatchEvent(new Event('input'));
        vi.advanceTimersByTime(200);
        expect(item.style.display).toBe('none');
        expect(section.style.display).toBe('none');

        searchInput.value = 'users';
        searchInput.dispatchEvent(new Event('input'));
        vi.advanceTimersByTime(200);
        expect(item.style.display).toBe('block');
        expect(section.style.display).toBe('grid');

        vi.useRealTimers();
    });

    it('should handle search on elements lacking textContent or href', () => {
        vi.useFakeTimers();
        document.body.innerHTML = `
            <input type="text" class="cdd-search-input" />
            <a class="cdd-toc-item"></a>
            <article class="cdd-endpoint"></article>
        `;
        const item = getRequiredElement(document, '.cdd-toc-item', HTMLElement);
        const endpoint = getRequiredElement(document, '.cdd-endpoint', HTMLElement);
        Object.defineProperty(item, 'textContent', { value: null });
        Object.defineProperty(endpoint, 'textContent', { value: null });

        initApiDocs();
        const searchInput = getRequiredElement(document, '.cdd-search-input', HTMLInputElement);
        searchInput.value = 'test';
        searchInput.dispatchEvent(new Event('input'));
        vi.advanceTimersByTime(200);

        expect(item.style.display).toBe('none');
        expect(endpoint.style.display).toBe('none');
        vi.useRealTimers();
    });

    it('should sync proxies with hidden inputs and handle missing target inputs gracefully', () => {
        initApiDocs();

        const rustProxy = getRequiredElement(document, '#proxy-rust', HTMLInputElement);
        const rustReal = getRequiredElement(document, '#lang-opt-rust', HTMLInputElement);

        rustProxy.checked = true;
        rustProxy.dispatchEvent(new Event('change'));
        expect(rustReal.checked).toBe(true);

        const importsProxy = getRequiredElement(
            document,
            'input[data-onchange-proxy*="opt-imports"]',
            HTMLInputElement,
        );
        const importsReal = getRequiredElement(document, '#opt-imports', HTMLInputElement);

        importsProxy.checked = true;
        importsProxy.dispatchEvent(new Event('change'));
        expect(importsReal.checked).toBe(true);

        const wrappingProxy = getRequiredElement(
            document,
            'input[data-onchange-proxy*="opt-wrapping"]',
            HTMLInputElement,
        );
        const wrappingReal = getRequiredElement(document, '#opt-wrapping', HTMLInputElement);

        wrappingProxy.checked = true;
        wrappingProxy.dispatchEvent(new Event('change'));
        expect(wrappingReal.checked).toBe(true);

        // Now remove real inputs and verify proxy events do not throw
        rustReal.remove();
        importsReal.remove();
        wrappingReal.remove();
        rustProxy.dispatchEvent(new Event('change'));
        importsProxy.dispatchEvent(new Event('change'));
        wrappingProxy.dispatchEvent(new Event('change'));
        expect(document.getElementById('lang-opt-rust')).toBeNull();
    });

    it('should persist theme to localStorage', () => {
        localStorage.setItem('cdd-theme', 'dark');

        const themeInput = document.createElement('input');
        themeInput.type = 'checkbox';
        themeInput.id = 'opt-dark-mode';
        document.body.appendChild(themeInput);

        initApiDocs();
        expect(themeInput.checked).toBe(true);

        themeInput.checked = false;
        themeInput.dispatchEvent(new Event('change'));
        expect(localStorage.getItem('cdd-theme')).toBe('light');

        themeInput.checked = true;
        themeInput.dispatchEvent(new Event('change'));
        expect(localStorage.getItem('cdd-theme')).toBe('dark');
    });

    it('should setup copy buttons and copy to clipboard', async () => {
        vi.useFakeTimers();
        let clipboardText = '';
        Object.assign(navigator, {
            clipboard: {
                writeText: async (text: string) => {
                    if (text === 'error_trigger') throw new Error('Clipboard error');
                    clipboardText = text;
                },
            },
        });

        initApiDocs();

        const buttons = document.querySelectorAll<HTMLButtonElement>('.cdd-copy-btn');
        expect(buttons.length).toBe(2);

        const validBtn = buttons[0]!;
        const invalidBtn = buttons[1]!;

        invalidBtn.click();
        await Promise.resolve();
        expect(clipboardText).toBe('');

        validBtn.click();
        await Promise.resolve();
        expect(clipboardText).toBe('Some test code');
        expect(validBtn.textContent).toBe('Copied!');
        expect(validBtn.classList.contains('cdd-copied')).toBe(true);

        vi.advanceTimersByTime(2000);
        expect(validBtn.textContent).toBe('Copy');
        expect(validBtn.classList.contains('cdd-copied')).toBe(false);

        const codeEl = validBtn.parentElement?.querySelector('code');
        if (codeEl) {
            Object.defineProperty(codeEl, 'textContent', { value: null, configurable: true });
            validBtn.click();
            await Promise.resolve();
            expect(clipboardText).toBe('');

            Object.defineProperty(codeEl, 'textContent', {
                value: 'error_trigger',
                configurable: true,
            });
            validBtn.click();
            await Promise.resolve();
        }

        // Detached button without parentElement
        const detachedBtn = document.createElement('button');
        detachedBtn.className = 'cdd-copy-btn';
        document.body.appendChild(detachedBtn);
        initApiDocs();
        Object.defineProperty(detachedBtn, 'parentElement', { value: null });
        detachedBtn.click();
        await Promise.resolve();

        vi.useRealTimers();
    });

    it('should handle Try It Out form submissions including dynamic gateway proxy routing', async () => {
        const formHtml = `
      <form class="cdd-try-form" method="POST" data-method="POST" data-route="/users/{id}">
        <input name="id" data-in="path" value="123">
        <input name="q" data-in="query" value="search">
        <input name="X-Api-Key" data-in="header" value="secret">
        <textarea name="requestBody">{"name":"test"}</textarea>
        <button type="submit">Execute</button>
      </form>
      <div class="cdd-try-response" style="display: none;">
        <div class="cdd-try-status"></div>
        <pre><code class="cdd-try-body"></code></pre>
      </div>
    `;
        const main = document.querySelector('.cdd-main');
        if (main) main.innerHTML += formHtml;

        initApiDocs();

        let capturedUrl = '';
        let capturedMethod: string | undefined;
        let capturedHeaders: Record<string, string> = {};
        let capturedBody: BodyInit | null | undefined;
        global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
            capturedUrl = url;
            capturedMethod = init?.method;
            if (init?.headers && !(init.headers instanceof Headers) && !Array.isArray(init.headers)) {
                capturedHeaders = init.headers;
            }
            capturedBody = init?.body;
            return {
                status: 200,
                statusText: 'OK',
                text: async () => '{"success":true}',
            };
        });

        const form = getRequiredElement(document, '.cdd-try-form', HTMLFormElement);
        form.dispatchEvent(new Event('submit', { cancelable: true }));
        await new Promise(r => setTimeout(r, 10));

        expect(capturedUrl).toBe('https://api.example.com/users/123?q=search');
        expect(capturedMethod).toBe('POST');
        expect(capturedHeaders['X-Api-Key']).toBe('secret');
        expect(capturedHeaders['Content-Type']).toBe('application/json');
        expect(capturedBody).toBe('{"name":"test"}');

        const statusEl = getRequiredElement(document, '.cdd-try-status', HTMLElement);
        const bodyEl = getRequiredElement(document, '.cdd-try-body', HTMLElement);
        expect(statusEl.textContent).toBe('Status: 200 OK');
        expect(bodyEl.textContent).toContain('success');

        // Error case
        global.fetch = vi.fn().mockRejectedValue(new Error('Network fail'));
        form.dispatchEvent(new Event('submit', { cancelable: true }));
        await new Promise(r => setTimeout(r, 10));
        expect(statusEl.textContent).toBe('Error');
        expect(bodyEl.textContent).toBe('Network fail');

        // Empty input & non-JSON response fallback
        const emptyInput = document.createElement('input');
        emptyInput.name = 'empty';
        emptyInput.value = '';
        form.appendChild(emptyInput);

        global.fetch = vi.fn().mockImplementation(async () => ({
            status: 404,
            statusText: 'Not Found',
            text: async () => 'Not found plaintext',
        }));
        form.dispatchEvent(new Event('submit', { cancelable: true }));
        await new Promise(r => setTimeout(r, 10));
        expect(bodyEl.textContent).toBe('Not found plaintext');
    });

    it('should handle Try It Out edge cases (missing response container, missing status/body elements, GET method, string errors)', async () => {
        document.body.innerHTML = `
      <form id="form-no-resp" class="cdd-try-form" method="GET"></form>
      <div class="not-try-response"></div>
      <form id="form-empty-resp" class="cdd-try-form" method="PUT">
        <input name="cookieParam" data-in="cookie" value="ignored">
        <input name="Content-Type" data-in="header" value="text/plain">
        <textarea name="requestBody">raw</textarea>
      </form>
      <div class="cdd-try-response"></div>
      <form id="form-full-resp" class="cdd-try-form" method="POST" data-method="POST" data-route="/ping"></form>
      <div class="cdd-try-response">
        <div class="cdd-try-status"></div>
        <div class="cdd-try-body"></div>
      </div>
    `;
        initApiDocs();

        global.fetch = vi.fn().mockResolvedValue({
            status: 200,
            statusText: 'OK',
            text: async () => 'OK',
        });

        const formNoResp = getRequiredElement(document, '#form-no-resp', HTMLFormElement);
        formNoResp.dispatchEvent(new Event('submit', { cancelable: true }));
        await new Promise(r => setTimeout(r, 10));
        expect(global.fetch).not.toHaveBeenCalled();

        const formEmptyResp = getRequiredElement(document, '#form-empty-resp', HTMLFormElement);
        formEmptyResp.dispatchEvent(new Event('submit', { cancelable: true }));
        await new Promise(r => setTimeout(r, 10));
        expect(global.fetch).toHaveBeenCalledTimes(1);

        global.fetch = vi.fn().mockRejectedValue('String error');
        formEmptyResp.dispatchEvent(new Event('submit', { cancelable: true }));
        await new Promise(r => setTimeout(r, 10));

        const formFullResp = getRequiredElement(document, '#form-full-resp', HTMLFormElement);
        formFullResp.dispatchEvent(new Event('submit', { cancelable: true }));
        await new Promise(r => setTimeout(r, 10));
        const bodyEl = document.querySelector('#form-full-resp + .cdd-try-response .cdd-try-body');
        expect(bodyEl?.textContent).toBe('String error');
    });

    describe('CDDApiDocs Custom Element', () => {
        it('should preserve BOTH <style> blocks (.no-js and main layout CSS) when rendering spec', async () => {
            const el = createApiDocsElement();
            el.setAttribute('theme', 'dark');
            document.body.appendChild(el);

            await el.renderSpec(`openapi: 3.0.0
info:
  title: Styled API
  version: 1.0.0`);
            expect(el.innerHTML).toContain('.no-js .cdd-copy-btn');
            expect(el.innerHTML).toContain('.cdd-layout');
            expect(el.innerHTML).toContain('--cdd-primary: #005ac1');
        });

        it('should unroll docs.json snippets via sdkExamples setter', () => {
            const el = createApiDocsElement();
            el.sdkExamples = [
                {
                    language: 'ruby',
                    filepath: 'docs.json',
                    content: JSON.stringify({
                        endpoints: {
                            '/pets': {
                                get: "puts 'hello pets'",
                            },
                        },
                    }),
                },
            ];
            expect(el.sdkExamples).toHaveLength(1);
            expect(el.sdkExamples[0]?.language).toBe('ruby');
            expect(el.sdkExamples[0]?.content).toBe("puts 'hello pets'");
            expect(el.sdkExamples[0]?.filepath).toBe('_pets_get');
        });

        it('should allow getting and setting translations and re-rendering', () => {
            const el = createApiDocsElement();
            expect(el.translations).toEqual({});
            el.translations = { paths: 'My Paths' };
            expect(el.translations).toEqual({ paths: 'My Paths' });

            const yamlStr = `openapi: 3.0.0
info:
  title: T
  version: 1`;
            el.setAttribute('spec', yamlStr);
            el.translations = { paths: 'Different Paths' };
            expect(el.innerHTML).toContain('Different Paths');

            const el2 = createApiDocsElement();
            el2.innerHTML = '<div class="cdd-layout"><div class="cdd-sidebar-title">Paths</div><span></span></div>';
            document.body.appendChild(el2);
            expect(el2.querySelector('.cdd-search-input')).not.toBeNull();
        });

        it('should handle attributeChangedCallback edge cases', () => {
            const el = createApiDocsElement();
            el.attributeChangedCallback('unknown-attr', 'old', 'new');
            el.attributeChangedCallback('spec', 'same', 'same');
            expect(el.innerHTML).toBe('');
        });

        it('should register and render spec and spec-content attributes', () => {
            const el = createApiDocsElement();
            el.setAttribute(
                'spec',
                `openapi: 3.0.0
info:
  title: Pre Connection API
  version: 1`,
            );
            document.body.appendChild(el);
            expect(el.innerHTML).toContain('Pre Connection API');

            const el2 = createApiDocsElement();
            el2.setAttribute(
                'spec-content',
                `openapi: 3.0.0
info:
  title: Spec Content API
  version: 1`,
            );
            document.body.appendChild(el2);
            expect(el2.innerHTML).toContain('Spec Content API');
        });

        it('should fetch and render spec from URL and handle 404 and non-404 errors', async () => {
            const el = createApiDocsElement();
            document.body.appendChild(el);

            await el.renderSpec('');
            expect(el.innerHTML).toBe('');

            const yamlStr = `openapi: 3.0.0
info:
  title: Fetched URL API
  version: 1.0.1`;
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                text: async () => yamlStr,
            });

            await el.renderSpec('https://example.com/spec.yaml');
            expect(el.innerHTML).toContain('Fetched URL API');
            expect(global.fetch).toHaveBeenCalledWith('https://example.com/spec.yaml');

            // 404 error
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
            });
            await el.renderSpec('example.com/spec.yaml');
            expect(el.innerHTML).toContain(
                '404 Not Found: The specified organization or repository does not exist or has no published schema.',
            );

            // 500 error
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            });
            await el.renderSpec('https://example.com/spec.yaml');
            expect(el.innerHTML).toContain('Failed to fetch spec from URL: 500 Internal Server Error');

            // Non-Error rejection and Error without stack
            global.fetch = vi.fn().mockRejectedValue('Plain rejection');
            await el.renderSpec('https://example.com/spec.yaml');
            expect(el.innerHTML).toContain('Plain rejection');

            const noStackErr = new Error('No stack');
            noStackErr.stack = '';
            global.fetch = vi.fn().mockRejectedValue(noStackErr);
            await el.renderSpec('https://example.com/spec.yaml');
            expect(el.innerHTML).toContain('No stack');
        });

        it('should safely render specs containing literal </body> or </style> strings and discard stale async fetches', async () => {
            const el = createApiDocsElement();
            await el.renderSpec(`openapi: 3.0.0
info:
  title: Literal Closing Tags API
  description: "Contains literal \`</body>\` and \`</style>\` strings"
  version: 1.0.0`);
            expect(el.innerHTML).toContain('Literal Closing Tags API');
            expect(el.innerHTML).toContain('<code>&lt;/body&gt;</code>');
            expect(el.innerHTML).toContain('<code>&lt;/style&gt;</code>');

            // Test stale renderVersion race condition protection on both primary spec fetch and companion Arazzo fetch
            let resolveSlowPrimary: ((val: unknown) => void) | undefined;
            global.fetch = vi.fn().mockImplementation(
                () =>
                    new Promise(resolve => {
                        resolveSlowPrimary = resolve;
                    }),
            );

            const stalePromise = el.renderSpec('https://example.com/slow.yaml');
            await el.renderSpec(`openapi: 3.0.0
info:
  title: Newer Spec Wins
  version: 1.0.0`);
            resolveSlowPrimary?.({
                ok: true,
                text: async () => `openapi: 3.0.0\ninfo:\n  title: Stale Spec\n  version: 1.0.0`,
            });
            await stalePromise;
            expect(el.innerHTML).toContain('Newer Spec Wins');
            expect(el.innerHTML).not.toContain('Stale Spec');

            // Stale companion Arazzo fetch
            let resolveSlowCompanion: ((val: unknown) => void) | undefined;
            global.fetch = vi.fn().mockImplementation(
                () =>
                    new Promise(resolve => {
                        resolveSlowCompanion = resolve;
                    }),
            );
            const staleCompanionPromise = el.renderSpec(
                `openapi: 3.0.0\ninfo:\n  title: Fast Spec\n  version: 1.0.0`,
                'https://example.com/slow-arazzo.yaml',
            );
            await el.renderSpec(`openapi: 3.0.0\ninfo:\n  title: Latest Spec\n  version: 1.0.0`);
            resolveSlowCompanion?.({
                ok: true,
                text: async () =>
                    `arazzo: 1.1.0\ninfo:\n  title: Stale Arazzo\n  version: 1.0.0\nsourceDescriptions: []\nworkflows: []`,
            });
            await staleCompanionPromise;
            expect(el.innerHTML).toContain('Latest Spec');
        });

        it('should handle dynamic routing (/u/:org/:repo), version dropdown change, versions.json, and Try It Out proxy URL', async () => {
            const originalLocation = window.location;
            Object.defineProperty(window, 'location', {
                value: {
                    pathname: '/u/test-org/test-repo',
                    search: '?v=2.0.0',
                    href: 'http://localhost/u/test-org/test-repo?v=2.0.0',
                },
                writable: true,
                configurable: true,
            });
            const pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});

            global.fetch = vi.fn().mockImplementation(async (url: string) => {
                if (url.endsWith('/versions.json')) {
                    return {
                        ok: true,
                        json: async () => ['1.0.0', '2.0.0'],
                    };
                }
                return {
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    text: async () =>
                        `openapi: 3.0.0
info:
  title: Dynamic Test
  version: 2.0.0
paths:
  /items:
    get:
      responses:
        '200':
          description: ok`,
                };
            });

            const el = createApiDocsElement();
            document.body.appendChild(el);
            await new Promise(resolve => setTimeout(resolve, 30));

            expect(el.org).toBe('test-org');
            expect(el.repo).toBe('test-repo');
            expect(global.fetch).toHaveBeenCalledWith('/cdd-gateway/storage/test-org/test-repo/2.0.0/schema.json');
            expect(el.innerHTML).toContain('Version:');
            expect(el.innerHTML).toContain('Download SDKs:');

            const versionSelect = getRequiredElement(el, '.cdd-version-select', HTMLSelectElement);
            expect(versionSelect.value).toBe('2.0.0');

            // Trigger version change
            versionSelect.value = '1.0.0';
            versionSelect.dispatchEvent(new Event('change'));
            await new Promise(resolve => setTimeout(resolve, 30));
            expect(pushStateSpy).toHaveBeenCalled();

            // Submit Try It Out form inside dynamic org/repo element
            const tryForm = getRequiredElement(el, '.cdd-try-form', HTMLFormElement);
            tryForm.dispatchEvent(new Event('submit', { cancelable: true }));
            await new Promise(resolve => setTimeout(resolve, 20));
            expect(global.fetch).toHaveBeenCalledWith(
                '/cdd-gateway/proxy/test-org/test-repo/2.0.0/items',
                expect.any(Object),
            );

            // Also test dynamic routing without ?v= param and rejected versions.json
            Object.defineProperty(window, 'location', {
                value: {
                    pathname: '/u/org2/repo2',
                    search: '',
                    href: 'http://localhost/u/org2/repo2',
                },
                writable: true,
                configurable: true,
            });
            global.fetch = vi.fn().mockImplementation(async (url: string) => {
                if (url.endsWith('/versions.json')) {
                    throw new Error('no versions');
                }
                return {
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    text: async () =>
                        `openapi: 3.0.0
info:
  title: Dynamic No Version
  version: 1.0.0
paths:
  /ping:
    get:
      responses:
        '200':
          description: ok`,
                };
            });

            const el2 = createApiDocsElement();
            document.body.appendChild(el2);
            await new Promise(resolve => setTimeout(resolve, 30));
            expect(global.fetch).toHaveBeenCalledWith('/cdd-gateway/storage/org2/repo2/schema.json');

            const tryForm2 = getRequiredElement(el2, '.cdd-try-form', HTMLFormElement);
            tryForm2.dispatchEvent(new Event('submit', { cancelable: true }));
            await new Promise(resolve => setTimeout(resolve, 20));
            expect(global.fetch).toHaveBeenCalledWith('/cdd-gateway/proxy/org2/repo2/ping', expect.any(Object));

            // Non-array versions.json response and array versions.json response without ?v= param
            let callCount = 0;
            global.fetch = vi.fn().mockImplementation(async (url: string) => {
                if (url.endsWith('/versions.json')) {
                    callCount++;
                    return {
                        ok: true,
                        json: async () => (callCount === 1 ? ['1.0.0'] : { notArray: true }),
                    };
                }
                return {
                    ok: true,
                    text: async () => `openapi: 3.0.0
info:
  title: T
  version: 1`,
                };
            });
            const el3 = createApiDocsElement();
            document.body.appendChild(el3);
            await vi.waitFor(() => {
                expect(el3.querySelector('.cdd-version-select')?.innerHTML).toContain(
                    '<option value="1.0.0">1.0.0</option>',
                );
            });

            const el3b = createApiDocsElement();
            document.body.appendChild(el3b);
            await vi.waitFor(() => {
                expect(el3b.querySelector('.cdd-version-select')?.innerHTML).toContain(
                    '<option value="latest">latest</option>',
                );
            });

            const genSpyNoHeader = vi.spyOn(aotGenerator, 'generateAOTBodyAndStyles').mockReturnValueOnce({
                stylesHtml: '',
                bodyHtml: '<div>No header element</div>',
                title: 'T',
                locale: 'en',
            });
            const el4 = createApiDocsElement();
            document.body.appendChild(el4);
            await vi.waitFor(() => {
                expect(el4.innerHTML).toContain('No header element');
            });
            expect(el4.querySelector('.cdd-dynamic-header-content')).toBeNull();
            genSpyNoHeader.mockRestore();

            Object.defineProperty(window, 'location', {
                value: originalLocation,
                writable: true,
                configurable: true,
            });
        });

        it('should notify parent window on connection and clean up listener on disconnection', () => {
            const parentPostMessage = vi.fn();
            Object.defineProperty(window, 'parent', {
                value: { postMessage: parentPostMessage },
                configurable: true,
            });
            const removeSpy = vi.spyOn(window, 'removeEventListener');

            const el = createApiDocsElement();
            document.body.appendChild(el);
            expect(parentPostMessage).toHaveBeenCalledWith({ type: 'DOCS_UI_READY' }, '*');

            el.remove();
            expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));
        });

        it('should handle postMessage UPDATE_SPEC and SET_THEME accurately', async () => {
            const el = createApiDocsElement();
            document.body.appendChild(el);

            const yamlStr = `openapi: 3.0.0
info:
  title: PostMessage API
  version: 1.0.1`;
            window.dispatchEvent(
                new MessageEvent('message', {
                    data: { type: 'UPDATE_SPEC', payload: yamlStr },
                }),
            );
            await new Promise(resolve => setTimeout(resolve, 20));
            expect(el.innerHTML).toContain('PostMessage API');

            // SET_THEME when #opt-dark-mode checkbox is rendered
            window.dispatchEvent(
                new MessageEvent('message', {
                    data: { type: 'SET_THEME', payload: 'dark' },
                }),
            );
            const themeInput = el.querySelector<HTMLInputElement>('#opt-dark-mode');
            expect(themeInput).not.toBeNull();
            expect(themeInput?.checked).toBe(true);
            expect(localStorage.getItem('cdd-theme')).toBe('dark');

            // SET_THEME when innerHTML is empty
            el.innerHTML = '';
            window.dispatchEvent(
                new MessageEvent('message', {
                    data: { type: 'SET_THEME', payload: 'light' },
                }),
            );
            expect(localStorage.getItem('cdd-theme')).toBe('light');

            // Ignore invalid messages
            const beforeHTML = el.innerHTML;
            window.dispatchEvent(new MessageEvent('message', { data: null }));
            window.dispatchEvent(new MessageEvent('message', { data: 'not an object' }));
            window.dispatchEvent(new MessageEvent('message', { data: { type: 'UNKNOWN' } }));
            expect(el.innerHTML).toBe(beforeHTML);
        });

        it('should handle DOMContentLoaded standalone initialization and registerWebComponent', () => {
            registerWebComponent();
            document.body.innerHTML =
                '<div class="cdd-layout"><div class="cdd-sidebar-title">Paths</div><span></span></div>';
            window.dispatchEvent(new Event('DOMContentLoaded'));
            expect(document.querySelector('.cdd-search-input')).not.toBeNull();

            document.body.innerHTML = '<cdd-api-docs></cdd-api-docs>';
            window.dispatchEvent(new Event('DOMContentLoaded'));
            expect(document.querySelector('cdd-api-docs')).not.toBeNull();
        });

        it('should handle Arazzo workflow Try-It-Out forms, companion Arazzo URLs, UPDATE_ARAZZO, and workflow/webhook sdkExamples', async () => {
            // 1. Test normalizeSdkExamplesInput via sdkExamples setter for workflows, webhooks, structured code, and array operations
            const el = createApiDocsElement();
            el.sdkExamples = { workflows: { singleWf: 'singleWfCode()' } };
            expect(el.sdkExamples).toHaveLength(1);
            el.sdkExamples = { webhooks: { singleWh: { post: 'singleWhCode()' } } };
            expect(el.sdkExamples).toHaveLength(1);
            el.sdkExamples = [
                {
                    language: 'rust',
                    endpoints: {
                        '/pets': {
                            get: { snippet: 'rustPets()' },
                            post: 0,
                        },
                        '/bad': 'not-record',
                    },
                    webhooks: {
                        petHook: {
                            post: 'rustWebhook()',
                        },
                    },
                    workflows: {
                        adoptWf: 'rustWf()',
                        structWf: { snippet: 'rustStructWf()' },
                        numWf: 0,
                    },
                },
                {
                    language: 'python',
                    workflows: {
                        onlyPyWf: 'pyWf()',
                    },
                },
                {
                    language: 'go',
                    filepath: 'docs.json',
                    content: JSON.stringify([
                        {
                            language: 'go',
                            operations: [
                                {
                                    method: 'WORKFLOW',
                                    path: '/workflows/goWf',
                                    operationId: 'goWf',
                                    code: 'goWfCode()',
                                },
                                {
                                    method: 'WORKFLOW',
                                    path: '/workflows/pathOnlyWf',
                                    code: { snippet: 'pathOnlyWfCode()' },
                                },
                                {
                                    method: 'WORKFLOW',
                                    path: '',
                                    code: 123,
                                },
                            ],
                        },
                    ]),
                },
            ];
            expect(el.sdkExamples.some(ex => ex.filepath === 'workflow_adoptWf')).toBe(true);
            expect(el.sdkExamples.some(ex => ex.filepath === 'workflow_structWf')).toBe(true);
            expect(el.sdkExamples.some(ex => ex.filepath === 'workflow_goWf')).toBe(true);
            expect(el.sdkExamples.some(ex => ex.filepath === 'workflow_pathOnlyWf')).toBe(true);

            // 2. Test interactive workflow Try-It-Out form submission (success, error, non-Error, and missing response container)
            document.body.innerHTML = `
                <article class="cdd-endpoint cdd-workflow">
                    <div class="cdd-step-card" data-step-id="s1" data-method="GET" data-route="/step1" data-base-url="https://wf.example.com/"></div>
                    <div class="cdd-step-card"></div>
                    <form id="wf-form-ok" class="cdd-workflow-try-form" data-workflow-id="wf1" data-base-url="https://wf.example.com">
                        <button type="submit">Run</button>
                    </form>
                    <div class="cdd-try-response">
                        <div class="cdd-try-status"></div>
                        <pre><code class="cdd-try-body"></code></pre>
                    </div>
                </article>
                <form id="wf-form-detached" class="cdd-workflow-try-form">
                    <button type="submit">Run</button>
                </form>
                <div class="cdd-try-response">
                </div>
                <form id="wf-form-no-resp" class="cdd-workflow-try-form"></form>
            `;
            initApiDocs(document);
            // Calling initApiDocs a second time should be idempotent and not duplicate listeners
            initApiDocs(document);

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                text: async () => '{"step":"done"}',
            });

            const wfFormOk = getRequiredElement(document, '#wf-form-ok', HTMLFormElement);
            wfFormOk.dispatchEvent(new Event('submit', { cancelable: true }));
            await vi.waitFor(() => {
                expect(document.querySelector('.cdd-try-status')?.textContent).toContain('wf1 (2 steps completed)');
            });
            expect(global.fetch).toHaveBeenCalledTimes(2);
            expect(global.fetch).toHaveBeenCalledWith('https://wf.example.com/step1', { method: 'GET' });

            const wfFormDetached = getRequiredElement(document, '#wf-form-detached', HTMLFormElement);
            wfFormDetached.dispatchEvent(new Event('submit', { cancelable: true }));
            await vi.waitFor(() => {
                const respDiv = document.querySelector<HTMLElement>('#wf-form-detached + .cdd-try-response');
                expect(respDiv?.style.display).toBe('block');
            });

            const wfFormNoResp = getRequiredElement(document, '#wf-form-no-resp', HTMLFormElement);
            wfFormNoResp.dispatchEvent(new Event('submit', { cancelable: true }));
            expect(global.fetch).toHaveBeenCalledTimes(2);

            global.fetch = vi.fn().mockRejectedValueOnce(new Error('WF Network Error'));
            wfFormOk.dispatchEvent(new Event('submit', { cancelable: true }));
            await vi.waitFor(() => {
                expect(document.querySelector('.cdd-try-body')?.textContent).toBe('WF Network Error');
            });

            global.fetch = vi.fn().mockRejectedValueOnce('WF String Error');
            wfFormOk.dispatchEvent(new Event('submit', { cancelable: true }));
            await vi.waitFor(() => {
                expect(document.querySelector('.cdd-try-body')?.textContent).toBe('WF String Error');
            });

            // Test error on form with empty .cdd-try-response (no statusEl or bodyEl) via a failing step
            document.body.innerHTML = `
                <article class="cdd-endpoint cdd-workflow">
                    <div class="cdd-step-card" data-step-id="s1" data-method="GET" data-route="/step1"></div>
                    <form id="wf-form-empty-resp" class="cdd-workflow-try-form">
                        <button type="submit">Run</button>
                    </form>
                    <div class="cdd-try-response"></div>
                </article>
            `;
            initApiDocs(document);
            global.fetch = vi.fn().mockRejectedValueOnce(new Error('Empty Resp Error'));
            const wfFormEmptyResp = getRequiredElement(document, '#wf-form-empty-resp', HTMLFormElement);
            wfFormEmptyResp.dispatchEvent(new Event('submit', { cancelable: true }));
            await vi.waitFor(() => {
                expect(global.fetch).toHaveBeenCalledTimes(1);
            });

            // 3. Test companion Arazzo URL fetching (ok and non-ok) and UPDATE_ARAZZO postMessage
            global.fetch = vi.fn().mockImplementation(async (url: string) => {
                if (url.includes('fail-arazzo')) {
                    return { ok: false, status: 500, statusText: 'Err' };
                }
                return {
                    ok: true,
                    text: async () =>
                        JSON.stringify({
                            arazzo: '1.1.0',
                            info: { title: 'Remote Arazzo', version: '1.0.0' },
                            sourceDescriptions: [{ name: 'api', url: './openapi.json' }],
                            workflows: [{ workflowId: 'remoteWf', steps: [{ stepId: 'rs1' }] }],
                        }),
                };
            });

            const elComp = createApiDocsElement();
            elComp.setAttribute(
                'spec-content',
                JSON.stringify({
                    openapi: '3.2.0',
                    info: { title: 'Primary OpenAPI', version: '1.0.0' },
                    paths: {},
                }),
            );
            elComp.setAttribute('arazzo', 'example.com/arazzo.json');
            document.body.appendChild(elComp);
            await new Promise(r => setTimeout(r, 30));
            expect(elComp.innerHTML).toContain('remoteWf');

            elComp.setAttribute('arazzo', 'https://example.com/fail-arazzo.json');
            await new Promise(r => setTimeout(r, 30));
            expect(elComp.innerHTML).toContain('Primary OpenAPI');

            window.dispatchEvent(
                new MessageEvent('message', {
                    data: {
                        type: 'UPDATE_ARAZZO',
                        payload: JSON.stringify({
                            arazzo: '1.1.0',
                            info: { title: 'PostMessage Arazzo', version: '1.0.0' },
                            sourceDescriptions: [],
                            workflows: [{ workflowId: 'pmWf', steps: [{ stepId: 'pms1' }] }],
                        }),
                    },
                }),
            );
            await new Promise(r => setTimeout(r, 30));
            expect(elComp.innerHTML).toContain('pmWf');
        });
    });
});
