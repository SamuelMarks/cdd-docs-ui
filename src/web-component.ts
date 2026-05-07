
import { generateAOTHtml } from "./aot-generator";
import { DocTranslations, defaultTranslations } from "./types";

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
export function initApiDocs(container: Document | HTMLElement = document, customTranslations: Partial<DocTranslations> = {}): void {
  const t: DocTranslations = { ...defaultTranslations, ...customTranslations };

  // Sync proxy inputs in the sidebar with the real hidden inputs at the top
  const langProxies = container.querySelectorAll('input[name="ui-lang-proxy"]');
  langProxies.forEach(proxy => {
    proxy.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      const lang = target.id.replace("proxy-", "");
      const realInput = container.querySelector(`#lang-opt-${lang}`) as HTMLInputElement;
      if (realInput) realInput.checked = true;
    });
  });

  const importsProxy = container.querySelector('input[onchange*="opt-imports"]') as HTMLInputElement;
  if (importsProxy) {
    importsProxy.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      const realInput = container.querySelector("#opt-imports") as HTMLInputElement;
      if (realInput) realInput.checked = target.checked;
    });
  }

  const wrappingProxy = container.querySelector('input[onchange*="opt-wrapping"]') as HTMLInputElement;
  if (wrappingProxy) {
    wrappingProxy.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      const realInput = container.querySelector("#opt-wrapping") as HTMLInputElement;
      if (realInput) realInput.checked = target.checked;
    });
  }

  // Theme synchronization and persistence
  const themeInput = container.querySelector("#opt-dark-mode") as HTMLInputElement;
  
  if (themeInput) {
    // Load from localStorage
    const savedTheme = localStorage.getItem("cdd-theme");
    if (savedTheme) {
      themeInput.checked = savedTheme === "dark";
    }

    themeInput.addEventListener("change", () => {
      localStorage.setItem("cdd-theme", themeInput.checked ? "dark" : "light");
    });
  }

  // Smooth search implementation with performance optimization
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = t.searchPlaceholder;
  searchInput.setAttribute("aria-label", t.searchPlaceholder);
  searchInput.className = "cdd-search-input";
  searchInput.style.width = "100%";
  searchInput.style.padding = "0.5rem";
  searchInput.style.marginBottom = "1rem";
  searchInput.style.borderRadius = "4px";
  searchInput.style.border = "1px solid var(--cdd-outline)";

  const tocTitle = container.querySelector(".cdd-sidebar-title");
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

  searchInput.addEventListener("input", (e) => {
    const term = (e.target as HTMLInputElement).value.toLowerCase();
    
    // Debounce
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      // Lazy initialization of indices
      if (!itemIndices) {
        itemIndices = Array.from(container.querySelectorAll(".cdd-toc-item")).map(el => ({
          el: el as HTMLElement,
          text: ((el.textContent || "") + " " + ((el as HTMLAnchorElement).getAttribute("href") || "")).toLowerCase()
        }));
      }
      if (!sectionIndices) {
        sectionIndices = Array.from(container.querySelectorAll(".cdd-endpoint")).map(el => ({
          el: el as HTMLElement,
          text: ((el.textContent || "") + " " + el.id).toLowerCase()
        }));
      }

      // Execute search
      itemIndices.forEach(item => {
        const isVisible = item.text.includes(term);
        item.el.style.display = isVisible ? "block" : "none";
      });

      sectionIndices.forEach(section => {
        const isVisible = section.text.includes(term);
        section.el.style.display = isVisible ? "grid" : "none";
      });
    }, 150);
  });

  // Setup copy to clipboard buttons
  const copyButtons = container.querySelectorAll('.cdd-copy-btn');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const parent = btn.parentElement;
      if (!parent) return;
      const codeEl = parent.querySelector('code');
      if (!codeEl) return;
      
      try {
        await navigator.clipboard.writeText(codeEl.textContent || '');
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
    form.addEventListener('submit', async (e) => {
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

      const url = `https://api.example.com${route}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      const responseContainer = f.nextElementSibling as HTMLElement;
      if (!responseContainer || !responseContainer.classList.contains('cdd-try-response')) return;
      
      const statusEl = responseContainer.querySelector('.cdd-try-status');
      const bodyEl = responseContainer.querySelector('.cdd-try-body');
      
      responseContainer.style.display = 'block';
      if (statusEl) statusEl.textContent = t.loading;
      if (bodyEl) bodyEl.textContent = '';

      try {
        if (body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
        
        const res = await fetch(url, {
          method,
          headers,
          body: (method !== 'GET' && method !== 'HEAD') ? body : null
        });

        if (statusEl) statusEl.textContent = `${t.status}: ${res.status} ${res.statusText}`;
        const text = await res.text();
        try {
          // Pretty print JSON
          if (bodyEl) bodyEl.textContent = JSON.stringify(JSON.parse(text), null, 2);
        } catch {
          if (bodyEl) bodyEl.textContent = text;
        }
      } catch (err) {
        if (statusEl) statusEl.textContent = t.error;
        if (bodyEl) bodyEl.textContent = err instanceof Error ? err.message : String(err);
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

  constructor() {
    super();
  }

  get translations() {
    return this._translations;
  }

  set translations(val: Partial<DocTranslations>) {
    this._translations = val;
    if (this.hasAttribute('spec')) {
      this.renderSpec(this.getAttribute('spec') || "");
    } else if (this.innerHTML.trim() && this.querySelector('.cdd-layout')) {
      initApiDocs(this, this._translations);
    }
  }

  connectedCallback() {
    // If we have inner HTML already, just initialize it (Progressive Enhancement)
    if (this.innerHTML.trim() && this.querySelector('.cdd-layout')) {
      initApiDocs(this, this._translations);
    } else if (this.hasAttribute('spec')) {
      // If we have a spec attribute, generate it
      this.renderSpec(this.getAttribute('spec') || "");
    }

    this.setupPostMessage();
  }

  /**
   * Renders the given OpenAPI specification string
   * @param specContent JSON or YAML string
   */
  public renderSpec(specContent: string) {
    try {
      const html = generateAOTHtml(specContent, [], localStorage.getItem("cdd-theme") === "dark" ? "dark" : "light", false, this._translations);
      
      // We extract the body contents, skipping the <html><head>... stuff
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch && bodyMatch[1]) {
        this.innerHTML = bodyMatch[1];
      } else {
        this.innerHTML = html; // Fallback
      }
      
      initApiDocs(this, this._translations);
      
      // Dispatch ready event if anyone is listening directly to the element
      this.dispatchEvent(new CustomEvent('docs-ready'));
    } catch (err) {
      this.innerHTML = `<div style="color: red; padding: 2rem;">Error rendering spec: ${err instanceof Error ? err.message : String(err)}</div>`;
    }
  }

  private setupPostMessage() {
    window.addEventListener('message', (event) => {
      // Security: Could check event.origin here if needed
      if (!event.data || typeof event.data !== 'object') return;

      const { type, payload } = event.data;

      if (type === 'UPDATE_SPEC' && typeof payload === 'string') {
        this.renderSpec(payload);
      } else if (type === 'SET_THEME' && (payload === 'dark' || payload === 'light')) {
        const themeInput = this.querySelector("#opt-dark-mode") as HTMLInputElement;
        if (themeInput) {
          themeInput.checked = payload === 'dark';
          themeInput.dispatchEvent(new Event("change"));
        } else {
          localStorage.setItem("cdd-theme", payload);
        }
      }
    });

    // Notify parent window that the UI is ready
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'DOCS_UI_READY' }, '*');
    }
  }

  static get observedAttributes() {
    return ['spec'];
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === 'spec' && oldValue !== newValue) {
      this.renderSpec(newValue);
    }
  }
}

// Auto-register the custom element and init any standalone docs
if (typeof window !== "undefined") {
  if (!customElements.get('cdd-api-docs')) {
    customElements.define('cdd-api-docs', CDDApiDocs);
  }
  
  window.addEventListener("DOMContentLoaded", () => {
    // If not inside a custom element, init the whole document
    if (!document.querySelector('cdd-api-docs')) {
      initApiDocs(document);
    }
  });
}
