/**
 * Progressive Enhancement and Custom Web Component (`<cdd-api-docs>`) for API and Workflow Documentation.
 * @module web-component
 */

import { generateAOTHtml } from './aot-generator';
import { isRecord, assembleStructuredCodeSnippet } from './parser';
import { DocTranslations, defaultTranslations, CodeExample } from './types';

/**
 * Extracts `CodeExample` entries from a parsed `CDDOutput`-like record (`endpoints`, `webhooks`, `workflows`).
 * @param rec The record containing `endpoints`, `webhooks`, and/or `workflows`.
 * @param lang The programming language identifier.
 * @returns Array of extracted `CodeExample` items.
 */
function extractFromCddOutputRecord(rec: Record<string, unknown>, lang: string): CodeExample[] {
    const out: CodeExample[] = [];
    const extractRouteMap = (mapObj: Record<string, unknown>): void => {
        for (const [route, methods] of Object.entries(mapObj)) {
            if (isRecord(methods)) {
                for (const [method, snippet] of Object.entries(methods)) {
                    const text =
                        typeof snippet === 'string'
                            ? snippet
                            : isRecord(snippet)
                              ? assembleStructuredCodeSnippet(snippet)
                              : String(snippet || '');
                    out.push({
                        language: lang,
                        filepath: `${route.replace(/[^a-zA-Z0-9]/g, '_')}_${method}`,
                        content: text,
                        includeImports: false,
                        includeWrapping: false,
                    });
                }
            }
        }
    };

    if (isRecord(rec['endpoints'])) {
        extractRouteMap(rec['endpoints']);
    }
    if (isRecord(rec['webhooks'])) {
        extractRouteMap(rec['webhooks']);
    }
    if (isRecord(rec['workflows'])) {
        for (const [wfId, snippet] of Object.entries(rec['workflows'])) {
            const text =
                typeof snippet === 'string'
                    ? snippet
                    : isRecord(snippet)
                      ? assembleStructuredCodeSnippet(snippet)
                      : String(snippet || '');
            out.push({
                language: lang,
                filepath: `workflow_${wfId}`,
                content: text,
                includeImports: false,
                includeWrapping: false,
            });
        }
    }
    return out;
}

/**
 * Normalizes polymorphic SDK examples input (string, CDDOutput object, array of CDDOutput/CodeExample/docs.json)
 * into a flat array of strongly-typed `CodeExample` objects.
 * @param val Raw SDK examples input.
 * @returns Normalized array of `CodeExample` objects.
 */
export function normalizeSdkExamplesInput(val: unknown): CodeExample[] {
    let current: unknown = val;
    if (typeof current === 'string') {
        try {
            current = JSON.parse(current);
        } catch {
            return [];
        }
    }

    if (
        isRecord(current) &&
        (isRecord(current['endpoints']) || isRecord(current['workflows']) || isRecord(current['webhooks']))
    ) {
        current = [current];
    }

    if (!Array.isArray(current)) {
        return [];
    }

    const extractedExamples: CodeExample[] = [];

    for (const item of current) {
        if (!isRecord(item)) continue;

        const itemContent = item['content'];
        const itemFilepath = typeof item['filepath'] === 'string' ? item['filepath'] : '';
        const itemLang = typeof item['language'] === 'string' ? item['language'] : 'typescript';

        if (
            typeof itemContent === 'string' &&
            (itemFilepath.endsWith('.json') ||
                itemContent.includes('"endpoints"') ||
                itemContent.includes('"workflows"') ||
                itemContent.includes('"operations"'))
        ) {
            try {
                const parsed: unknown = JSON.parse(itemContent);
                if (
                    isRecord(parsed) &&
                    (isRecord(parsed['endpoints']) || isRecord(parsed['workflows']) || isRecord(parsed['webhooks']))
                ) {
                    extractedExamples.push(...extractFromCddOutputRecord(parsed, itemLang));
                    continue;
                } else if (Array.isArray(parsed) && parsed.some(b => isRecord(b) && Array.isArray(b['operations']))) {
                    for (const block of parsed) {
                        if (!isRecord(block)) continue;
                        const lang = typeof block['language'] === 'string' ? block['language'] : itemLang;
                        const ops = Array.isArray(block['operations']) ? block['operations'] : [];
                        for (const op of ops) {
                            if (!isRecord(op)) continue;
                            const opPath = typeof op['path'] === 'string' ? op['path'] : '';
                            const opMethod = typeof op['method'] === 'string' ? op['method'] : '';
                            const opId = typeof op['operationId'] === 'string' ? op['operationId'] : '';
                            const codeObj = isRecord(op['code']) ? op['code'] : undefined;
                            const snippet =
                                typeof op['code'] === 'string'
                                    ? op['code']
                                    : codeObj
                                      ? assembleStructuredCodeSnippet(codeObj)
                                      : '';

                            if (opMethod.toUpperCase() === 'WORKFLOW' || opPath.startsWith('/workflows/')) {
                                const wfId = opId || opPath.replace(/^\/workflows\//, '') || 'workflow';
                                extractedExamples.push({
                                    language: lang,
                                    filepath: `workflow_${wfId}`,
                                    content: snippet,
                                    includeImports: false,
                                    includeWrapping: false,
                                });
                            } else {
                                extractedExamples.push({
                                    language: lang,
                                    filepath: `${opPath.replace(/[^a-zA-Z0-9]/g, '_')}_${opMethod.toLowerCase()}`,
                                    content: snippet,
                                    includeImports: false,
                                    includeWrapping: false,
                                });
                            }
                        }
                    }
                    continue;
                }
            } catch (e) {
                console.warn('cdd-docs-ui: Failed to securely parse docs.json payload.', e);
            }
        }

        if (isRecord(item['endpoints']) || isRecord(item['workflows']) || isRecord(item['webhooks'])) {
            extractedExamples.push(...extractFromCddOutputRecord(item, itemLang));
            continue;
        }

        if (typeof itemContent === 'string') {
            extractedExamples.push({
                language: itemLang,
                filepath: itemFilepath,
                content: itemContent,
                includeImports: typeof item['includeImports'] === 'boolean' ? item['includeImports'] : undefined,
                includeWrapping: typeof item['includeWrapping'] === 'boolean' ? item['includeWrapping'] : undefined,
            });
        }
    }

    return extractedExamples;
}

/**
 * Initializes the API and Workflow documentation interactive features within a specific container.
 * @param container The DOM element or Document containing the API documentation layout.
 * @param customTranslations Optional custom string dictionary for i18n.
 */
export function initApiDocs(
    container: Document | HTMLElement = document,
    customTranslations: Partial<DocTranslations> = {},
): void {
    const t: DocTranslations = { ...defaultTranslations, ...customTranslations };

    // Sync proxy inputs in the sidebar with the real hidden inputs at the top (when present)
    const langProxies = container.querySelectorAll<HTMLInputElement>('input[name="ui-lang-proxy"]');
    langProxies.forEach(proxy => {
        proxy.addEventListener('change', () => {
            const lang = proxy.id.replace('proxy-', '');
            const realInput = container.querySelector<HTMLInputElement>(`#lang-opt-${lang}`);
            if (realInput) realInput.checked = true;
        });
    });

    const importsProxy = container.querySelector<HTMLInputElement>('input[data-onchange-proxy*="opt-imports"]');
    if (importsProxy) {
        importsProxy.addEventListener('change', () => {
            const realInput = container.querySelector<HTMLInputElement>('#opt-imports');
            if (realInput) realInput.checked = importsProxy.checked;
        });
    }

    const wrappingProxy = container.querySelector<HTMLInputElement>('input[data-onchange-proxy*="opt-wrapping"]');
    if (wrappingProxy) {
        wrappingProxy.addEventListener('change', () => {
            const realInput = container.querySelector<HTMLInputElement>('#opt-wrapping');
            if (realInput) realInput.checked = wrappingProxy.checked;
        });
    }

    // Theme synchronization and persistence
    const themeInput = container.querySelector<HTMLInputElement>('#opt-dark-mode');
    if (themeInput) {
        const savedTheme = localStorage.getItem('cdd-theme');
        if (savedTheme) {
            themeInput.checked = savedTheme === 'dark';
        }

        themeInput.addEventListener('change', () => {
            localStorage.setItem('cdd-theme', themeInput.checked ? 'dark' : 'light');
        });
    }

    // Smooth search implementation with performance optimization (avoid duplicate injection)
    let searchInput = container.querySelector<HTMLInputElement>('.cdd-search-input');
    if (!searchInput) {
        searchInput = document.createElement('input');
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
        if (tocTitle && tocTitle.nextSibling && tocTitle.parentNode) {
            tocTitle.parentNode.insertBefore(searchInput, tocTitle.nextSibling);
        }
    }

    /**
     * Pre-computed lowercase text index entry for fast client-side filtering of DOM elements.
     */
    interface SearchIndex {
        /** The target DOM element to show or hide. */
        el: HTMLElement;
        /** The normalized lowercase searchable text associated with the element. */
        text: string;
    }
    let itemIndices: SearchIndex[] | null = null;
    let sectionIndices: SearchIndex[] | null = null;
    let searchTimeout: ReturnType<typeof setTimeout> | undefined;

    searchInput.addEventListener('input', () => {
        const term = searchInput.value.toLowerCase();

        if (searchTimeout !== undefined) {
            clearTimeout(searchTimeout);
        }
        searchTimeout = setTimeout(() => {
            if (!itemIndices) {
                itemIndices = Array.from(container.querySelectorAll<HTMLElement>('.cdd-toc-item')).map(el => ({
                    el,
                    text: `${el.textContent ?? ''} ${el.getAttribute('href') ?? ''}`.toLowerCase(),
                }));
            }
            if (!sectionIndices) {
                sectionIndices = Array.from(container.querySelectorAll<HTMLElement>('.cdd-endpoint')).map(el => ({
                    el,
                    text: `${el.textContent ?? ''} ${el.id}`.toLowerCase(),
                }));
            }

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
    const copyButtons = container.querySelectorAll<HTMLButtonElement>('.cdd-copy-btn');
    copyButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const codeEl = btn.parentElement?.querySelector('code');
            if (!codeEl) return;

            try {
                await navigator.clipboard.writeText(codeEl.textContent ?? '');
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
    const tryForms = container.querySelectorAll<HTMLFormElement>('.cdd-try-form');
    tryForms.forEach(form => {
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const method = form.getAttribute('data-method') || 'GET';
            let route = form.getAttribute('data-route') || '';

            const headers: Record<string, string> = {};
            const queryParams = new URLSearchParams();
            let body: string | undefined = undefined;

            const inputs = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
            inputs.forEach(el => {
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

            const apiDocsElement = form.closest('cdd-api-docs');
            const cddEl = apiDocsElement instanceof CDDApiDocs ? apiDocsElement : null;
            const org = cddEl?.org;
            const repo = cddEl?.repo;
            const urlParams = new URLSearchParams(window.location.search);
            const currentV = urlParams.get('v') || '';
            const versionPath = currentV ? `/${encodeURIComponent(currentV)}` : '';
            const querySuffix = queryParams.toString() ? `?${queryParams.toString()}` : '';

            let url = `https://api.example.com${route}${querySuffix}`;
            if (org && repo) {
                url = `/cdd-gateway/proxy/${encodeURIComponent(org)}/${encodeURIComponent(repo)}${versionPath}${route}${querySuffix}`;
            }

            const responseContainer = form.nextElementSibling;
            if (
                !(responseContainer instanceof HTMLElement) ||
                !responseContainer.classList.contains('cdd-try-response')
            ) {
                return;
            }

            const statusEl = responseContainer.querySelector('.cdd-try-status');
            const bodyEl = responseContainer.querySelector('.cdd-try-body');

            responseContainer.style.display = 'block';
            if (statusEl) statusEl.textContent = t.loading;
            if (bodyEl) bodyEl.textContent = '';

            try {
                if (body && !headers['Content-Type']) {
                    headers['Content-Type'] = 'application/json';
                }

                const res = await fetch(url, {
                    method,
                    headers,
                    body: method !== 'GET' && method !== 'HEAD' ? (body ?? null) : null,
                });

                if (statusEl) {
                    statusEl.textContent = `${t.status}: ${res.status} ${res.statusText}`;
                }
                const text = await res.text();
                if (bodyEl) {
                    try {
                        bodyEl.textContent = JSON.stringify(JSON.parse(text), null, 2);
                    } catch {
                        bodyEl.textContent = text;
                    }
                }
            } catch (err) {
                if (statusEl) statusEl.textContent = t.error;
                if (bodyEl) {
                    bodyEl.textContent = err instanceof Error ? err.message : String(err);
                }
            }
        });
    });

    // Setup Interactive Arazzo Workflow Try-It-Out forms
    const workflowForms = container.querySelectorAll<HTMLFormElement>('.cdd-workflow-try-form');
    workflowForms.forEach(form => {
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const wfId = form.getAttribute('data-workflow-id') || 'workflow';
            const responseContainer = form.nextElementSibling;
            if (
                !(responseContainer instanceof HTMLElement) ||
                !responseContainer.classList.contains('cdd-try-response')
            ) {
                return;
            }

            const statusEl = responseContainer.querySelector('.cdd-try-status');
            const bodyEl = responseContainer.querySelector('.cdd-try-body');
            responseContainer.style.display = 'block';
            if (statusEl) statusEl.textContent = t.loading;
            if (bodyEl) bodyEl.textContent = '';

            const workflowArticle = form.closest('.cdd-workflow');
            const stepCards = workflowArticle
                ? Array.from(workflowArticle.querySelectorAll<HTMLElement>('.cdd-step-card'))
                : [];

            /**
             * Result of executing an individual step in an interactive Arazzo workflow run.
             */
            interface WorkflowStepExecutionResult {
                /** The identifier of the executed workflow step. */
                stepId: string;
                /** The HTTP status code returned by the step request. */
                status: number;
                /** The raw response body text returned by the step request. */
                body: string;
            }

            try {
                const stepResults: WorkflowStepExecutionResult[] = [];
                for (const card of stepCards) {
                    const stepId = card.getAttribute('data-step-id') || 'step';
                    const method = card.getAttribute('data-method') || 'GET';
                    const route = card.getAttribute('data-route') || '/';
                    const res = await fetch(`https://api.example.com${route}`, { method });
                    const text = await res.text();
                    stepResults.push({ stepId, status: res.status, body: text });
                }

                if (statusEl) {
                    statusEl.textContent = `${t.status}: ${wfId} (${stepResults.length} steps completed)`;
                }
                if (bodyEl) {
                    bodyEl.textContent = JSON.stringify({ workflowId: wfId, steps: stepResults }, null, 2);
                }
            } catch (err) {
                if (statusEl) statusEl.textContent = t.error;
                if (bodyEl) {
                    bodyEl.textContent = err instanceof Error ? err.message : String(err);
                }
            }
        });
    });
}

/**
 * Checks whether a specification string represents an external or gateway URL rather than inline YAML/JSON content.
 * @param trimmed The trimmed specification string.
 * @returns True if the string should be fetched as a URL.
 */
function isSpecUrl(trimmed: string): boolean {
    const nl = String.fromCharCode(10);
    return (
        /^https?:\/\//i.test(trimmed) ||
        (!trimmed.includes(nl) &&
            !trimmed.startsWith('{') &&
            !trimmed.includes('openapi:') &&
            !trimmed.includes('swagger:') &&
            !trimmed.includes('arazzo:') &&
            trimmed.includes('/'))
    );
}

/**
 * Web Component for CDD API and Arazzo Workflow Documentation.
 * Usage: `<cdd-api-docs spec="..." arazzo="..."></cdd-api-docs>`
 */
export class CDDApiDocs extends HTMLElement {
    /** Custom UI translation overrides. */
    private _translations: Partial<DocTranslations> = {};
    /** Normalized SDK code examples injected via the `sdkExamples` property. */
    private _sdkExamples: CodeExample[] = [];
    /** Organization identifier parsed from `/u/:org/:repo` dynamic routing. */
    private _org?: string | undefined;
    /** Repository identifier parsed from `/u/:org/:repo` dynamic routing. */
    private _repo?: string | undefined;
    /** Bound `window.postMessage` event listener reference for clean removal on disconnect. */
    private readonly _boundMessageHandler: (event: MessageEvent) => void;

    /**
     * Initializes a new `CDDApiDocs` custom element instance.
     */
    constructor() {
        super();
        this._boundMessageHandler = (event: MessageEvent): void => {
            this.handlePostMessage(event);
        };
    }

    /**
     * Gets the organization identifier extracted from dynamic routing (`/u/:org/:repo`), if present.
     * @returns The organization string or undefined.
     */
    get org(): string | undefined {
        return this._org;
    }

    /**
     * Gets the repository identifier extracted from dynamic routing (`/u/:org/:repo`), if present.
     * @returns The repository string or undefined.
     */
    get repo(): string | undefined {
        return this._repo;
    }

    /**
     * Gets the current custom translations applied to the UI.
     * @returns A partial DocTranslations object.
     */
    get translations(): Partial<DocTranslations> {
        return this._translations;
    }

    /**
     * Sets custom translations for the UI and triggers a re-render.
     * @param val A partial DocTranslations object.
     */
    set translations(val: Partial<DocTranslations>) {
        this._translations = val;
        this.triggerRender();
    }

    /**
     * Gets the current list of SDK examples.
     * @returns Array of CodeExample objects.
     */
    get sdkExamples(): CodeExample[] {
        return this._sdkExamples;
    }

    /**
     * Sets the SDK examples. Automatically parses JSON strings or standardizes format, then triggers re-render.
     * @param val Examples configuration array, string, or object.
     */
    set sdkExamples(val: unknown) {
        this._sdkExamples = normalizeSdkExamplesInput(val);
        this.triggerRender();
    }

    /**
     * Called when the element is inserted into the DOM.
     */
    connectedCallback(): void {
        if (this.innerHTML.trim() && this.querySelector('.cdd-layout')) {
            initApiDocs(this, this._translations);
        } else {
            this.triggerRender();
        }

        this.setupPostMessage();
    }

    /**
     * Called when the element is removed from the DOM; cleans up window message listeners.
     */
    disconnectedCallback(): void {
        window.removeEventListener('message', this._boundMessageHandler);
    }

    /**
     * Resolves the specification source from attributes or URL routing and triggers rendering.
     */
    private triggerRender(): void {
        let spec =
            this.getAttribute('spec-content') ||
            this.getAttribute('spec') ||
            this.getAttribute('arazzo-content') ||
            this.getAttribute('arazzo') ||
            '';

        if (!spec) {
            const path = window.location.pathname;
            const match = path.match(/^\/u\/([^/]+)\/([^/]+)/);
            if (match && match[1] && match[2]) {
                this._org = match[1];
                this._repo = match[2];
                const urlParams = new URLSearchParams(window.location.search);
                const version = urlParams.get('v') || '';
                const versionPath = version ? `/${encodeURIComponent(version)}` : '';
                spec = `/cdd-gateway/storage/${encodeURIComponent(this._org)}/${encodeURIComponent(this._repo)}${versionPath}/schema.json`;
            }
        }

        const primaryHasSpec = Boolean(this.getAttribute('spec-content') || this.getAttribute('spec'));
        const companionArazzo = primaryHasSpec
            ? this.getAttribute('arazzo-content') || this.getAttribute('arazzo') || undefined
            : undefined;

        if (spec) {
            void this.renderSpec(spec, companionArazzo);
        }
    }

    /**
     * Renders the given OpenAPI or Arazzo specification string or URL, optionally paired with a companion Arazzo specification.
     * @param specContent JSON or YAML string, or a URL starting with `http://`, `https://`, or `/`.
     * @param companionArazzoSpec Optional companion Arazzo 1.1.0 specification string or URL.
     * @returns A promise that resolves once rendering and DOM initialization complete.
     */
    public async renderSpec(specContent: string, companionArazzoSpec?: string): Promise<void> {
        if (!specContent) return;
        try {
            let contentToRender = specContent;
            const trimmed = specContent.trim();

            if (isSpecUrl(trimmed)) {
                let url = trimmed;
                if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
                    url = 'https://' + url;
                }

                this.innerHTML = `<div class="cdd-loading" style="padding: 2rem; font-family: sans-serif;">Loading documentation...</div>`;

                const res = await fetch(url);
                if (!res.ok) {
                    if (res.status === 404) {
                        throw new Error(
                            '404 Not Found: The specified organization or repository does not exist or has no published schema.',
                        );
                    }
                    throw new Error(`Failed to fetch spec from URL: ${res.status} ${res.statusText}`);
                }
                contentToRender = await res.text();
            }

            let companionContent: string | undefined = companionArazzoSpec;
            if (companionContent && isSpecUrl(companionContent.trim())) {
                let arazzoUrl = companionContent.trim();
                if (!/^https?:\/\//i.test(arazzoUrl) && !arazzoUrl.startsWith('/')) {
                    arazzoUrl = 'https://' + arazzoUrl;
                }
                const arazzoRes = await fetch(arazzoUrl);
                if (arazzoRes.ok) {
                    companionContent = await arazzoRes.text();
                } else {
                    companionContent = undefined;
                }
            }

            const currentTheme = this.getAttribute('theme') || localStorage.getItem('cdd-theme') || 'light';

            const html = generateAOTHtml(
                contentToRender,
                this._sdkExamples,
                currentTheme === 'dark' ? 'dark' : 'light',
                false,
                this._translations,
                companionContent,
            );

            const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            const styleMatches = Array.from(html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi));
            const styleHtml = styleMatches.map(m => m[0]).join(String.fromCharCode(10));

            if (bodyMatch && bodyMatch[1]) {
                this.innerHTML = styleHtml + bodyMatch[1];
            } else {
                this.innerHTML = html;
            }

            const org = this._org;
            const repo = this._repo;
            if (org && repo) {
                const header = this.querySelector('header');
                if (header) {
                    this.injectDynamicHeader(header, org, repo);
                }
            }

            initApiDocs(this, this._translations);
            this.dispatchEvent(new CustomEvent('docs-ready'));
        } catch (err) {
            this.innerHTML = `<div style="color: red; padding: 2rem; font-family: monospace; white-space: pre-wrap;">Error rendering spec: ${err instanceof Error ? err.message : String(err)}

${err instanceof Error && err.stack ? err.stack : ''}</div>`;
            console.error('CDDApiDocs rendering error:', err);
        }
    }

    /**
     * Injects version selection dropdown and SDK download links into the header for dynamic `/u/:org/:repo` routes.
     * @param header The header DOM element to append controls to.
     * @param org The organization name.
     * @param repo The repository name.
     */
    private injectDynamicHeader(header: Element, org: string, repo: string): void {
        const dynamicContainer = document.createElement('div');
        dynamicContainer.className = 'cdd-dynamic-header-content';
        dynamicContainer.style.marginTop = '1rem';
        dynamicContainer.style.padding = '1rem';
        dynamicContainer.style.background = 'var(--cdd-surface-variant, #f0f0f0)';
        dynamicContainer.style.borderRadius = '4px';

        const versionLabel = document.createElement('label');
        versionLabel.textContent = 'Version: ';
        versionLabel.style.fontWeight = 'bold';
        const versionSelect = document.createElement('select');
        versionSelect.className = 'cdd-version-select';
        versionSelect.innerHTML = `<option value="latest">latest</option>`;

        versionSelect.addEventListener('change', () => {
            const ver = versionSelect.value;
            const url = new URL(window.location.href);
            url.searchParams.set('v', ver);
            window.history.pushState({}, '', url.toString());
            void this.renderSpec(
                `/cdd-gateway/storage/${encodeURIComponent(org)}/${encodeURIComponent(repo)}/${encodeURIComponent(ver)}/schema.json`,
            );
        });

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

        fetch(`/cdd-gateway/storage/${encodeURIComponent(org)}/${encodeURIComponent(repo)}/versions.json`)
            .then(res => res.json())
            .then((versions: unknown) => {
                if (Array.isArray(versions)) {
                    versionSelect.innerHTML = versions
                        .map(v => `<option value="${String(v)}">${String(v)}</option>`)
                        .join('');
                    const params = new URLSearchParams(window.location.search);
                    const selectedV = params.get('v');
                    if (selectedV) {
                        versionSelect.value = selectedV;
                    }
                }
            })
            .catch(() => {
                // Silent fallback if versions.json is unavailable
            });

        header.appendChild(dynamicContainer);
    }

    /**
     * Registers the `postMessage` listener and notifies a parent iframe host that the UI is ready.
     */
    private setupPostMessage(): void {
        window.removeEventListener('message', this._boundMessageHandler);
        window.addEventListener('message', this._boundMessageHandler);

        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'DOCS_UI_READY' }, '*');
        }
    }

    /**
     * Handles incoming `window.postMessage` events (`UPDATE_SPEC`, `UPDATE_ARAZZO`, and `SET_THEME`).
     * @param event The incoming `MessageEvent`.
     */
    private handlePostMessage(event: MessageEvent): void {
        if (!isRecord(event.data)) return;

        const type = event.data['type'];
        const payload = event.data['payload'];

        if (type === 'UPDATE_SPEC' && typeof payload === 'string') {
            const companion = this.getAttribute('arazzo-content') || this.getAttribute('arazzo') || undefined;
            void this.renderSpec(payload, companion);
        } else if (type === 'UPDATE_ARAZZO' && typeof payload === 'string') {
            this.setAttribute('arazzo-content', payload);
        } else if (type === 'SET_THEME' && (payload === 'dark' || payload === 'light')) {
            this.setAttribute('theme', payload);
            const themeInput = this.querySelector<HTMLInputElement>('#opt-dark-mode');
            if (themeInput) {
                themeInput.checked = payload === 'dark';
                themeInput.dispatchEvent(new Event('change'));
            } else {
                localStorage.setItem('cdd-theme', payload);
            }
        }
    }

    /**
     * List of attributes to observe for changes.
     * @returns Array of observed attribute names.
     */
    static get observedAttributes(): string[] {
        return ['spec', 'spec-content', 'arazzo', 'arazzo-content', 'theme'];
    }

    /**
     * Called when an observed attribute is changed.
     * @param _name The name of the attribute.
     * @param oldValue The old value.
     * @param newValue The new value.
     */
    attributeChangedCallback(_name: string, oldValue: string, newValue: string): void {
        if (oldValue !== newValue) {
            this.triggerRender();
        }
    }
}

/**
 * Global HTML element tag map augmentation so `document.createElement('cdd-api-docs')` and
 * `document.querySelector('cdd-api-docs')` infer `CDDApiDocs` automatically.
 */
declare global {
    /**
     * Global custom element tag map interface.
     */
    interface HTMLElementTagNameMap {
        /** The `<cdd-api-docs>` custom web component. */
        'cdd-api-docs': CDDApiDocs;
    }
}

/**
 * Registers the `<cdd-api-docs>` custom element and attaches a `DOMContentLoaded` listener
 * for standalone AOT HTML documents.
 */
export function registerWebComponent(): void {
    if (!customElements.get('cdd-api-docs')) {
        customElements.define('cdd-api-docs', CDDApiDocs);
    }

    window.addEventListener('DOMContentLoaded', () => {
        if (!document.querySelector('cdd-api-docs')) {
            initApiDocs(document);
        }
    });
}

registerWebComponent();
