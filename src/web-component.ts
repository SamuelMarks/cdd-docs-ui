
import { LitElement, html, css } from "lit";
import { normalizeSpec, mapSdkExamples, isReference } from "./parser";
import { DocData, CodeExample } from "./types";

export class CddApiDocs extends LitElement {
  declare specContent: string;
  declare theme: string;
  declare sdkExamples: CodeExample[];
  declare docData: DocData | null;

  static get properties() {
    return {
      specContent: { type: String, attribute: "spec-content" },
      theme: { type: String },
      sdkExamples: { type: Array },
      docData: { state: true }
    };
  }

  constructor() {
    super();
    this.specContent = "";
    this.theme = "light";
    this.sdkExamples = [];
    this.docData = null;
  }

  createRenderRoot() {
    return this;
  }

  willUpdate(changedProperties: Map<string, any>) {
    if (changedProperties.has("specContent") || changedProperties.has("sdkExamples")) {
      try {
        if (this.specContent) {
           const data = normalizeSpec(this.specContent);
           if (this.sdkExamples && this.sdkExamples.length > 0) {
             mapSdkExamples(data, this.sdkExamples);
           }
           this.docData = data;
        } else {
           this.docData = null;
        }
      } catch (e) {
        console.error("Failed to parse spec in Web Component:", e);
        this.docData = null;
      }
    }
  }

  render() {
    if (!this.docData || !this.docData.spec) {
      return html`<div class="container"><p style="padding: 2rem;">Loading or Invalid Specification...</p></div>`;
    }
    
    const spec = this.docData.spec;
    const paths = spec.paths || {};

    return html`
      <div class="container" data-theme="${this.theme}">
        <div class="layout">
          <aside class="sidebar">
            <h1 style="font-size: 1.25rem; margin-top: 0;">${spec.info.title}</h1>
            <p>v${spec.info.version}</p>
          </aside>
          <main class="main">
            ${Object.entries(paths).map(([route, pathItem]) => {
              if (isReference(pathItem)) return html``;
              const methods = ["get", "post", "put", "delete", "patch", "options", "head", "trace"];
              return methods.map(m => {
                const op = (pathItem as any)[m];
                if (!op) return html``;
                const id = op.operationId || `${m}-${route}`;
                return html`
                  <article id="${id}">
                    <h2>${m.toUpperCase()} ${route}</h2>
                    <h3>${op.summary || ""}</h3>
                    ${this.docData!.codeExamples[id] && this.docData!.codeExamples[id].length > 0 ? html`
                      ${this.docData!.codeExamples[id].map((example: any) => html`
                        <div><strong>${example.filepath}</strong><pre><code>${example.content}</code></pre></div>
                      `)}
                    ` : ""}
                  </article>
                `;
              });
            })}
          </main>
        </div>
      </div>
    `;
  }
}

if (!customElements.get("cdd-api-docs")) {
  customElements.define("cdd-api-docs", CddApiDocs);
}
