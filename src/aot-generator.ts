/**
 * Ahead-Of-Time (AOT) Static HTML and CSS Generator for OpenAPI 3.2.0, Swagger 2.0, and Arazzo 1.1.0 Documentation.
 * @module aot-generator
 */

import { marked } from 'marked';
import {
    CodeExample,
    SchemaObject,
    ReferenceObject,
    OperationObject,
    PathItemObject,
    ParameterObject,
    RequestBodyObject,
    ResponseObject,
    ComponentsObject,
    ServerObject,
    DocData,
    DocTranslations,
    defaultTranslations,
    NormalizedWorkflow,
    SelectorObject,
    CriterionObject,
    ArazzoComponentsObject,
} from './types';
import { normalizeSpec, mapSdkExamples, isReference, getPathOperations } from './parser';
import { isSelectorObject } from './arazzo-parser';

/**
 * Escapes HTML special characters (`&`, `<`, `>`, `"`, `'`) to prevent XSS and broken markup.
 * @param str The raw string to escape.
 * @returns The HTML-escaped string.
 */
export function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Sanitizes a URL string for safe insertion into `href` or `src` attributes, neutralizing
 * dangerous schemes such as `javascript:`, `vbscript:`, or `data:`.
 * @param url The raw URL string to validate.
 * @returns The escaped safe URL string, or `'#'` if the scheme is unsafe.
 */
export function sanitizeUrl(url: string): string {
    const trimmed = url.trim();
    if (/^(javascript|vbscript|data):/i.test(trimmed)) {
        return '#';
    }
    return escapeHtml(trimmed);
}

/**
 * Sanitizes a language or identifier token for safe interpolation into CSS selectors and custom property names.
 * @param ident The raw identifier string.
 * @returns An alphanumeric/hyphen/underscore CSS-safe identifier string.
 */
export function sanitizeCssIdent(ident: string): string {
    return ident.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Interpolates default values for `{variable}` placeholders in an OpenAPI `ServerObject` URL.
 * @param server The `ServerObject` to resolve, or `undefined`.
 * @returns The resolved base URL string (defaults to `'https://api.example.com'`).
 */
export function interpolateServerVariables(server: ServerObject | undefined): string {
    if (!server || !server.url) return 'https://api.example.com';
    let url = server.url;
    if (server.variables) {
        for (const [varName, varObj] of Object.entries(server.variables)) {
            url = url.replace(new RegExp(`\\{${varName}\\}`, 'g'), varObj.default);
        }
    }
    return url;
}

/**
 * Basic markdown rendering for descriptions with raw HTML/script tag and unsafe link sanitization.
 * @param text The raw markdown string to convert to HTML.
 * @returns The rendered and sanitized HTML string, or an empty string if undefined/empty.
 */
export function renderMarkdown(text: string | undefined): string {
    if (!text) return '';
    const rawHtml = marked.parse(text, { async: false });
    return rawHtml
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/href\s*=\s*"(?:javascript|vbscript|data):[^"]*"/gi, 'href="#"')
        .replace(/href\s*=\s*'(?:javascript|vbscript|data):[^']*'/gi, "href='#'");
}

/**
 * Dereferences a `ParameterObject | ReferenceObject` against `components.parameters`.
 * @param param The parameter or reference object.
 * @param components Optional OpenAPI `ComponentsObject`.
 * @returns The resolved `ParameterObject`, or `undefined` if it is an unresolvable reference.
 */
export function resolveParameterRef(
    param: ParameterObject | ReferenceObject,
    components?: ComponentsObject,
): ParameterObject | undefined {
    if (!isReference(param)) return param;
    const prefix = '#/components/parameters/';
    const key = param.$ref.startsWith(prefix) ? param.$ref.slice(prefix.length) : param.$ref;
    const found = components?.parameters?.[key];
    if (found && !isReference(found)) {
        return found;
    }
    return undefined;
}

/**
 * Merges and dereferences path-level parameters and operation-level parameters.
 * Operation-level parameters with the same `(name, in)` pair override path-level parameters.
 * @param pathItem Optional parent `PathItemObject`.
 * @param op The `OperationObject`.
 * @param components Optional OpenAPI `ComponentsObject`.
 * @returns Deduplicated array of resolved `ParameterObject` items.
 */
export function resolveOperationParameters(
    pathItem: PathItemObject | undefined,
    op: OperationObject,
    components?: ComponentsObject,
): ParameterObject[] {
    const map = new Map<string, ParameterObject>();
    const combined = [...(pathItem?.parameters ?? []), ...(op.parameters ?? [])];
    for (const raw of combined) {
        const resolved = resolveParameterRef(raw, components);
        if (resolved) {
            map.set(`${resolved.in}:${resolved.name}`, resolved);
        }
    }
    return Array.from(map.values());
}

/**
 * Dereferences a `RequestBodyObject | ReferenceObject` against `components.requestBodies`.
 * @param rb The request body or reference object.
 * @param components Optional OpenAPI `ComponentsObject`.
 * @returns The resolved `RequestBodyObject`, or `undefined` if it is an unresolvable reference.
 */
export function resolveRequestBodyRef(
    rb: RequestBodyObject | ReferenceObject | undefined,
    components?: ComponentsObject,
): RequestBodyObject | undefined {
    if (!rb) return undefined;
    if (!isReference(rb)) return rb;
    const prefix = '#/components/requestBodies/';
    const key = rb.$ref.startsWith(prefix) ? rb.$ref.slice(prefix.length) : rb.$ref;
    const found = components?.requestBodies?.[key];
    if (found && !isReference(found)) {
        return found;
    }
    return undefined;
}

/**
 * Dereferences a `ResponseObject | ReferenceObject` against `components.responses`.
 * @param resp The response or reference object.
 * @param components Optional OpenAPI `ComponentsObject`.
 * @returns The resolved `ResponseObject`, or `undefined` if it is an unresolvable reference.
 */
export function resolveResponseRef(
    resp: ResponseObject | ReferenceObject | undefined,
    components?: ComponentsObject,
): ResponseObject | undefined {
    if (!resp) return undefined;
    if (!isReference(resp)) return resp;
    const prefix = '#/components/responses/';
    const key = resp.$ref.startsWith(prefix) ? resp.$ref.slice(prefix.length) : resp.$ref;
    const found = components?.responses?.[key];
    if (found && !isReference(found)) {
        return found;
    }
    return undefined;
}

/**
 * Generates a curl command for a given operation.
 * @param method The HTTP method (`get`, `post`, etc.).
 * @param route The API route path.
 * @param op The OpenAPI operation object.
 * @param baseUrl The base server URL (defaults to `'https://api.example.com'`).
 * @param pathItem Optional parent `PathItemObject` for inherited parameters.
 * @param components Optional OpenAPI `ComponentsObject` for dereferencing `$ref` parameters/requestBodies.
 * @returns A string containing the curl command.
 */
export function generateCurl(
    method: string,
    route: string,
    op: OperationObject,
    baseUrl: string = 'https://api.example.com',
    pathItem?: PathItemObject,
    components?: ComponentsObject,
): string {
    const upperMethod = method.toUpperCase();
    const methodPart = upperMethod === 'GET' ? '' : `-X ${upperMethod} `;
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    let curl = `curl ${methodPart}"${normalizedBase}${route}"`;

    const cont = ' \\\n  ';
    const mergedParams = resolveOperationParameters(pathItem, op, components);
    for (const p of mergedParams) {
        if (p.in === 'header') {
            curl += `${cont}-H "${p.name}: <value>"`;
        }
    }

    const resolvedRb = resolveRequestBodyRef(op.requestBody, components);
    if (resolvedRb && resolvedRb.content) {
        const firstType = Object.keys(resolvedRb.content)[0];
        if (firstType) {
            curl += `${cont}-H "Content-Type: ${firstType}"`;
            curl += `${cont}-d '{"key": "value"}'`;
        }
    }

    return curl;
}

/**
 * Maximum recursion depth when rendering nested schemas.
 */
const MAX_SCHEMA_DEPTH = 10;

/**
 * Recursively renders a schema object into an HTML table-like structure.
 * @param schema The SchemaObject or ReferenceObject to render.
 * @param depth Current recursion depth.
 * @param namePrefix Prefix for property IDs to ensure uniqueness.
 * @param t Localization strings for table headers and labels.
 * @returns HTML string for the schema.
 */
export function renderSchema(
    schema: SchemaObject | ReferenceObject,
    depth: number = 0,
    namePrefix: string = '',
    t: DocTranslations = defaultTranslations,
): string {
    if (depth > MAX_SCHEMA_DEPTH) {
        return `<span class="cdd-prop-type">object</span>`;
    }

    if (isReference(schema)) {
        const refName = schema.$ref.split('/').pop() || schema.$ref;
        return `<span class="cdd-schema-ref">${escapeHtml(refName)}</span>`;
    }

    let html = `<div class="cdd-schema-container" style="margin-left: ${depth * 16}px">`;

    if (schema.type === 'object' && schema.properties) {
        html += `<table class="cdd-schema-table">
      <thead><tr><th>${escapeHtml(t.tableHeaderProperty)}</th><th>${escapeHtml(t.tableHeaderType)}</th><th>${escapeHtml(t.tableHeaderDescription)}</th></tr></thead>
      <tbody>`;
        for (const [name, prop] of Object.entries(schema.properties)) {
            const isRequired = schema.required?.includes(name) ?? false;
            const propId = namePrefix ? `${namePrefix}-prop-${name}` : `prop-${name}`;

            if (isReference(prop)) {
                const refName = prop.$ref.split('/').pop() || prop.$ref;
                html += `<tr id="${escapeHtml(propId)}" class="cdd-deep-link-row">
        <td><a href="#${escapeHtml(propId)}" class="cdd-anchor">#</a><span class="cdd-prop-name">${escapeHtml(name)}${isRequired ? '<span class="cdd-required">*</span>' : ''}</span></td>
        <td><span class="cdd-schema-ref">${escapeHtml(refName)}</span></td>
        <td><div class="cdd-prop-desc">${renderMarkdown(prop.description)}</div></td>
      </tr>`;
            } else {
                const propType = prop.type || 'any';
                html += `<tr id="${escapeHtml(propId)}" class="cdd-deep-link-row">
        <td><a href="#${escapeHtml(propId)}" class="cdd-anchor">#</a><span class="cdd-prop-name">${escapeHtml(name)}${isRequired ? '<span class="cdd-required">*</span>' : ''}</span></td>
        <td><span class="cdd-prop-type">${escapeHtml(propType)}</span></td>
        <td><div class="cdd-prop-desc">${renderMarkdown(prop.description)}</div></td>
      </tr>`;
                if (prop.type === 'object' || prop.type === 'array') {
                    html += `<tr><td colspan="3">${renderSchema(prop, depth + 1, propId, t)}</td></tr>`;
                }
            }
        }
        html += `</tbody></table>`;
    } else if (schema.type === 'array' && schema.items) {
        html += `<div class="cdd-schema-array">${escapeHtml(t.arrayOf)} ${renderSchema(schema.items, depth + 1, namePrefix, t)}</div>`;
    } else {
        html += `<span class="cdd-prop-type">${escapeHtml(schema.type || 'any')}</span>`;
        if (schema.description) {
            html += `<div class="cdd-prop-desc">${renderMarkdown(schema.description)}</div>`;
        }
    }

    html += `</div>`;
    return html;
}

/**
 * Formats an Arazzo parameter, replacement, or output value (literal, runtime expression, or `SelectorObject`) as HTML.
 * @param val The value or `SelectorObject` to format.
 * @returns Escaped HTML representation of the value.
 */
export function renderArazzoValue(val: unknown): string {
    if (isSelectorObject(val)) {
        const selType =
            typeof val.type === 'object' && val.type !== null
                ? `${val.type.type} (${val.type.version})`
                : val.type || 'jsonpointer';
        return `<code class="cdd-expr-badge">${escapeHtml(val.context)}</code> &rarr; <code>${escapeHtml(val.selector)}</code> <span class="cdd-badge cdd-badge-meta">${escapeHtml(selType)}</span>`;
    }
    if (typeof val === 'string') {
        return `<code>${escapeHtml(val)}</code>`;
    }
    return `<code>${escapeHtml(JSON.stringify(val))}</code>`;
}

/**
 * Formats a `CriterionObject`'s type (string or `CriterionExpressionTypeObject`) into a badge string.
 * @param crit The `CriterionObject` to inspect.
 * @returns The formatted criterion type string.
 */
export function formatCriterionType(crit: CriterionObject): string {
    if (!crit.type) return 'simple';
    if (typeof crit.type === 'string') return crit.type;
    return `${crit.type.type} (${crit.type.version})`;
}

/**
 * Renders the right-hand multi-language code tab panel for either an OpenAPI operation or an Arazzo workflow.
 * @param id Unique identifier for the card (`operationId` or `workflow-${workflowId}`).
 * @param curlOrCliPreview The cURL command or workflow CLI preview script.
 * @param examples The list of `CodeExample` items mapped to this operation or workflow.
 * @param languages The list of active target languages.
 * @param t Localization strings.
 * @returns HTML string for the `<aside class="cdd-endpoint-code">` block.
 */
export function renderCodeAside(
    id: string,
    curlOrCliPreview: string,
    examples: CodeExample[],
    languages: string[],
    t: DocTranslations,
): string {
    return `
          <aside class="cdd-endpoint-code">
            <div class="cdd-code-card">
              <div class="cdd-code-tabs">
                <input type="radio" id="tab-curl-${escapeHtml(id)}" name="tab-${escapeHtml(id)}" class="cdd-tab-input" checked>
                <label for="tab-curl-${escapeHtml(id)}" class="cdd-tab-label">${escapeHtml(t.tabCurl)}</label>
                
                <input type="radio" id="tab-sdk-${escapeHtml(id)}" name="tab-${escapeHtml(id)}" class="cdd-tab-input">
                <label for="tab-sdk-${escapeHtml(id)}" class="cdd-tab-label">${escapeHtml(t.tabSdk)}</label>

                <div class="cdd-tab-content cdd-tab-content-curl">
                  <div style="position: relative;">
                    <button class="cdd-copy-btn">${escapeHtml(t.copy)}</button>
                    <pre><code class="language-bash">${escapeHtml(curlOrCliPreview)}</code></pre>
                  </div>
                </div>
                <div class="cdd-tab-content cdd-tab-content-sdk">
                  ${languages
                      .map(lang => {
                          const safeLang = sanitizeCssIdent(lang);
                          const langEx = examples.filter(ex => ex.language === lang);
                          const prismLang = lang === 'ts' ? 'typescript' : lang === 'sh' ? 'bash' : safeLang;
                          return `
                      <div class="cdd-lang-block cdd-show-if-${safeLang}">
                        ${
                            langEx.length > 0
                                ? langEx
                                      .map(ex => {
                                          const importsClass = ex.includeImports
                                              ? 'cdd-show-if-imports'
                                              : 'cdd-hide-if-imports';
                                          const wrappingClass = ex.includeWrapping
                                              ? 'cdd-show-if-wrapping'
                                              : 'cdd-hide-if-wrapping';
                                          return `
                          <div class="cdd-variant-block ${importsClass} ${wrappingClass}">
                            <div style="position: relative;">
                              <button class="cdd-copy-btn">${escapeHtml(t.copy)}</button>
                              <pre><code class="language-${escapeHtml(prismLang)}">${escapeHtml(ex.content)}</code></pre>
                            </div>
                          </div>
                        `;
                                      })
                                      .join('')
                                : `<div class="cdd-no-example">${escapeHtml(t.noExampleFor)} ${escapeHtml(lang)}</div>`
                        }
                      </div>
                    `;
                      })
                      .join('')}
                </div>
              </div>
            </div>
          </aside>`;
}

/**
 * Renders an Arazzo 1.1.0 workflow card including its inputs schema, step pipeline, criteria, actions, outputs, interactive runner, and multi-language SDK code tabs.
 * @param nw The `NormalizedWorkflow` to render.
 * @param docData The parent `DocData` structure.
 * @param languages Active target languages for the SDK code panel.
 * @param t Localization strings.
 * @returns HTML string for the `<article class="cdd-endpoint cdd-workflow">` section.
 */
export function renderWorkflowSection(
    nw: NormalizedWorkflow,
    docData: DocData,
    languages: string[],
    t: DocTranslations = defaultTranslations,
): string {
    const wf = nw.workflow;
    const wfDomId = `workflow-${wf.workflowId}`;
    const examples = docData.workflowCodeExamples?.[wf.workflowId] ?? [];
    const baseUrl = interpolateServerVariables(docData.spec.servers?.[0]);

    const dependsOnHtml =
        wf.dependsOn && wf.dependsOn.length > 0
            ? `<div class="cdd-workflow-depends">
                <strong>${escapeHtml(t.workflowDependsOnHeading)}:</strong>
                ${wf.dependsOn
                    .map(dep => {
                        const depParts = dep.split('.workflows.');
                        const cleanDep = depParts[1] ?? dep;
                        return `<a href="#workflow-${escapeHtml(cleanDep)}" class="cdd-badge cdd-badge-workflow">${escapeHtml(dep)}</a>`;
                    })
                    .join(' ')}
              </div>`
            : '';

    const cycleBadgeHtml = nw.hasCycles ? `<span class="cdd-badge cdd-badge-delete">DAG CYCLE DETECTED</span>` : '';

    const inputsHtml = nw.resolvedInputs
        ? `<h3 class="cdd-section-title">${escapeHtml(t.workflowInputsHeading)}</h3>
           ${renderSchema(nw.resolvedInputs, 0, `${wfDomId}-input`, t)}`
        : '';

    const stepsHtml = nw.normalizedSteps
        .map((ns, idx) => {
            const st = ns.step;
            const stepDomId = `step-${wf.workflowId}-${st.stepId}`;
            let targetBadgeHtml = '';

            if (ns.linkedTarget) {
                const lt = ns.linkedTarget;
                if (lt.kind === 'workflow') {
                    targetBadgeHtml = `<a href="#${escapeHtml(lt.anchorId || '')}" class="cdd-badge cdd-badge-workflow">WORKFLOW: ${escapeHtml(lt.operationId || '')}</a>`;
                } else if (lt.kind === 'channel') {
                    const actUpper = (lt.method || 'send').toUpperCase();
                    targetBadgeHtml = `<span class="cdd-badge cdd-badge-channel">${escapeHtml(actUpper)} ${escapeHtml(lt.route || '')}</span>`;
                } else {
                    const mUpper = (lt.method || 'OP').toUpperCase();
                    const label = lt.route ? `${mUpper} ${lt.route}` : lt.operationId || mUpper;
                    targetBadgeHtml = lt.anchorId
                        ? `<a href="#${escapeHtml(lt.anchorId)}" class="cdd-badge cdd-badge-${escapeHtml(lt.method || 'get')} cdd-badge-${escapeHtml(mUpper)}">${escapeHtml(label)}</a>`
                        : `<span class="cdd-badge cdd-badge-get">${escapeHtml(label)}</span>`;
                }
            }

            const metaBadges: string[] = [];
            if (st.timeout !== undefined) {
                metaBadges.push(
                    `<span class="cdd-badge cdd-badge-meta">timeout: ${escapeHtml(String(st.timeout))}ms</span>`,
                );
            }
            if (st.correlationId) {
                metaBadges.push(
                    `<span class="cdd-badge cdd-badge-meta">correlationId: ${escapeHtml(st.correlationId)}</span>`,
                );
            }
            if (ns.upstreamStepIds.length > 0) {
                for (const upId of ns.upstreamStepIds) {
                    metaBadges.push(
                        `<a href="#step-${escapeHtml(wf.workflowId)}-${escapeHtml(upId)}" class="cdd-badge cdd-badge-meta">&larr; ${escapeHtml(upId)}</a>`,
                    );
                }
            }

            const paramsTable =
                ns.mergedParameters.length > 0
                    ? `<h4 class="cdd-step-subtitle">${escapeHtml(t.stepParametersHeading)}</h4>
                       <table class="cdd-params-table">
                         <thead><tr><th>${escapeHtml(t.tableHeaderName)}</th><th>${escapeHtml(t.tableHeaderIn)}</th><th>Value / Expression</th></tr></thead>
                         <tbody>
                           ${ns.mergedParameters
                               .map(
                                   p => `<tr>
                                 <td><code>${escapeHtml(p.name)}</code></td>
                                 <td>${escapeHtml(p.in || 'workflow')}</td>
                                 <td>${renderArazzoValue(p.value)}</td>
                               </tr>`,
                               )
                               .join('')}
                         </tbody>
                       </table>`
                    : '';

            const requestBodyBlock = st.requestBody
                ? `<h4 class="cdd-step-subtitle">${escapeHtml(t.stepRequestBodyHeading)}${st.requestBody.contentType ? ` (<code>${escapeHtml(st.requestBody.contentType)}</code>)` : ''}</h4>
                   ${
                       st.requestBody.payload !== undefined
                           ? `<pre class="cdd-payload-pre"><code>${escapeHtml(typeof st.requestBody.payload === 'string' ? st.requestBody.payload : JSON.stringify(st.requestBody.payload, null, 2))}</code></pre>`
                           : ''
                   }
                   ${
                       st.requestBody.replacements && st.requestBody.replacements.length > 0
                           ? `<table class="cdd-params-table">
                                <thead><tr><th>Target Pointer</th><th>Replacement Value</th></tr></thead>
                                <tbody>
                                  ${st.requestBody.replacements
                                      .map(
                                          rep => `<tr>
                                        <td><code>${escapeHtml(rep.target)}</code></td>
                                        <td>${renderArazzoValue(rep.value)}</td>
                                      </tr>`,
                                      )
                                      .join('')}
                                </tbody>
                              </table>`
                           : ''
                   }`
                : '';

            const criteriaBlock =
                st.successCriteria && st.successCriteria.length > 0
                    ? `<h4 class="cdd-step-subtitle">${escapeHtml(t.successCriteriaHeading)}</h4>
                       <table class="cdd-params-table">
                         <thead><tr><th>Context</th><th>Condition</th><th>${escapeHtml(t.tableHeaderType)}</th></tr></thead>
                         <tbody>
                           ${st.successCriteria
                               .map(
                                   c => `<tr>
                                 <td><code>${escapeHtml(c.context || '$statusCode')}</code></td>
                                 <td><code>${escapeHtml(c.condition)}</code></td>
                                 <td><span class="cdd-badge cdd-badge-meta">${escapeHtml(formatCriterionType(c))}</span></td>
                               </tr>`,
                               )
                               .join('')}
                         </tbody>
                       </table>`
                    : '';

            const onSuccessBlock =
                ns.resolvedOnSuccess.length > 0
                    ? `<h4 class="cdd-step-subtitle">${escapeHtml(t.onSuccessHeading)}</h4>
                       <ul class="cdd-action-list">
                         ${ns.resolvedOnSuccess
                             .map(act => {
                                 const target = act.stepId
                                     ? ` &rarr; step <code>${escapeHtml(act.stepId)}</code>`
                                     : act.workflowId
                                       ? ` &rarr; workflow <code>${escapeHtml(act.workflowId)}</code>`
                                       : '';
                                 return `<li><span class="cdd-badge cdd-badge-post">${escapeHtml(act.type.toUpperCase())}</span> <strong>${escapeHtml(act.name)}</strong>${target}</li>`;
                             })
                             .join('')}
                       </ul>`
                    : '';

            const onFailureBlock =
                ns.resolvedOnFailure.length > 0
                    ? `<h4 class="cdd-step-subtitle">${escapeHtml(t.onFailureHeading)}</h4>
                       <ul class="cdd-action-list">
                         ${ns.resolvedOnFailure
                             .map(act => {
                                 const target = act.stepId
                                     ? ` &rarr; step <code>${escapeHtml(act.stepId)}</code>`
                                     : act.workflowId
                                       ? ` &rarr; workflow <code>${escapeHtml(act.workflowId)}</code>`
                                       : '';
                                 const retryMeta =
                                     act.retryLimit !== undefined || act.retryAfter !== undefined
                                         ? ` (retryLimit: ${escapeHtml(String(act.retryLimit ?? 1))}, retryAfter: ${escapeHtml(String(act.retryAfter ?? 0))}s)`
                                         : '';
                                 return `<li><span class="cdd-badge cdd-badge-delete">${escapeHtml(act.type.toUpperCase())}</span> <strong>${escapeHtml(act.name)}</strong>${target}${retryMeta}</li>`;
                             })
                             .join('')}
                       </ul>`
                    : '';

            const stepOutputsBlock =
                st.outputs && Object.keys(st.outputs).length > 0
                    ? `<h4 class="cdd-step-subtitle">${escapeHtml(t.stepOutputsHeading)}</h4>
                       <table class="cdd-params-table">
                         <thead><tr><th>${escapeHtml(t.tableHeaderName)}</th><th>Expression / Selector</th></tr></thead>
                         <tbody>
                           ${Object.entries(st.outputs)
                               .map(
                                   ([outKey, outVal]) => `<tr>
                                 <td><code>${escapeHtml(outKey)}</code></td>
                                 <td>${renderArazzoValue(outVal)}</td>
                               </tr>`,
                               )
                               .join('')}
                         </tbody>
                       </table>`
                    : '';

            return `
              <div id="${escapeHtml(stepDomId)}" class="cdd-step-card cdd-deep-link-row" data-step-id="${escapeHtml(st.stepId)}" data-method="${escapeHtml((ns.linkedTarget?.method || 'GET').toUpperCase())}" data-route="${escapeHtml(ns.linkedTarget?.route || `/${st.stepId}`)}" data-base-url="${escapeHtml(baseUrl)}">
                <div class="cdd-step-header">
                  <span class="cdd-step-index">${idx + 1}</span>
                  <a href="#${escapeHtml(stepDomId)}" class="cdd-anchor">#</a>
                  <strong class="cdd-step-title">${escapeHtml(st.stepId)}</strong>
                  ${targetBadgeHtml}
                  ${metaBadges.join(' ')}
                </div>
                ${st.description ? `<div class="cdd-description">${renderMarkdown(st.description)}</div>` : ''}
                ${paramsTable}
                ${requestBodyBlock}
                ${criteriaBlock}
                ${onSuccessBlock}
                ${onFailureBlock}
                ${stepOutputsBlock}
              </div>`;
        })
        .join('');

    const wfOutputsBlock =
        wf.outputs && Object.keys(wf.outputs).length > 0
            ? `<h3 class="cdd-section-title">${escapeHtml(t.workflowOutputsHeading)}</h3>
               <table class="cdd-params-table">
                 <thead><tr><th>${escapeHtml(t.tableHeaderName)}</th><th>Expression / Selector</th></tr></thead>
                 <tbody>
                   ${Object.entries(wf.outputs)
                       .map(
                           ([outKey, outVal]: [string, string | SelectorObject]) => `<tr>
                         <td><code>${escapeHtml(outKey)}</code></td>
                         <td>${renderArazzoValue(outVal)}</td>
                       </tr>`,
                       )
                       .join('')}
                 </tbody>
               </table>`
            : '';

    return `
        <article id="${escapeHtml(wfDomId)}" class="cdd-endpoint cdd-workflow">
          <div class="cdd-endpoint-info">
            <h2 class="cdd-endpoint-title">${escapeHtml(wf.summary || wf.workflowId)}</h2>
            <div class="cdd-endpoint-path-row">
              <span class="cdd-badge cdd-badge-workflow">WORKFLOW</span>
              <code class="cdd-path-text">${escapeHtml(wf.workflowId)}</code>
              ${cycleBadgeHtml}
            </div>
            ${wf.description ? `<div class="cdd-description">${renderMarkdown(wf.description)}</div>` : ''}
            ${dependsOnHtml}
            ${inputsHtml}

            <h3 class="cdd-section-title">${escapeHtml(t.stepsHeading)}</h3>
            <div class="cdd-steps-pipeline">
              ${stepsHtml}
            </div>

            ${wfOutputsBlock}

            <details class="cdd-try-it-out">
              <summary class="cdd-try-summary">${escapeHtml(t.runWorkflowBtn)}</summary>
              <form class="cdd-workflow-try-form" action="/" method="POST" data-workflow-id="${escapeHtml(wf.workflowId)}" data-base-url="${escapeHtml(baseUrl)}">
                <div class="cdd-try-field">
                  <label for="try-wf-${escapeHtml(wf.workflowId)}-inputs">${escapeHtml(t.workflowInputsHeading)} (JSON)</label>
                  <textarea id="try-wf-${escapeHtml(wf.workflowId)}-inputs" name="workflowInputs" rows="3">{}</textarea>
                </div>
                <button type="submit" class="cdd-try-btn">${escapeHtml(t.runWorkflowBtn)}</button>
              </form>
              <div class="cdd-try-response" style="display: none; margin-top: 1rem;">
                <h4 style="margin:0 0 0.5rem 0;">${escapeHtml(t.response)}</h4>
                <div class="cdd-try-status"></div>
                <pre><code class="cdd-try-body"></code></pre>
              </div>
            </details>
          </div>

          ${renderCodeAside(wfDomId, nw.cliPreview, examples, languages, t)}
        </article>`;
}

/**
 * Renders reusable Arazzo `$components` (`inputs`, `parameters`, `successActions`, `failureActions`) when present.
 * @param components The `ArazzoComponentsObject` to render.
 * @param t Localization strings.
 * @returns HTML string for the Arazzo components section.
 */
export function renderArazzoComponents(
    components: ArazzoComponentsObject | undefined,
    t: DocTranslations = defaultTranslations,
): string {
    if (!components) return '';
    const inputEntries = Object.entries(components.inputs ?? {});
    const paramEntries = Object.entries(components.parameters ?? {});
    const successEntries = Object.entries(components.successActions ?? {});
    const failureEntries = Object.entries(components.failureActions ?? {});

    if (
        inputEntries.length === 0 &&
        paramEntries.length === 0 &&
        successEntries.length === 0 &&
        failureEntries.length === 0
    ) {
        return '';
    }

    let html = `<h2 id="section-arazzo-components" class="cdd-main-title">${escapeHtml(t.arazzoComponentsHeading)}</h2>`;

    for (const [name, schema] of inputEntries) {
        html += `<div id="arazzo-input-${escapeHtml(name)}" class="cdd-schema-section">
          <h3 class="cdd-schema-title">$components.inputs.${escapeHtml(name)}</h3>
          ${renderSchema(schema, 0, `arazzo-input-${name}`, t)}
        </div>`;
    }

    if (paramEntries.length > 0) {
        html += `<div class="cdd-schema-section">
          <h3 class="cdd-schema-title">$components.parameters</h3>
          <table class="cdd-params-table">
            <thead><tr><th>Key</th><th>${escapeHtml(t.tableHeaderName)}</th><th>${escapeHtml(t.tableHeaderIn)}</th><th>Default Value</th></tr></thead>
            <tbody>
              ${paramEntries
                  .map(
                      ([key, p]) => `<tr id="arazzo-param-${escapeHtml(key)}">
                    <td><code>${escapeHtml(key)}</code></td>
                    <td><code>${escapeHtml(p.name)}</code></td>
                    <td>${escapeHtml(p.in || 'workflow')}</td>
                    <td>${renderArazzoValue(p.value)}</td>
                  </tr>`,
                  )
                  .join('')}
            </tbody>
          </table>
        </div>`;
    }

    if (successEntries.length > 0) {
        html += `<div class="cdd-schema-section">
          <h3 class="cdd-schema-title">$components.successActions</h3>
          <ul class="cdd-action-list">
            ${successEntries
                .map(
                    ([key, act]) =>
                        `<li id="arazzo-success-${escapeHtml(key)}"><code>${escapeHtml(key)}</code>: <span class="cdd-badge cdd-badge-post">${escapeHtml(act.type.toUpperCase())}</span> <strong>${escapeHtml(act.name)}</strong></li>`,
                )
                .join('')}
          </ul>
        </div>`;
    }

    if (failureEntries.length > 0) {
        html += `<div class="cdd-schema-section">
          <h3 class="cdd-schema-title">$components.failureActions</h3>
          <ul class="cdd-action-list">
            ${failureEntries
                .map(
                    ([key, act]) =>
                        `<li id="arazzo-failure-${escapeHtml(key)}"><code>${escapeHtml(key)}</code>: <span class="cdd-badge cdd-badge-delete">${escapeHtml(act.type.toUpperCase())}</span> <strong>${escapeHtml(act.name)}</strong></li>`,
                )
                .join('')}
          </ul>
        </div>`;
    }

    return html;
}

/**
 * Structured fragment output produced by `generateAOTBodyAndStyles` for direct embedding into `<cdd-api-docs>` or wrapping into a full HTML page.
 */
export interface AOTFragmentResult {
    /** The two `<style>` blocks (`.no-js` progressive enhancement rules and the Material 3 layout stylesheet). */
    stylesHtml: string;
    /** The inner HTML body content (hidden state inputs and `.cdd-layout` grid). */
    bodyHtml: string;
    /** The resolved specification title. */
    title: string;
    /** The resolved UI locale code. */
    locale: string;
}

/**
 * Generates the `<style>` blocks and `<body>` inner HTML fragments for the OpenAPI 3.2.0, Swagger 2.0, and/or Arazzo 1.1.0 documentation without requiring regex extraction.
 * @param specContent Raw OpenAPI or Arazzo spec string (YAML/JSON).
 * @param sdkExamples List of code examples to include.
 * @param theme UI theme (`'light'` or `'dark'`).
 * @param customTranslations Optional partial translation dictionary to override defaults.
 * @param companionArazzoContent Optional companion Arazzo 1.1.0 spec string (YAML/JSON) to render alongside an OpenAPI spec.
 * @returns An `AOTFragmentResult` containing `stylesHtml`, `bodyHtml`, `title`, and `locale`.
 */
export function generateAOTBodyAndStyles(
    specContent: string,
    sdkExamples: CodeExample[] = [],
    theme: 'light' | 'dark' = 'light',
    customTranslations: Partial<DocTranslations> = {},
    companionArazzoContent?: string,
): AOTFragmentResult {
    const t: DocTranslations = { ...defaultTranslations, ...customTranslations };
    const data = normalizeSpec(specContent, companionArazzoContent);
    if (sdkExamples.length > 0) {
        mapSdkExamples(data, sdkExamples);
    }

    const languages = Array.from(new Set(sdkExamples.map(ex => ex.language)));
    if (languages.length === 0) languages.push('javascript');

    const spec = data.spec;
    const baseUrl = interpolateServerVariables(spec.servers?.[0]);
    const paths = spec.paths || {};
    let mainHtml = '';
    let tocHtml = '';
    let webhooksTocHtml = '';
    let workflowsTocHtml = '';
    let schemasHtml = '';

    // Build Source Descriptions Banner if present
    const sourceDescriptionsHtml =
        data.sourceDescriptions && data.sourceDescriptions.length > 0
            ? `<div class="cdd-source-descriptions">
                <strong>${escapeHtml(t.sourceDescriptionsHeading)}:</strong>
                ${data.sourceDescriptions
                    .map(
                        sd =>
                            `<span class="cdd-source-chip"><span class="cdd-badge cdd-badge-meta">${escapeHtml(sd.type || 'openapi')}</span> <strong>${escapeHtml(sd.name)}</strong>: <code>${escapeHtml(sd.url)}</code></span>`,
                    )
                    .join(' ')}
              </div>`
            : '';

    // Build TOC and Main Content for OpenAPI Paths
    for (const [route, pathItem] of Object.entries(paths)) {
        if (isReference(pathItem)) continue;
        const operations = getPathOperations(pathItem);

        let routeHasOps = false;
        let routeToc = `<details class="cdd-toc-group"><summary class="cdd-toc-route">${escapeHtml(route)}</summary>`;

        for (const [m, op] of operations) {
            routeHasOps = true;
            const id = op.operationId || `${m}-${route}`;
            const upperMethod = m.toUpperCase();
            const opBaseUrl = op.servers?.[0]
                ? interpolateServerVariables(op.servers[0])
                : pathItem.servers?.[0]
                  ? interpolateServerVariables(pathItem.servers[0])
                  : baseUrl;

            routeToc += `<a href="#${escapeHtml(id)}" class="cdd-toc-item cdd-method-${escapeHtml(m)}">${escapeHtml(upperMethod)}</a>`;

            const curl = generateCurl(m, route, op, opBaseUrl, pathItem, spec.components);
            const examples = data.codeExamples[id] || [];
            const mergedParams = resolveOperationParameters(pathItem, op, spec.components);
            const resolvedRb = resolveRequestBodyRef(op.requestBody, spec.components);

            let requestBodySchemaHtml = '';
            if (resolvedRb && resolvedRb.content) {
                const mediaBlocks: string[] = [];
                for (const [mediaType, mt] of Object.entries(resolvedRb.content)) {
                    if (mt.schema) {
                        mediaBlocks.push(
                            `<div class="cdd-media-block"><code class="cdd-badge cdd-badge-meta">${escapeHtml(mediaType)}</code>${renderSchema(mt.schema, 0, `${id}-req`, t)}</div>`,
                        );
                    }
                }
                if (mediaBlocks.length > 0) {
                    requestBodySchemaHtml = `<h3 class="cdd-section-title">${escapeHtml(t.requestBody)}</h3>
                    ${resolvedRb.description ? `<div class="cdd-description">${renderMarkdown(resolvedRb.description)}</div>` : ''}
                    ${mediaBlocks.join('')}`;
                }
            }

            let responsesHtml = '';
            if (op.responses) {
                const respRows: string[] = [];
                for (const [statusCode, rawResp] of Object.entries(op.responses)) {
                    const resolvedResp = resolveResponseRef(rawResp, spec.components);
                    if (!resolvedResp) continue;
                    const mediaBlocks: string[] = [];
                    if (resolvedResp.content) {
                        for (const [mediaType, mt] of Object.entries(resolvedResp.content)) {
                            if (mt.schema) {
                                mediaBlocks.push(
                                    `<div><code class="cdd-badge cdd-badge-meta">${escapeHtml(mediaType)}</code>${renderSchema(mt.schema, 0, `${id}-resp-${statusCode}`, t)}</div>`,
                                );
                            }
                        }
                    }
                    respRows.push(
                        `<tr><td><code>${escapeHtml(statusCode)}</code></td><td>${renderMarkdown(resolvedResp.description)}${mediaBlocks.join('')}</td></tr>`,
                    );
                }
                if (respRows.length > 0) {
                    responsesHtml = `<h3 class="cdd-section-title">${escapeHtml(t.response)}</h3>
                    <table class="cdd-params-table">
                      <thead><tr><th>Status</th><th>${escapeHtml(t.tableHeaderDescription)}</th></tr></thead>
                      <tbody>${respRows.join('')}</tbody>
                    </table>`;
                }
            }

            mainHtml += `
        <article id="${escapeHtml(id)}" class="cdd-endpoint">
          <div class="cdd-endpoint-info">
            <h2 class="cdd-endpoint-title">${escapeHtml(op.summary || route)}</h2>
            <div class="cdd-endpoint-path-row">
              <span class="cdd-badge cdd-badge-${escapeHtml(m)} cdd-badge-${escapeHtml(upperMethod)}">${escapeHtml(upperMethod)}</span>
              <code class="cdd-path-text">${escapeHtml(route)}</code>
            </div>
            ${op.description ? `<div class="cdd-description">${renderMarkdown(op.description)}</div>` : ''}
            
            ${
                mergedParams.length > 0
                    ? `
              <h3 class="cdd-section-title">${escapeHtml(t.parameters)}</h3>
              <table class="cdd-params-table">
                <thead><tr><th>${escapeHtml(t.tableHeaderName)}</th><th>${escapeHtml(t.tableHeaderIn)}</th><th>${escapeHtml(t.tableHeaderType)}</th><th>${escapeHtml(t.tableHeaderDescription)}</th></tr></thead>
                <tbody>
                  ${mergedParams
                      .map(p => {
                          const paramId = `${id}-param-${p.name}`;
                          const paramType = p.schema && !isReference(p.schema) && p.schema.type ? p.schema.type : 'any';
                          return `<tr id="${escapeHtml(paramId)}" class="cdd-deep-link-row">
                      <td><a href="#${escapeHtml(paramId)}" class="cdd-anchor">#</a><code>${escapeHtml(p.name)}${p.required ? '*' : ''}</code></td>
                      <td>${escapeHtml(p.in)}</td>
                      <td>${escapeHtml(paramType)}</td>
                      <td>${renderMarkdown(p.description)}</td>
                    </tr>`;
                      })
                      .join('')}
                </tbody>
              </table>
            `
                    : ''
            }
            ${requestBodySchemaHtml}
            ${responsesHtml}

            <details class="cdd-try-it-out">
              <summary class="cdd-try-summary">${escapeHtml(t.tryItOut)}</summary>
              <form class="cdd-try-form" method="${m === 'get' ? 'GET' : 'POST'}" action="/" data-method="${escapeHtml(upperMethod)}" data-route="${escapeHtml(route)}" data-base-url="${escapeHtml(opBaseUrl)}">
                ${mergedParams
                    .map(
                        p => `
                    <div class="cdd-try-field">
                      <label for="try-${escapeHtml(id)}-${escapeHtml(p.name)}">${escapeHtml(p.name)} (${escapeHtml(p.in)})${p.required ? ' *' : ''}</label>
                      <input type="text" id="try-${escapeHtml(id)}-${escapeHtml(p.name)}" name="${escapeHtml(p.name)}" data-in="${escapeHtml(p.in)}" ${p.required ? 'required' : ''}>
                    </div>
                  `,
                    )
                    .join('')}
                ${
                    resolvedRb
                        ? `
                  <div class="cdd-try-field">
                    <label for="try-${escapeHtml(id)}-body">${escapeHtml(t.requestBody)}</label>
                    <textarea id="try-${escapeHtml(id)}-body" name="requestBody" rows="4"></textarea>
                  </div>
                `
                        : ''
                }
                <button type="submit" class="cdd-try-btn">${escapeHtml(t.execute)}</button>
              </form>
              <div class="cdd-try-response" style="display: none; margin-top: 1rem;">
                <h4 style="margin:0 0 0.5rem 0;">${escapeHtml(t.response)}</h4>
                <div class="cdd-try-status"></div>
                <pre><code class="cdd-try-body"></code></pre>
              </div>
            </details>
          </div>

          ${renderCodeAside(id, curl, examples, languages, t)}
        </article>
      `;
        }
        routeToc += `</details>`;
        if (routeHasOps) tocHtml += routeToc;
    }

    // Build Webhooks TOC and Main Content
    if (spec.webhooks) {
        for (const [webhookName, pathItem] of Object.entries(spec.webhooks)) {
            if (isReference(pathItem)) continue;
            const operations = getPathOperations(pathItem);
            for (const [m, op] of operations) {
                const id = op.operationId || `webhook-${m}-${webhookName}`;
                const upperMethod = m.toUpperCase();
                webhooksTocHtml += `<a href="#${escapeHtml(id)}" class="cdd-toc-item">WEBHOOK: ${escapeHtml(webhookName)} (${escapeHtml(upperMethod)})</a>`;
                const curl = generateCurl(m, `/${webhookName}`, op, baseUrl, pathItem, spec.components);
                const examples = data.codeExamples[id] || [];

                mainHtml += `
        <article id="${escapeHtml(id)}" class="cdd-endpoint cdd-webhook">
          <div class="cdd-endpoint-info">
            <h2 class="cdd-endpoint-title">${escapeHtml(op.summary || webhookName)}</h2>
            <div class="cdd-endpoint-path-row">
              <span class="cdd-badge cdd-badge-post">WEBHOOK</span>
              <span class="cdd-badge cdd-badge-${escapeHtml(m)} cdd-badge-${escapeHtml(upperMethod)}">${escapeHtml(upperMethod)}</span>
              <code class="cdd-path-text">${escapeHtml(webhookName)}</code>
            </div>
            ${op.description ? `<div class="cdd-description">${renderMarkdown(op.description)}</div>` : ''}
          </div>
          ${renderCodeAside(id, curl, examples, languages, t)}
        </article>`;
            }
        }
    }

    // Build Arazzo Workflows TOC and Main Content
    if (data.workflows && data.workflows.length > 0) {
        mainHtml += `<h2 id="section-workflows" class="cdd-main-title">${escapeHtml(t.workflowsHeading)}</h2>`;
        for (const nw of data.workflows) {
            const wf = nw.workflow;
            const wfDomId = `workflow-${wf.workflowId}`;
            workflowsTocHtml += `<details class="cdd-toc-group" open>
              <summary class="cdd-toc-route"><a href="#${escapeHtml(wfDomId)}" class="cdd-toc-item cdd-toc-workflow-item">WORKFLOW: ${escapeHtml(wf.workflowId)}</a></summary>
              ${wf.steps
                  .map(
                      st =>
                          `<a href="#step-${escapeHtml(wf.workflowId)}-${escapeHtml(st.stepId)}" class="cdd-toc-item">${escapeHtml(st.stepId)}</a>`,
                  )
                  .join('')}
            </details>`;
            mainHtml += renderWorkflowSection(nw, data, languages, t);
        }
    }

    // Build Schemas
    if (spec.components?.schemas) {
        schemasHtml += `<h2 id="section-schemas" class="cdd-main-title">${escapeHtml(t.schemas)}</h2>`;
        for (const [name, schema] of Object.entries(spec.components.schemas)) {
            schemasHtml += `
        <div id="schema-${escapeHtml(name)}" class="cdd-schema-section">
          <h3 class="cdd-schema-title">${escapeHtml(name)}</h3>
          ${renderSchema(schema, 0, `schema-${name}`, t)}
        </div>
      `;
        }
    }

    // Build Arazzo Components
    if (data.arazzoSpec?.components) {
        schemasHtml += renderArazzoComponents(data.arazzoSpec.components, t);
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

    const safeLanguages = languages.map(sanitizeCssIdent);

    const stylesHtml = `<style>
    /* Progressive Enhancement: Hide JS-dependent elements when JS is disabled */
    .no-js .cdd-copy-btn,
    .no-js .cdd-search-input,
    .no-js .cdd-try-it-out,
    .no-js .cdd-code-tabs input[type="radio"],
    .no-js .cdd-code-tabs label { display: none; }
    
    .no-js .cdd-code-tabs .cdd-tab-content { display: block; margin-bottom: 1rem; border-top: 1px solid rgba(255,255,255,0.1); }
    .no-js .cdd-code-tabs .cdd-tab-content:before { content: "Code block: "; font-size: 0.75rem; opacity: 0.7; }
  </style>
  <style>
    :root {
      ${lightVars}
      --cdd-get: #00668b; --cdd-get-bg: #c2e8ff;
      --cdd-post: #006e2c; --cdd-post-bg: #b4f3b0;
      --cdd-put: #944a00; --cdd-put-bg: #ffdcbe;
      --cdd-delete: #ba1a1a; --cdd-delete-bg: #ffdad6;
      --cdd-patch: #006a6a; --cdd-patch-bg: #6ff5f5;
      --cdd-options: #5b4300; --cdd-options-bg: #ffdf9a;
      --cdd-head: #4355b9; --cdd-head-bg: #dee0ff;
      --cdd-trace: #705573; --cdd-trace-bg: #fad7ff;
      --cdd-query: #005ac1; --cdd-query-bg: #d8e2ff;
      --cdd-workflow: #6750a4; --cdd-workflow-bg: #eaddff;
      
      ${safeLanguages.map(lang => `--cdd-display-${lang}: none;`).join(' ')}
      --cdd-display-imports: block;
      --cdd-display-wrapping: block;
    }

    #opt-dark-mode:checked ~ .cdd-layout {
      ${darkVars}
    }

    ${safeLanguages.map(lang => `#lang-opt-${lang}:checked ~ .cdd-layout .cdd-show-if-${lang} { display: block; }`).join('\n')}
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

    .cdd-badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-decoration: none; display: inline-block; }
    .cdd-badge-GET, .cdd-badge-get { background: var(--cdd-get-bg); color: var(--cdd-get); }
    .cdd-badge-POST, .cdd-badge-post { background: var(--cdd-post-bg); color: var(--cdd-post); }
    .cdd-badge-PUT, .cdd-badge-put { background: var(--cdd-put-bg); color: var(--cdd-put); }
    .cdd-badge-DELETE, .cdd-badge-delete { background: var(--cdd-delete-bg); color: var(--cdd-delete); }
    .cdd-badge-PATCH, .cdd-badge-patch { background: var(--cdd-patch-bg); color: var(--cdd-patch); }
    .cdd-badge-OPTIONS, .cdd-badge-options { background: var(--cdd-options-bg); color: var(--cdd-options); }
    .cdd-badge-HEAD, .cdd-badge-head { background: var(--cdd-head-bg); color: var(--cdd-head); }
    .cdd-badge-TRACE, .cdd-badge-trace { background: var(--cdd-trace-bg); color: var(--cdd-trace); }
    .cdd-badge-QUERY, .cdd-badge-query { background: var(--cdd-query-bg); color: var(--cdd-query); }
    .cdd-badge-workflow { background: var(--cdd-workflow-bg); color: var(--cdd-workflow); }
    .cdd-badge-channel { background: var(--cdd-options-bg); color: var(--cdd-options); }
    .cdd-badge-meta { background: rgba(117, 119, 128, 0.15); color: var(--cdd-on-surface-variant); font-weight: 500; }

    .cdd-steps-pipeline { display: flex; flex-direction: column; gap: 1rem; margin: 1rem 0; border-left: 3px solid var(--cdd-primary); padding-left: 1rem; }
    .cdd-step-card { border: 1px solid var(--cdd-outline-variant); border-radius: 8px; padding: 1rem; background: var(--cdd-surface); }
    .cdd-step-header { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
    .cdd-step-index { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: var(--cdd-primary); color: var(--cdd-on-primary); font-size: 0.75rem; font-weight: 700; }
    .cdd-step-subtitle { font-size: 0.8125rem; margin: 0.75rem 0 0.25rem; color: var(--cdd-on-surface-variant); }
    .cdd-source-descriptions { margin: 1rem 0; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; font-size: 0.875rem; }
    .cdd-source-chip { padding: 0.25rem 0.5rem; border: 1px solid var(--cdd-outline-variant); border-radius: 6px; }

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

    ${safeLanguages.map(lang => `#lang-opt-${lang}:checked ~ .cdd-layout label[for="lang-opt-${lang}"] { background: var(--cdd-primary); color: var(--cdd-on-primary); border-color: var(--cdd-primary); font-weight: 500; }`).join('\n')}
    ${safeLanguages.map(lang => `#lang-opt-${lang}:focus-visible ~ .cdd-layout label[for="lang-opt-${lang}"] { outline: 2px solid var(--cdd-primary); outline-offset: 2px; }`).join('\n')}
    #opt-imports:checked ~ .cdd-layout label[for="opt-imports"] { background: var(--cdd-primary); color: var(--cdd-on-primary); border-color: var(--cdd-primary); }
    #opt-imports:focus-visible ~ .cdd-layout label[for="opt-imports"] { outline: 2px solid var(--cdd-primary); outline-offset: 2px; }
    #opt-wrapping:checked ~ .cdd-layout label[for="opt-wrapping"] { background: var(--cdd-primary); color: var(--cdd-on-primary); border-color: var(--cdd-primary); }
    #opt-wrapping:focus-visible ~ .cdd-layout label[for="opt-wrapping"] { outline: 2px solid var(--cdd-primary); outline-offset: 2px; }
    #opt-dark-mode:checked ~ .cdd-layout label[for="opt-dark-mode"] { background: var(--cdd-primary); color: var(--cdd-on-primary); border-color: var(--cdd-primary); }
    #opt-dark-mode:focus-visible ~ .cdd-layout label[for="opt-dark-mode"] { outline: 2px solid var(--cdd-primary); outline-offset: 2px; }

    /* Variant display logic */
    .cdd-variant-block { display: none; }
    .cdd-lang-block > .cdd-variant-block:only-child { display: block; }
    
    #opt-imports:checked ~ #opt-wrapping:checked ~ .cdd-layout .cdd-variant-block.cdd-show-if-imports.cdd-show-if-wrapping { display: block; }
    #opt-imports:not(:checked) ~ #opt-wrapping:checked ~ .cdd-layout .cdd-variant-block.cdd-hide-if-imports.cdd-show-if-wrapping { display: block; }
    #opt-imports:checked ~ #opt-wrapping:not(:checked) ~ .cdd-layout .cdd-variant-block.cdd-show-if-imports.cdd-hide-if-wrapping { display: block; }
    #opt-imports:not(:checked) ~ #opt-wrapping:not(:checked) ~ .cdd-layout .cdd-variant-block.cdd-hide-if-imports.cdd-hide-if-wrapping { display: block; }
  </style>`;

    const bodyHtml = `${languages.map((lang, i) => `<input type="radio" id="lang-opt-${sanitizeCssIdent(lang)}" name="global-lang" class="cdd-visually-hidden" ${i === 0 ? 'checked' : ''}>`).join('')}
  <input type="checkbox" id="opt-imports" class="cdd-visually-hidden" checked>
  <input type="checkbox" id="opt-wrapping" class="cdd-visually-hidden" checked>
  <input type="checkbox" id="opt-dark-mode" class="cdd-visually-hidden" ${theme === 'dark' ? 'checked' : ''}>

  <div class="cdd-layout">
    <aside class="cdd-sidebar-left" aria-label="${escapeHtml(t.tocNavLabel)}">
      <h1 style="font-size: 1.25rem;">${escapeHtml(spec.info.title)}</h1>
      <div class="cdd-sidebar-title">${escapeHtml(t.paths)}</div>
      ${tocHtml}
      ${
          webhooksTocHtml
              ? `<div class="cdd-sidebar-title">${escapeHtml(t.webhooksHeading)}</div>${webhooksTocHtml}`
              : ''
      }
      ${
          workflowsTocHtml
              ? `<div class="cdd-sidebar-title">${escapeHtml(t.workflowsHeading)}</div>${workflowsTocHtml}`
              : ''
      }
      <div class="cdd-sidebar-title">${escapeHtml(t.schemas)}</div>
      <nav aria-label="${escapeHtml(t.schemas)}">
        ${
            spec.components?.schemas
                ? Object.keys(spec.components.schemas)
                      .map(name => `<a href="#schema-${escapeHtml(name)}" class="cdd-toc-item">${escapeHtml(name)}</a>`)
                      .join('')
                : ''
        }
      </nav>
    </aside>

    <main class="cdd-main">
      <header>
        <h1 style="font-size: 3rem; font-weight: 300;">${escapeHtml(spec.info.title)}</h1>
        <div class="cdd-description">${renderMarkdown(spec.info.description)}</div>
        ${sourceDescriptionsHtml}
        ${spec.info.termsOfService ? `<p style="font-size: 0.875rem;"><a href="${sanitizeUrl(spec.info.termsOfService)}" target="_blank">${escapeHtml(t.termsOfService)}</a></p>` : ''}
        ${
            spec.info.contact
                ? `<p style="font-size: 0.875rem;">${escapeHtml(t.contactPrefix)}${
                      spec.info.contact.url
                          ? `<a href="${sanitizeUrl(spec.info.contact.url)}" target="_blank">${escapeHtml(spec.info.contact.name || t.apiSupport)}</a>`
                          : spec.info.contact.email
                            ? `<a href="mailto:${escapeHtml(spec.info.contact.email)}">${escapeHtml(spec.info.contact.name || spec.info.contact.email)}</a>`
                            : escapeHtml(spec.info.contact.name || t.apiSupport)
                  }</p>`
                : ''
        }
      </header>
      ${mainHtml}
      ${schemasHtml}
    </main>

    <aside class="cdd-sidebar-right">
      <div class="cdd-sidebar-title">${escapeHtml(t.settings)}</div>
      
      <p style="font-size: 0.875rem; margin-bottom: 0.5rem;">${escapeHtml(t.appearanceHeading)}</p>
      <label for="opt-dark-mode" class="cdd-setting-label">
        ${escapeHtml(t.darkMode)}
      </label>

      <p style="font-size: 0.875rem; margin-top: 1rem; margin-bottom: 0.5rem;">${escapeHtml(t.language)}</p>
      ${languages
          .map(
              lang => `
        <label for="lang-opt-${sanitizeCssIdent(lang)}" class="cdd-setting-label">
          ${escapeHtml(lang)}
        </label>
      `,
          )
          .join('')}
      
      <div style="margin-top: 1rem;">
        <label for="opt-imports" class="cdd-setting-label">
          ${escapeHtml(t.includeImports)}
        </label>
        <label for="opt-wrapping" class="cdd-setting-label">
          ${escapeHtml(t.includeWrapping)}
        </label>
      </div>
    </aside>
  </div>`;

    return {
        stylesHtml,
        bodyHtml,
        title: spec.info.title,
        locale: t.locale,
    };
}

/**
 * Generates the complete AOT HTML for the OpenAPI 3.2.0, Swagger 2.0, and/or Arazzo 1.1.0 documentation.
 * @param specContent Raw OpenAPI or Arazzo spec string (YAML/JSON).
 * @param sdkExamples List of code examples to include.
 * @param theme UI theme (`'light'` or `'dark'`).
 * @param injectLiveReload Whether to inject the `/__livereload` EventSource script.
 * @param customTranslations Optional partial translation dictionary to override defaults.
 * @param companionArazzoContent Optional companion Arazzo 1.1.0 spec string (YAML/JSON) to render alongside an OpenAPI spec.
 * @returns Full HTML document string.
 */
export function generateAOTHtml(
    specContent: string,
    sdkExamples: CodeExample[] = [],
    theme: 'light' | 'dark' = 'light',
    injectLiveReload: boolean = false,
    customTranslations: Partial<DocTranslations> = {},
    companionArazzoContent?: string,
): string {
    const fragment = generateAOTBodyAndStyles(
        specContent,
        sdkExamples,
        theme,
        customTranslations,
        companionArazzoContent,
    );

    return `<!DOCTYPE html>
<html lang="${escapeHtml(fragment.locale)}" class="no-js">
<head>
  <script>document.documentElement.classList.remove('no-js');</script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(fragment.title)} - API Reference</title>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Roboto+Mono&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
  ${fragment.stylesHtml}
</head>
<body>
  ${fragment.bodyHtml}
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
