/**
 * @fileoverview Client-side entry point for dynamic OpenAPI specification rendering.
 * Listens for postMessage events to update the UI and theme.
 */

import yaml from 'js-yaml';
import type { OpenAPISpec } from '../types';

/**
 * Renders the parsed OpenAPI specification into the DOM.
 * 
 * @param spec - The parsed OpenAPI specification object.
 */
function renderApp(spec: OpenAPISpec) {
    const titleEl = document.getElementById('api-title');
    const versionEl = document.getElementById('api-version');
    if (titleEl) titleEl.textContent = spec.info?.title || 'API Reference';
    if (versionEl) versionEl.textContent = spec.info?.version || '';
    
    document.title = `${spec.info?.title || 'API Docs'} - Preview`;

    const navList = document.getElementById('nav-list');
    const docArea = document.getElementById('doc-area');
    
    if (navList) navList.innerHTML = '';
    if (docArea) docArea.innerHTML = '';

    if (spec.info?.description && docArea) {
        const descP = document.createElement('p');
        descP.style.marginBottom = '32px';
        descP.textContent = spec.info.description;
        docArea.appendChild(descP);
    }

    if (!spec.paths) return;

    for (const [routePath, methods] of Object.entries(spec.paths)) {
        for (const [method, details] of Object.entries(methods)) {
            if (!['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
                continue;
            }

            const methodLower = method.toLowerCase();
            const methodUpper = method.toUpperCase();
            const id = `${methodLower}-${routePath.replace(/[^a-zA-Z0-9]/g, '')}`;

            // Add nav item
            if (navList) {
                const li = document.createElement('li');
                li.className = 'nav-item';
                li.innerHTML = `
                    <a href="#${id}" class="nav-link">
                        <span class="method-badge method-${methodLower}">${methodLower}</span>
                        <span class="path-text">${routePath}</span>
                    </a>
                `;
                navList.appendChild(li);
            }

            // Add doc section
            if (docArea) {
                const section = document.createElement('section');
                section.id = id;
                section.className = 'endpoint-section';

                let html = `
                    <div class="endpoint-header">
                        <span class="method-badge method-${methodLower}" style="font-size: 0.9rem;">${methodUpper}</span>
                        <span class="endpoint-path">${routePath}</span>
                    </div>
                    <h2 class="endpoint-title">${details.summary || 'No Summary'}</h2>
                    <p class="endpoint-desc">${details.description || ''}</p>
                `;

                if (details.parameters && details.parameters.length > 0) {
                    html += `
                        <h3>Parameters</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>In</th>
                                    <th>Type/Schema</th>
                                    <th>Required</th>
                                    <th>Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${details.parameters.map(param => `
                                    <tr>
                                        <td><strong>${param.name}</strong></td>
                                        <td>${param.in}</td>
                                        <td><code>${param.schema?.type || param.type || 'any'}</code></td>
                                        <td>${param.required ? 'Yes' : 'No'}</td>
                                        <td>${param.description || ''}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `;
                }

                if (details.requestBody) {
                    html += `
                        <div style="margin-top: 24px;">
                            <h3>Request Body</h3>
                            <p>${details.requestBody.description || ''}</p>
                        </div>
                    `;
                }

                if (details.responses) {
                    html += `
                        <div style="margin-top: 24px;">
                            <h3>Responses</h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Status</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${Object.entries(details.responses).map(([status, resp]) => `
                                        <tr>
                                            <td><strong>${status}</strong></td>
                                            <td>${resp.description || ''}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                }

                section.innerHTML = html;
                docArea.appendChild(section);
            }
        }
    }
}

window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'UPDATE_SPEC') {
        try {
            const specStr = data.payload;
            let spec: OpenAPISpec;
            if (specStr.trim().startsWith('{')) {
                spec = JSON.parse(specStr);
            } else {
                spec = yaml.load(specStr) as OpenAPISpec;
            }
            renderApp(spec);
        } catch (err) {
            console.error('Failed to parse and render spec:', err);
        }
    } else if (data.type === 'SET_THEME') {
        if (data.payload === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }
});

// Signal ready
window.parent.postMessage({ type: 'DOCS_UI_READY' }, '*');