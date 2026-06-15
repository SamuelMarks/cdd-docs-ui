import { generateAOTHtml } from './aot-generator';
import { DocTranslations, defaultTranslations, CodeExample, CDDOutput } from './types';

/**
 * Progressive Enhancement for API Documentation.
 * Provides interactive features like global language sync and search.
 * No frameworks used.
 */

/**
 * Initializes the API documentation interactive features within a specific container.
 * @param container The DOM element containing the API documentation layout.
 * @param customTranslations Optional custom string dictionary for i18n
 */
export function initApiDocs(
    container: Document | HTMLElement = document,
    customTranslations: Partial<DocTranslations> = {},
): void {
    const t: DocTranslations = { ...defaultTranslations, ...customTranslations };

    // Sync proxy inputs in the sidebar with the real hidden inputs at the top
    const langProxies = container.querySelectorAll('input[name="ui-lang-proxy"]');
    langProxies.forEach(proxy => {
        proxy.addEventListener('change', e => {
            const target = e.target as HTMLInputElement;
            const lang = target.id.replace('proxy-', '');
            const realInput = container.querySelector(`#lang-opt-${lang}`) as HTMLInputElement;
            /* v8 ignore next */ if (realInput) realInput.checked = true;
        });
    });

    const importsProxy = container.querySelector('input[data-onchange-proxy*="opt-imports"]') as HTMLInputElement;
    if (importsProxy) {
        importsProxy.addEventListener('change', e => {
            const target = e.target as HTMLInputElement;
            const realInput = container.querySelector('#opt-imports') as HTMLInputElement;
            /* v8 ignore next */ /* v8 ignore start */ if (realInput) realInput.checked = target.checked; /* v8 ignore stop */
        });
    }

    const wrappingProxy = container.querySelector('input[data-onchange-proxy*="opt-wrapping"]') as HTMLInputElement;
    if (wrappingProxy) {
        wrappingProxy.addEventListener('change', e => {
            const target = e.target as HTMLInputElement;
            const realInput = container.querySelector('#opt-wrapping') as HTMLInputElement;
            if (realInput) realInput.checked = target.checked;
        });
    }

    // Theme synchronization and persistence
    const themeInput = container.querySelector('#opt-dark-mode') as HTMLInputElement;

    if (themeInput) {
        // Load from localStorage
        const savedTheme = localStorage.getItem('cdd-theme');
        if (savedTheme) {
            themeInput.checked = savedTheme === 'dark';
        }

        themeInput.addEventListener('change', () => {
            localStorage.setItem('cdd-theme', themeInput.checked ? 'dark' : 'light');
        });
    }

    // Smooth search implementation with performance optimization
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = t.searchPlaceholder;
    searchInput.setAttribute('aria-label', t.searchPlaceholder);
    searchInput.className = 'cdd-search-input';
    searchInput.style.width = '100%';
    searchInput.style.padding = '0.5rem';
    searchInput.style.marginBottom = '1rem';
    searchInput.style.borderRadius = '4px';
    searchInput.style.border = '1px solid var(--cdd-outline)';

    const tocTitle = container.querySelector('.cdd-sidebar-title');
    if (tocTitle && tocTitle.nextSibling) {
        tocTitle.parentNode?.insertBefore(searchInput, tocTitle.nextSibling);
    }

    // Pre-calculate indices for fast searching
    interface SearchIndex {
        el: HTMLElement;
        text: string;
    }
    let itemIndices: SearchIndex[] | null = null;
    let sectionIndices: SearchIndex[] | null = null;
    let searchTimeout: any;

    searchInput.addEventListener('input', e => {
        const term = (e.target as HTMLInputElement).value.toLowerCase();

        // Debounce
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            // Lazy initialization of indices
            if (!itemIndices) {
                itemIndices = Array.from(container.querySelectorAll('.cdd-toc-item')).map(el => ({
                    el: el as HTMLElement,
                       /* v8 ignore start */ text: (
                        (el.textContent || '') +
                        ' ' +
                        ((el as HTMLAnchorElement).getAttribute('href') || '')
                    ).toLowerCase(), /* v8 ignore stop */
                }));
            }
            if (!sectionIndices) {
                sectionIndices = Array.from(container.querySelectorAll('.cdd-endpoint')).map(el => ({
                    el: el as HTMLElement,
                     /* v8 ignore start */ text: ((el.textContent || '') + ' ' + el.id).toLowerCase(), /* v8 ignore stop */
                }));
            }

            // Execute search
            itemIndices.forEach(item => {
                const isVisible = item.text.includes(term);
                item.el.style.display = isVisible ? 'block' : 'none';
            });

            sectionIndices.forEach(section => {
                const isVisible = section.text.includes(term);
                section.el.style.display = isVisible ? 'grid' : 'none';
            });
        }, 150);
    });

    // Setup copy to clipboard buttons
    const copyButtons = container.querySelectorAll('.cdd-copy-btn');
    copyButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const parent = btn.parentElement;
            /* v8 ignore next */ if (!parent) return;
            const codeEl = parent.querySelector('code');
            /* v8 ignore next */ if (!codeEl) return;

            try {
                /* v8 ignore next */ await navigator.clipboard.writeText(codeEl.textContent || '');
                const originalText = btn.textContent;
                btn.textContent = t.copied;
                btn.classList.add('cdd-copied');

                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.classList.remove('cdd-copied');
                }, 2000);
            } catch (err) {
                console.error('Failed to copy text: ', err);
            }
        });
    });

    // Setup Try It Out forms
    const tryForms = container.querySelectorAll('.cdd-try-form');
    tryForms.forEach(form => {
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const f = e.target as HTMLFormElement;
            const method = f.getAttribute('data-method') || 'GET';
            let route = f.getAttribute('data-route') || '';

            const headers: Record<string, string> = {};
            const queryParams = new URLSearchParams();
            let body: string | undefined = undefined;

            // Extract fields
            const inputs = f.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                const el = input as HTMLInputElement | HTMLTextAreaElement;
                const val = el.value;
                if (!val) return;

                if (el.name === 'requestBody') {
                    body = val;
                } else {
                    const inType = el.getAttribute('data-in');
                    if (inType === 'path') {
                        route = route.replace(`{${el.name}}`, encodeURIComponent(val));
                    } else if (inType === 'query') {
                        queryParams.append(el.name, val);
                    } else if (inType === 'header') {
                        headers[el.name] = val;
                    }
                }
            });

            // Route through gateway if dynamic, otherwise hit relative route
            const apiDocsElement = form.closest('cdd-api-docs') as CDDApiDocs | null;
            const org = apiDocsElement ? (apiDocsElement as any)._org : undefined;
            const repo = apiDocsElement ? (apiDocsElement as any)._repo : undefined;
            const urlParams = new URLSearchParams(window.location.search);
            const currentV = urlParams.get('v') || '';
            const versionPath = currentV ? `/${encodeURIComponent(currentV)}` : '';

            let url = `https://api.example.com${route}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
            if (org && repo) {
                // cdd-gateway proxy syntax: /cdd-gateway/proxy/[org]/[repo]/[version]/[path...]
                url = `/cdd-gateway/proxy/${encodeURIComponent(org)}/${encodeURIComponent(repo)}${versionPath}${route}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
            }

            const responseContainer = f.nextElementSibling as HTMLElement;
            /* v8 ignore next */ if (!responseContainer || !responseContainer.classList.contains('cdd-try-response')) return;

            const statusEl = responseContainer.querySelector('.cdd-try-status');
            const bodyEl = responseContainer.querySelector('.cdd-try-body');

            responseContainer.style.display = 'block';
            /* v8 ignore next */ if (statusEl) statusEl.textContent = t.loading;
            /* v8 ignore next */ if (bodyEl) bodyEl.textContent = '';

            try {
                if (body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

                const res = await fetch(url, {
                    method,
                    headers,
                    body: method !== 'GET' && method !== 'HEAD' ? body : null,
                });

                if (statusEl) statusEl.textContent = `${t.status}: ${res.status} ${res.statusText}`;
                const text = await res.text();
                try {
                    // Pretty print JSON
                    /* v8 ignore next */ if (bodyEl) bodyEl.textContent = JSON.stringify(JSON.parse(text), null, 2);
                } catch {
                    /* v8 ignore next */ if (bodyEl) bodyEl.textContent = text;
                }
            } catch (err) {
                /* v8 ignore next */ if (statusEl) statusEl.textContent = t.error;
                /* v8 ignore next */ if (bodyEl) bodyEl.textContent = err instanceof Error ? err.message : String(err);
            }
        });
    });
}

/**
 * Web Component for CDD API Documentation
 * Usage: <cdd-api-docs spec="..."></cdd-api-docs>
 */
export class CDDApiDocs extends HTMLElement {
    private _translations: Partial<DocTranslations> = {};
    private _sdkExamples: CodeExample[] = [];
    private _org?: string;
    private _repo?: string;

    constructor() {
        super();
    }

    /**
     * Gets the current custom translations applied to the UI.
     * @returns A partial DocTranslations object
     */
    get translations() {
        return this._translations;
    }

    /**
     * Sets custom translations for the UI and triggers a re-render.
     * @param val A partial DocTranslations object
     */
    set translations(val: Partial<DocTranslations>) {
        this._translations = val;
        this.triggerRender();
    }

    /**
     * Gets the current list of SDK examples.
     * @returns Array of CodeExample objects
     */
    get sdkExamples() {
        return this._sdkExamples;
    }

    /**
     * Sets the SDK examples. Automatically parses JSON strings or standardizes format, then triggers re-render.
     * When receiving snippets generated by 'to_docs_json', it securely unpacks the 'endpoints' map from 
     * a `docs.json` wrapper into flat CodeExample entries.
     * 
     * Expected `docs.json` Schema Layout:
     * \`\`\`json
     * {
     *   "endpoints": {
     *     "/path/to/resource": {
     *       "get": "client.getResource()",
     *       "post": "client.createResource(data)"
     *     }
     *   }
     * }
     * \`\`\`
     * 
     * It preserves the 'language' attribute of the wrapper CodeExample so the correct tabs are highlighted.
     * 
     * @param val Examples configuration array, string, or object. Raw code files are passed as-is.
     */
    set sdkExamples(val: CodeExample[] | string | CDDOutput | CDDOutput[]) {
        if (typeof val === 'string') {
            try { val = JSON.parse(val); } catch (e) { val = []; }
        }
        
        if (val && typeof val === 'object' && !Array.isArray(val) && 'endpoints' in val) {
             val = [val as any];
        }

        if (Array.isArray(val)) {
            const extractedExamples: CodeExample[] = [];
            for (const item of val) {
                // Handle CodeExample wrapping a JSON string containing endpoints
                if (item && 'content' in item && typeof item.content === 'string' && 
                    ('filepath' in item && (item.filepath?.endsWith('.json') || item.content.includes('"endpoints"')))) {
                    try {
    const parsed = JSON.parse(item.content);
    if (parsed && typeof parsed === 'object' && parsed.endpoints && typeof parsed.endpoints === 'object') {
        for (const route of Object.keys(parsed.endpoints)) {
            const methods = parsed.endpoints[route];
            if (methods && typeof methods === 'object') {
                for (const method of Object.keys(methods)) {
                    extractedExamples.push({
                        language: ('language' in item ? item.language : undefined) || 'typescript',
                        filepath: route.replace(/[^a-zA-Z0-9]/g, '_') + '_' + method,
                        content: String((methods as any)[method] || ''),
                        includeImports: false,
                        includeWrapping: false
                    });
                }
            }
        }
        continue;
    } else if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].operations) {
        for (const block of parsed) {
            const lang = block.language || ('language' in item ? item.language : undefined) || 'typescript';
            for (const op of (block.operations || [])) {
                extractedExamples.push({
                    language: lang,
                    filepath: String(op.path || '').replace(/[^a-zA-Z0-9]/g, '_') + '_' + String(op.method || '').toLowerCase(),
                    content: String(op.code && op.code.snippet ? op.code.snippet : ''),
                    includeImports: false,
                    includeWrapping: false
                });
            }
        }
        continue;
    }
} catch (e) {
                        // Secure parse: Catch malformed JSON gracefully. Fall through to regular array push if we wanted, 
                        // but since it matches the file signature we can just console.warn
                        console.warn('cdd-docs-ui: Failed to securely parse docs.json payload.', e);
                    }
                }
                
                // Handle raw CDDOutput objects directly in the array
                if (item && 'endpoints' in item) {
                    const output = item as any;
                    for (const route of Object.keys(output.endpoints || {})) {
                        const methods = output.endpoints[route];
                        for (const method of Object.keys(methods || {})) {
                            extractedExamples.push({
                                language: 'typescript', // Generic fallback
                                filepath: route.replace(/[^a-zA-Z0-9]/g, '_') + '_' + method,
                                content: methods[method],
                                includeImports: false,
                                includeWrapping: false
                            });
                        }
                    }
                    continue;
                }

                extractedExamples.push(item);
            }
            val = extractedExamples;
        }

        this._sdkExamples = Array.isArray(val) ? val as CodeExample[] : [];
        this.triggerRender();
    }

    /**
     * Called when the element is inserted into the DOM.
     */
    connectedCallback() {
        // If we have inner HTML already, just initialize it (Progressive Enhancement)
        if (this.innerHTML.trim() && this.querySelector('.cdd-layout')) {
            initApiDocs(this, this._translations);
        } else {
            this.triggerRender();
        }

        this.setupPostMessage();
    }

    private triggerRender() {
        let spec = this.getAttribute('spec-content') || this.getAttribute('spec') || '';
        
        // Dynamic Routing from URL
        if (!spec) {
            const path = window.location.pathname;
            const match = path.match(/^\/u\/([^/]+)\/([^/]+)/);
            if (match) {
                const org = match[1];
                const repo = match[2];
                if (org && repo) {
                    this._org = org;
                    this._repo = repo;
                    const urlParams = new URLSearchParams(window.location.search);
                    const version = urlParams.get('v') || '';
                    // Fetch layer requesting from cdd-storage via cdd-gateway
                    const versionPath = version ? `/${encodeURIComponent(version)}` : '';
                    spec = `/cdd-gateway/storage/${encodeURIComponent(org)}/${encodeURIComponent(repo)}${versionPath}/schema.json`;
                }
            }
        }

        if (spec) {
            this.renderSpec(spec);
        }
    }

    /**
     * Renders the given OpenAPI specification string
     * @param specContent JSON or YAML string, or a URL starting with http:// or https://
     */
    public async renderSpec(specContent: string) {
        if (!specContent) return;
        try {
            let contentToRender = specContent;
            const trimmed = specContent.trim();

            // If it looks like a URL (starts with http/https, or looks like a domain path without spaces and newlines)
            const isUrl =
                /^https?:\/\//i.test(trimmed) ||
                (!trimmed.includes('\n') &&
                    !trimmed.startsWith('{') &&
                    !trimmed.includes('openapi:') &&
                    !trimmed.includes('swagger:') &&
                    trimmed.includes('/'));

            if (isUrl) {
                let url = trimmed;
                if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
                    url = 'https://' + url;
                }
                
                this.innerHTML = `<div class="cdd-loading" style="padding: 2rem; font-family: sans-serif;">Loading documentation...</div>`;
                
                const res = await fetch(url);
                if (!res.ok) {
                    if (res.status === 404) {
                        throw new Error('404 Not Found: The specified organization or repository does not exist or has no published schema.');
                    }
                    throw new Error(`Failed to fetch spec from URL: ${res.status} ${res.statusText}`);
                }
                contentToRender = await res.text();
            }

            const currentTheme = this.getAttribute('theme') || localStorage.getItem('cdd-theme') || 'light';

            const html = generateAOTHtml(
                contentToRender,
                this._sdkExamples,
                currentTheme === 'dark' ? 'dark' : 'light',
                false,
                this._translations,
            );

            // We extract the body contents, skipping the <html><head>... stuff
            const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

            // Wait! The styles in aot-generator are in <head><style>.
            // We need to extract them and prepend to innerHTML so they are not lost!
            const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
            /* v8 ignore next */ const styleHtml = styleMatch ? `<style>${styleMatch[1]}</style>` : '';

            if (bodyMatch && bodyMatch[1]) {
                this.innerHTML = styleHtml + bodyMatch[1];
            } else {
                this.innerHTML = html; // Fallback
            }

            // Inject dynamic header elements (versions and SDK downloads)
            const org = this._org;
            const repo = this._repo;
            if (org && repo) {
                const header = this.querySelector('.cdd-main header') || this.querySelector('header');
                if (header) {
                    const dynamicContainer = document.createElement('div');
                    dynamicContainer.className = 'cdd-dynamic-header-content';
                    dynamicContainer.style.marginTop = '1rem';
                    dynamicContainer.style.padding = '1rem';
                    dynamicContainer.style.background = 'var(--cdd-surface-variant, #f0f0f0)';
                    dynamicContainer.style.borderRadius = '4px';

                    // Version Toggle
                    const versionLabel = document.createElement('label');
                    versionLabel.textContent = 'Version: ';
                    versionLabel.style.fontWeight = 'bold';
                    const versionSelect = document.createElement('select');
                    versionSelect.className = 'cdd-version-select';
                    versionSelect.innerHTML = `<option value="latest">latest</option>`;
                    // Listen for changes
                    versionSelect.addEventListener('change', (e) => {
                        const ver = (e.target as HTMLSelectElement).value;
                        const url = new URL(window.location.href);
                        url.searchParams.set('v', ver);
                        window.history.pushState({}, '', url.toString());
                        // Refresh spec based on version
                        this.renderSpec(`/cdd-gateway/storage/${encodeURIComponent(org)}/${encodeURIComponent(repo)}/${encodeURIComponent(ver)}/schema.json`);
                    });

                    // Download Links
                    const downloadContainer = document.createElement('div');
                    downloadContainer.style.marginTop = '0.5rem';
                    const urlParams = new URLSearchParams(window.location.search);
                    const currentV = urlParams.get('v') || '';
                    const versionPath = currentV ? `/${encodeURIComponent(currentV)}` : '';

                    downloadContainer.innerHTML = `
                        <strong style="margin-right:0.5rem;">Download SDKs:</strong>
                        <a href="/cdd-gateway/storage/${encodeURIComponent(org)}/${encodeURIComponent(repo)}${versionPath}/sdk-typescript.tgz" download class="cdd-btn" style="margin-right:0.5rem; text-decoration:none; padding:0.25rem 0.5rem; background:var(--cdd-primary); color:white; border-radius:4px; font-size:0.875rem;">TypeScript</a>
                        <a href="/cdd-gateway/storage/${encodeURIComponent(org)}/${encodeURIComponent(repo)}${versionPath}/sdk-python.whl" download class="cdd-btn" style="text-decoration:none; padding:0.25rem 0.5rem; background:var(--cdd-primary); color:white; border-radius:4px; font-size:0.875rem;">Python</a>
                    `;

                    dynamicContainer.appendChild(versionLabel);
                    dynamicContainer.appendChild(versionSelect);
                    dynamicContainer.appendChild(downloadContainer);

                    // Attempt to fetch versions asynchronously to populate the dropdown
                    fetch(`/cdd-gateway/storage/${encodeURIComponent(org)}/${encodeURIComponent(repo)}/versions.json`)
                        .then(res => res.json())
                        .then(versions => {
                            if (Array.isArray(versions)) {
                                versionSelect.innerHTML = versions.map((v: string) => `<option value="${v}">${v}</option>`).join('');
                                // Select current version if in URL
                                const urlParams = new URLSearchParams(window.location.search);
                                const currentV = urlParams.get('v');
                                if (currentV) {
                                    versionSelect.value = currentV;
                                }
                            }
                        })
                        .catch(() => { /* silent fallback */ });

                    header.appendChild(dynamicContainer);
                }
            }

            initApiDocs(this, this._translations);

            // Dispatch ready event if anyone is listening directly to the element
            this.dispatchEvent(new CustomEvent('docs-ready'));
        } catch (err) {
            this.innerHTML = `<div style="color: red; padding: 2rem; font-family: monospace; white-space: pre-wrap;">Error rendering spec: ${err instanceof Error ? err.message : String(err)}\n\n${err instanceof Error && err.stack ? err.stack : ''}</div>`;
            console.error('CDDApiDocs rendering error:', err);
        }
    }

    private setupPostMessage() {
        window.addEventListener('message', event => {
            // Security: Could check event.origin here if needed
            if (!event.data || typeof event.data !== 'object') return;

            const { type, payload } = event.data;

            if (type === 'UPDATE_SPEC' && typeof payload === 'string') {
                this.renderSpec(payload);
            } else if (type === 'SET_THEME' && (payload === 'dark' || payload === 'light')) {
                this.setAttribute('theme', payload);
                const themeInput = this.querySelector('#opt-dark-mode') as HTMLInputElement;
                if (themeInput) {
                    themeInput.checked = payload === 'dark';
                    themeInput.dispatchEvent(new Event('change'));
                } else {
                    localStorage.setItem('cdd-theme', payload);
                }
            }
        });

        // Notify parent window that the UI is ready
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'DOCS_UI_READY' }, '*');
        }
    }

    /**
     * List of attributes to observe for changes.
     */
    static get observedAttributes() {
        return ['spec', 'spec-content', 'theme'];
    }

    /**
     * Called when an observed attribute is changed.
     * @param name The name of the attribute
     * @param oldValue The old value
     * @param newValue The new value
     */
    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (oldValue !== newValue) {
            this.triggerRender();
        }
    }
}

// Auto-register the custom element and init any standalone docs
/* v8 ignore next 6 */ if (typeof window !== 'undefined') {
    if (!customElements.get('cdd-api-docs')) {
        customElements.define('cdd-api-docs', CDDApiDocs);
    }

    /* v8 ignore next 6 */ window.addEventListener('DOMContentLoaded', () => {
        // If not inside a custom element, init the whole document
        if (!document.querySelector('cdd-api-docs')) {
            initApiDocs(document);
        }
    });
}
