import { marked } from 'marked';
import {
    CodeExample,
    SchemaObject,
    ReferenceObject,
    OperationObject,
    DocTranslations,
    defaultTranslations,
} from './types';
import { normalizeSpec, mapSdkExamples, isReference } from './parser';

/**
 * Basic markdown rendering for descriptions.
 */
export function renderMarkdown(text: string | undefined): string {
    if (!text) return '';
    return marked.parse(text) as string;
}

/**
 * Generates a curl command for a given operation.
 * @param method The HTTP method (get, post, etc.)
 * @param route The API route path
 * @param op The OpenAPI operation object
 * @returns A string containing the curl command
 */
export function generateCurl(method: string, route: string, op: OperationObject): string {
    const upperMethod = method.toUpperCase();
    const methodPart = upperMethod === 'GET' ? '' : `-X ${upperMethod} `;
    let curl = `curl ${methodPart}"https://api.example.com${route}"`;

    if (op.parameters) {
        op.parameters.forEach(p => {
            if (!isReference(p) && p.in === 'header') {
                curl += ` \\\n  -H "${p.name}: <value>"`;
            }
        });
    }

    if (op.requestBody && !isReference(op.requestBody)) {
        const content = op.requestBody.content;
        const firstType = Object.keys(content)[0];
        if (firstType) {
            curl += ` \\\n  -H "Content-Type: ${firstType}"`;
            curl += ` \\\n  -d '{"key": "value"}'`;
        }
    }

    return curl;
}

/**
 * Recursively renders a schema object into an HTML table-like structure.
 * @param schema The SchemaObject or ReferenceObject to render
 * @param depth Current recursion depth
 * @param namePrefix Prefix for property IDs to ensure uniqueness
 * @returns HTML string for the schema
 */
export function renderSchema(
    schema: SchemaObject | ReferenceObject,
    depth: number = 0,
    namePrefix: string = '',
    t: DocTranslations = defaultTranslations,
): string {
    if (isReference(schema)) {
        return `<span class="cdd-schema-ref">${schema.$ref.split('/').pop()}</span>`;
    }

    let html = `<div class="cdd-schema-container" style="margin-left: ${depth * 16}px">`;

    if (schema.type === 'object' && schema.properties) {
        html += `<table class="cdd-schema-table">
      <thead><tr><th>Property</th><th>Type</th><th>Description</th></tr></thead>
      <tbody>`;
        for (const [name, prop] of Object.entries(schema.properties)) {
            const propSchema = prop as SchemaObject;
            const isRequired = schema.required?.includes(name);
             /* v8 ignore next */ const propId = namePrefix ? `${namePrefix}-prop-${name}` : `prop-${name}`;

            html += `<tr id="${propId}" class="cdd-deep-link-row">
        <td><a href="#${propId}" class="cdd-anchor">#</a><span class="cdd-prop-name">${name}${isRequired ? '<span class="cdd-required">*</span>' : ''}</span></td>
        <td><span class="cdd-prop-type">${propSchema.type || 'any'}</span></td>
        <td><div class="cdd-prop-desc">${renderMarkdown(propSchema.description)}</div></td>
      </tr>`;
            if (propSchema.type === 'object' || propSchema.type === 'array') {
                html += `<tr><td colspan="3">${renderSchema(propSchema, depth + 1, propId, t)}</td></tr>`;
            }
        }
        html += `</tbody></table>`;
    } else if (schema.type === 'array' && schema.items) {
        html += `<div class="cdd-schema-array">${t.arrayOf} ${renderSchema(schema.items, depth + 1, namePrefix, t)}</div>`;
    } else {
        html += `<span class="cdd-prop-type">${schema.type || 'any'}</span>`;
        if (schema.description) html += `<div class="cdd-prop-desc">${renderMarkdown(schema.description)}</div>`;
    }

    html += `</div>`;
    return html;
}

/**
 * Generates the complete AOT HTML for the API documentation.
 * @param specContent Raw OpenAPI spec string (YAML/JSON)
 * @param sdkExamples List of code examples to include
 * @param theme UI theme ('light' or 'dark')
 * @returns Full HTML document string
 */
export function generateAOTHtml(
    specContent: string,
    sdkExamples: CodeExample[] = [],
    theme: 'light' | 'dark' = 'light',
    injectLiveReload: boolean = false,
    customTranslations: Partial<DocTranslations> = {},
): string {
    const t: DocTranslations = { ...defaultTranslations, ...customTranslations };
    const data = normalizeSpec(specContent);
    if (sdkExamples.length > 0) {
        mapSdkExamples(data, sdkExamples);
    }

    const languages = Array.from(new Set(sdkExamples.map(  ex => ex.language)));
    if (languages.length === 0) languages.push('javascript');

    const spec = data.spec;
    const paths = spec.paths || {};
    let mainHtml = '';
    let tocHtml = '';
    let schemasHtml = '';

    // Build TOC and Main Content
    for (const [route, pathItem] of Object.entries(paths)) {
        if (isReference(pathItem)) continue;
        const methods = ['get', 'post', 'put', 'delete', 'patch'] as const;

        let routeHasOps = false;
        let routeToc = `<details class="cdd-toc-group"><summary class="cdd-toc-route">${route}</summary>`;

        for (const m of methods) {
            const op = (pathItem as any)[m] as OperationObject;
            if (!op) continue;
            routeHasOps = true;
            const id = op.operationId || `${m}-${route}`;

            routeToc += `<a href="#${id}" class="cdd-toc-item cdd-method-${m}">${m.toUpperCase()}</a>`;

            const curl = generateCurl(m, route, op);
            const examples = data.codeExamples[id] || [];

            mainHtml += `
        <article id="${id}" class="cdd-endpoint">
          <div class="cdd-endpoint-info">
            <h2 class="cdd-endpoint-title">${op.summary || route}</h2>
            <div class="cdd-endpoint-path-row">
              <span class="cdd-badge cdd-badge-${m}">${m.toUpperCase()}</span>
              <code class="cdd-path-text">${route}</code>
            </div>
            ${op.description ? `<div class="cdd-description">${renderMarkdown(op.description)}</div>` : ''}
            
            ${
                op.parameters
                    ? `
              <h3 class="cdd-section-title">${t.parameters}</h3>
              <table class="cdd-params-table">
                <thead><tr><th>Name</th><th>In</th><th>Type</th><th>Description</th></tr></thead>
                <tbody>
                  ${op.parameters
                      .map(p => {
                          if (isReference(p)) return '';
                          const paramId = `${id}-param-${p.name}`;
                          return `<tr id="${paramId}" class="cdd-deep-link-row">
                      <td><a href="#${paramId}" class="cdd-anchor">#</a><code>${p.name}${p.required ? '*' : ''}</code></td>
                      <td>${p.in}</td>
                      <td>${(p.schema as any)?.type || 'any'}</td>
                      <td>${renderMarkdown(p.description)}</td>
                    </tr>`;
                      })
                      .join('')}
                </tbody>
              </table>
            `
                    : ''
            }

            <details class="cdd-try-it-out">
              <summary class="cdd-try-summary">${t.tryItOut}</summary>
              <form class="cdd-try-form" method="${m === 'get' ? 'GET' : 'POST'}" action="https://api.example.com${route}" data-method="${m.toUpperCase()}" data-route="${route}">
                ${
                    op.parameters
                        ? op.parameters
                              .map(p => {
                                  if (isReference(p)) return '';
                                  return `
                    <div class="cdd-try-field">
                      <label for="try-${id}-${p.name}">${p.name} (${p.in})${p.required ? ' *' : ''}</label>
                      <input type="text" id="try-${id}-${p.name}" name="${p.name}" data-in="${p.in}" ${p.required ? 'required' : ''}>
                    </div>
                  `;
                              })
                              .join('')
                        : ''
                }
                ${
                    op.requestBody && !isReference(op.requestBody)
                        ? `
                  <div class="cdd-try-field">
                    <label for="try-${id}-body">${t.requestBody}</label>
                    <textarea id="try-${id}-body" name="requestBody" rows="4"></textarea>
                  </div>
                `
                        : ''
                }
                <button type="submit" class="cdd-try-btn">${t.execute}</button>
              </form>
              <div class="cdd-try-response" style="display: none; margin-top: 1rem;">
                <h4 style="margin:0 0 0.5rem 0;">${t.response}</h4>
                <div class="cdd-try-status"></div>
                <pre><code class="cdd-try-body"></code></pre>
              </div>
            </details>
          </div>

          <aside class="cdd-endpoint-code">
            <div class="cdd-code-card">
              <div class="cdd-code-tabs">
                <input type="radio" id="tab-curl-${id}" name="tab-${id}" class="cdd-tab-input" checked>
                <label for="tab-curl-${id}" class="cdd-tab-label">cURL</label>
                
                <input type="radio" id="tab-sdk-${id}" name="tab-${id}" class="cdd-tab-input">
                <label for="tab-sdk-${id}" class="cdd-tab-label">SDK</label>

                <div class="cdd-tab-content cdd-tab-content-curl">
                  <div style="position: relative;">
                    <button class="cdd-copy-btn">${t.copy}</button>
                    <pre><code class="language-bash">${curl}</code></pre>
                  </div>
                </div>
                <div class="cdd-tab-content cdd-tab-content-sdk">
                  ${languages
                      .map(lang => {
                          const langEx = examples.filter(ex => ex.language === lang);
                          const prismLang = lang === 'ts' ? 'typescript' : lang === 'sh' ? 'bash' : lang;
                          return `
                      <div class="cdd-lang-block cdd-show-if-${lang}">
                        ${
                            langEx.length > 0
                                ? langEx
                                      .map(
                                          ex => {
                                              /* v8 ignore next */ const importsClass = ex.includeImports ? 'cdd-show-if-imports' : 'cdd-hide-if-imports';
                                              /* v8 ignore next */ const wrappingClass = ex.includeWrapping ? 'cdd-show-if-wrapping' : 'cdd-hide-if-wrapping';
                                              return `
                          <div class="cdd-variant-block ${importsClass} ${wrappingClass}">
                            <div style="position: relative;">
                              <button class="cdd-copy-btn">${t.copy}</button>
                              <pre><code class="language-${prismLang}">${ex.content}</code></pre>
                            </div>
                          </div>
                        `;
                                          }
                                      )
                                      .join('')
                                : `<div class="cdd-no-example">${t.noExampleFor} ${lang}</div>`
                        }
                      </div>
                    `;
                      })
                      .join('')}
                </div>
              </div>
            </div>
          </aside>
        </article>
      `;
        }
        routeToc += `</details>`;
        if (routeHasOps) tocHtml += routeToc;
    }

    // Build Schemas
    if (spec.components?.schemas) {
        schemasHtml += `<h2 id="section-schemas" class="cdd-main-title">${t.schemas}</h2>`;
        for (const [name, schema] of Object.entries(spec.components.schemas)) {
            schemasHtml += `
        <div id="schema-${name}" class="cdd-schema-section">
          <h3 class="cdd-schema-title">${name}</h3>
          ${renderSchema(schema, 0, `schema-${name}`)}
        </div>
      `;
        }
    }

    const lightVars = `
    --cdd-primary: #005ac1;
    --cdd-on-primary: #ffffff;
    --cdd-background: #fdfbff;
    --cdd-surface: #fdfbff;
    --cdd-on-surface: #1b1b1f;
    --cdd-on-surface-variant: #45464f;
    --cdd-outline: #757780;
    --cdd-outline-variant: #c5c6d0;
  `;

    const darkVars = `
    --cdd-primary: #adc6ff;
    --cdd-on-primary: #002e69;
    --cdd-background: #1b1b1f;
    --cdd-surface: #1b1b1f;
    --cdd-on-surface: #e3e2e6;
    --cdd-on-surface-variant: #c5c6d0;
    --cdd-outline: #8f9099;
    --cdd-outline-variant: #45464f;
  `;

    return `<!DOCTYPE html>
<html lang="${t.locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${spec.info.title} - API Reference</title>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Roboto+Mono&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
  <style>
    :root {
      ${lightVars}
      --cdd-get: #00668b; --cdd-get-bg: #c2e8ff;
      --cdd-post: #006e2c; --cdd-post-bg: #b4f3b0;
      --cdd-put: #944a00; --cdd-put-bg: #ffdcbe;
      --cdd-delete: #ba1a1a; --cdd-delete-bg: #ffdad6;
      --cdd-patch: #006a6a; --cdd-patch-bg: #6ff5f5;
      
      ${languages.map(lang => `--cdd-display-${lang}: none;`).join(' ')}
      --cdd-display-imports: block;
      --cdd-display-wrapping: block;
    }

    #opt-dark-mode:checked ~ .cdd-layout {
      ${darkVars}
    }

    ${languages.map(lang => `#lang-opt-${lang}:checked ~ .cdd-layout .cdd-show-if-${lang} { display: block; }`).join('\n')}
    #opt-imports:checked ~ * { --cdd-display-imports: block; }
    #opt-imports:not(:checked) ~ * { --cdd-display-imports: none; }
    #opt-wrapping:checked ~ * { --cdd-display-wrapping: block; }
    #opt-wrapping:not(:checked) ~ * { --cdd-display-wrapping: none; }

    body {
      margin: 0;
      font-family: 'Roboto', sans-serif;
      background: var(--cdd-background);
      color: var(--cdd-on-surface);
      line-height: 1.5;
    }

    .cdd-visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

    .cdd-layout {
      display: grid;
      grid-template-columns: 280px 1fr 350px;
      height: 100vh;
      overflow: hidden;
      background: var(--cdd-background);
      color: var(--cdd-on-surface);
    }

    @media (max-width: 1200px) {
      .cdd-layout { grid-template-columns: 250px 1fr; }
      .cdd-sidebar-right { display: none; }
    }

    @media (max-width: 768px) {
      .cdd-layout { grid-template-columns: 1fr; }
      .cdd-sidebar-left { display: none; }
    }

    .cdd-sidebar-left, .cdd-sidebar-right {
      background: var(--cdd-surface);
      border-right: 1px solid var(--cdd-outline-variant);
      overflow-y: auto;
      padding: 1rem;
    }
    
    .cdd-sidebar-right { border-right: none; border-left: 1px solid var(--cdd-outline-variant); }

    .cdd-main {
      overflow-y: auto;
      padding: 2rem;
      scroll-behavior: smooth;
    }

    .cdd-toc-group { margin-bottom: 0.5rem; }
    .cdd-toc-route { font-size: 0.875rem; font-weight: 500; cursor: pointer; padding: 0.25rem 0; }
    .cdd-toc-item { display: block; font-size: 0.75rem; padding: 0.25rem 1rem; text-decoration: none; color: var(--cdd-on-surface-variant); border-radius: 4px; }
    .cdd-toc-item:hover { background: rgba(0,0,0,0.05); }

    .cdd-endpoint { display: grid; grid-template-columns: 1fr; gap: 2rem; margin-bottom: 4rem; border-bottom: 1px solid var(--cdd-outline-variant); padding-bottom: 4rem; content-visibility: auto; contain-intrinsic-size: 1000px; }
    @media (min-width: 1600px) {
      .cdd-endpoint { grid-template-columns: 1fr 400px; }
    }

    .cdd-anchor { text-decoration: none; color: var(--cdd-primary); opacity: 0; margin-right: 0.5rem; font-family: monospace; }
    .cdd-deep-link-row:hover .cdd-anchor { opacity: 1; }
    .cdd-deep-link-row:target { background: rgba(0, 90, 193, 0.1); outline: 2px solid var(--cdd-primary); }

    .cdd-badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; }
    .cdd-badge-GET { background: var(--cdd-get-bg); color: var(--cdd-get); }
    .cdd-badge-POST { background: var(--cdd-post-bg); color: var(--cdd-post); }

    .cdd-code-card { background: #1e1e1e; border-radius: 12px; color: #fff; overflow: hidden; }
    .cdd-code-tabs { display: flex; flex-wrap: wrap; }
    .cdd-tab-input { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    .cdd-tab-label { padding: 0.75rem 1rem; font-size: 0.875rem; cursor: pointer; border-bottom: 2px solid transparent; opacity: 0.7; transition: all 0.2s; }
    .cdd-tab-input:focus-visible + .cdd-tab-label { outline: 2px solid var(--cdd-primary); outline-offset: -2px; opacity: 1; }
    .cdd-tab-input:checked + .cdd-tab-label { border-bottom-color: var(--cdd-primary); opacity: 1; }
    
    .cdd-tab-content { display: none; width: 100%; padding: 1rem; background: #000; }
    
    .cdd-tab-input:nth-of-type(1):checked ~ .cdd-tab-content:nth-of-type(1) { display: block; }
    .cdd-tab-input:nth-of-type(2):checked ~ .cdd-tab-content:nth-of-type(2) { display: block; }

    .cdd-copy-btn { position: absolute; top: 0.5rem; right: 0.5rem; background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.25rem 0.5rem; font-size: 0.75rem; cursor: pointer; transition: background 0.2s; z-index: 10; }
    .cdd-copy-btn:hover { background: rgba(255,255,255,0.2); }
    .cdd-copy-btn.cdd-copied { background: #34a853; border-color: #34a853; }

    pre { margin: 0; font-family: 'Roboto Mono', monospace; font-size: 0.8125rem; overflow-x: auto; color: #d4d4d4; padding-top: 2rem; }

    
    .cdd-sidebar-title { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--cdd-on-surface-variant); margin: 1rem 0 0.5rem; }
    
    .cdd-setting-label { display: block; margin-bottom: 0.25rem; cursor: pointer; padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.875rem; border: 1px solid var(--cdd-outline-variant); transition: all 0.2s; }
    .cdd-setting-label:hover { background: rgba(0,0,0,0.05); border-color: var(--cdd-outline); }
    
    .cdd-try-it-out { margin-top: 2rem; border: 1px solid var(--cdd-outline-variant); border-radius: 8px; padding: 1rem; }
    .cdd-try-summary { font-weight: 500; cursor: pointer; user-select: none; }
    .cdd-try-field { margin-top: 1rem; display: flex; flex-direction: column; }
    .cdd-try-field label { font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem; }
    .cdd-try-field input, .cdd-try-field textarea { padding: 0.5rem; border: 1px solid var(--cdd-outline-variant); border-radius: 4px; font-family: 'Roboto Mono', monospace; background: var(--cdd-surface); color: var(--cdd-on-surface); }
    .cdd-try-btn { margin-top: 1rem; background: var(--cdd-primary); color: var(--cdd-on-primary); border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-weight: 500; }
    .cdd-try-btn:hover { opacity: 0.9; }

    ${languages.map(lang => `#lang-opt-${lang}:checked ~ .cdd-layout label[for="lang-opt-${lang}"] { background: var(--cdd-primary); color: var(--cdd-on-primary); border-color: var(--cdd-primary); font-weight: 500; }`).join('\n')}
    ${languages.map(lang => `#lang-opt-${lang}:focus-visible ~ .cdd-layout label[for="lang-opt-${lang}"] { outline: 2px solid var(--cdd-primary); outline-offset: 2px; }`).join('\n')}
    #opt-imports:checked ~ .cdd-layout label[for="opt-imports"] { background: var(--cdd-primary); color: var(--cdd-on-primary); border-color: var(--cdd-primary); }
    #opt-imports:focus-visible ~ .cdd-layout label[for="opt-imports"] { outline: 2px solid var(--cdd-primary); outline-offset: 2px; }
    #opt-wrapping:checked ~ .cdd-layout label[for="opt-wrapping"] { background: var(--cdd-primary); color: var(--cdd-on-primary); border-color: var(--cdd-primary); }
    #opt-wrapping:focus-visible ~ .cdd-layout label[for="opt-wrapping"] { outline: 2px solid var(--cdd-primary); outline-offset: 2px; }
    #opt-dark-mode:checked ~ .cdd-layout label[for="opt-dark-mode"] { background: var(--cdd-primary); color: var(--cdd-on-primary); border-color: var(--cdd-primary); }
    #opt-dark-mode:focus-visible ~ .cdd-layout label[for="opt-dark-mode"] { outline: 2px solid var(--cdd-primary); outline-offset: 2px; }

    /* Variant display logic */
    .cdd-variant-block { display: none; }
    
    #opt-imports:checked ~ #opt-wrapping:checked ~ .cdd-layout .cdd-variant-block.cdd-show-if-imports.cdd-show-if-wrapping { display: block; }
    #opt-imports:not(:checked) ~ #opt-wrapping:checked ~ .cdd-layout .cdd-variant-block.cdd-hide-if-imports.cdd-show-if-wrapping { display: block; }
    #opt-imports:checked ~ #opt-wrapping:not(:checked) ~ .cdd-layout .cdd-variant-block.cdd-show-if-imports.cdd-hide-if-wrapping { display: block; }
    #opt-imports:not(:checked) ~ #opt-wrapping:not(:checked) ~ .cdd-layout .cdd-variant-block.cdd-hide-if-imports.cdd-hide-if-wrapping { display: block; }
  </style>
</head>
<body>
  ${languages.map((lang, i) => `<input type="radio" id="lang-opt-${lang}" name="global-lang" class="cdd-visually-hidden" ${i === 0 ? 'checked' : ''}>`).join('')}
  <input type="checkbox" id="opt-imports" class="cdd-visually-hidden" checked>
  <input type="checkbox" id="opt-wrapping" class="cdd-visually-hidden" checked>
  <input type="checkbox" id="opt-dark-mode" class="cdd-visually-hidden" ${theme === 'dark' ? 'checked' : ''}>

  <div class="cdd-layout">
    <aside class="cdd-sidebar-left">
      <h1 style="font-size: 1.25rem;">${spec.info.title}</h1>
      <div class="cdd-sidebar-title">${t.paths}</div>
      ${tocHtml}
      <div class="cdd-sidebar-title">${t.schemas}</div>
      <nav>
        ${
            spec.components?.schemas
                ? Object.keys(spec.components.schemas)
                      .map(name => `<a href="#schema-${name}" class="cdd-toc-item">${name}</a>`)
                      .join('')
                : ''
        }
      </nav>
    </aside>

    <main class="cdd-main">
      <header>
        <h1 style="font-size: 3rem; font-weight: 300;">${spec.info.title}</h1>
        <div class="cdd-description">${renderMarkdown(spec.info.description)}</div>
        ${spec.info.termsOfService ? `<p style="font-size: 0.875rem;"><a href="${spec.info.termsOfService}" target="_blank">Terms of Service</a></p>` : ''}
        ${
            spec.info.contact
                ? `<p style="font-size: 0.875rem;">Contact: ${
                      spec.info.contact.url
                          ? `<a href="${spec.info.contact.url}" target="_blank">${spec.info.contact.name || 'API Support'}</a>`
                          : spec.info.contact.email
                            ? `<a href="mailto:${spec.info.contact.email}">${spec.info.contact.name || spec.info.contact.email}</a>`
                            : spec.info.contact.name
                  }</p>`
                : ''
        }
      </header>
      ${mainHtml}
      ${schemasHtml}
    </main>

    <aside class="cdd-sidebar-right">
      <div class="cdd-sidebar-title">${t.settings}</div>
      
      <p style="font-size: 0.875rem; margin-bottom: 0.5rem;">Appearance</p>
      <label for="opt-dark-mode" class="cdd-setting-label">
        ${t.darkMode}
      </label>

      <p style="font-size: 0.875rem; margin-top: 1rem; margin-bottom: 0.5rem;">${t.language}</p>
      ${languages
          .map(
              lang => `
        <label for="lang-opt-${lang}" class="cdd-setting-label">
          ${lang}
        </label>
      `,
          )
          .join('')}
      
      <div style="margin-top: 1rem;">
        <label for="opt-imports" class="cdd-setting-label">
          ${t.includeImports}
        </label>
        <label for="opt-wrapping" class="cdd-setting-label">
          ${t.includeWrapping}
        </label>
      </div>
    </aside>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
  ${
      injectLiveReload
          ? `
  <script>
    if (typeof window !== "undefined") {
      const eventSource = new EventSource('/__livereload');
      eventSource.onmessage = (e) => {
        if (e.data === 'reload') window.location.reload();
      };
    }
  </script>`
          : ''
  }
</body>
</html>`;
}
