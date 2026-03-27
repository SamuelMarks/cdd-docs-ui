
import { LitElement, html, css } from "lit";
import { normalizeSpec, mapSdkExamples } from "./parser";

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

  willUpdate(changedProperties: any) {
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
    if (!this.docData) {
      return html`<div class="container"><p style="padding: 2rem;">Loading or Invalid Specification...</p></div>`;
    }

    return html`
      <div class="container" data-theme="${this.theme}">
        <div class="layout">
          <aside class="sidebar">
            <h1 style="font-size: 1.25rem; margin-top: 0;">${this.docData!.title}</h1>
            <p>v${this.docData!.version}</p>
          </aside>
          <main class="main">
            ${Object.entries(this.docData!.groups).map(([tag, operations]) => html`
              ${operations.map((op: any) => html`
                <article id="${op.id}">
                  <h2>${op.path}</h2><h3>${op.summary}</h3>
                  ${this.docData!.codeExamples[op.id] && this.docData!.codeExamples[op.id]!.length > 0 ? html`
                    ${this.docData!.codeExamples[op.id]!.map((example: any) => html`
                      <div><strong>${example.filepath}</strong><pre><code>${example.content}</code></pre></div>
                    `)}
                  ` : ""}
                </article>
              `)}
            `)}
          </main>
        </div>
      </div>
    `;
  }
}

if (!customElements.get("cdd-api-docs")) {
  customElements.define("cdd-api-docs", CddApiDocs);
}
