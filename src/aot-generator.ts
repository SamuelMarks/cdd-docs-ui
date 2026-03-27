
import { DocData, Operation, Param, CodeExample } from "./types";
import { normalizeSpec, mapSdkExamples } from "./parser";

/**
 * Generates purely static HTML (Ahead-of-Time) from an OpenAPI Specification and optional SDK code files.
 * Provides a responsive layout, a11y features, and CSS variable theming.
 *
 * @param specContent Raw OpenAPI spec content (YAML/JSON)
 * @param sdkExamples Array of generated SDK code files
 * @param theme Base theme (light | dark)
 * @returns Fully styled HTML document string
 */
export function generateAOTHtml(specContent: string, sdkExamples: CodeExample[] = [], theme: "light" | "dark" = "light"): string {
  const data = normalizeSpec(specContent);
  if (sdkExamples.length > 0) {
    mapSdkExamples(data, sdkExamples);
  }

  const css = `
    :root {
      --bg: #ffffff;
      --text: #333333;
      --nav-bg: #f5f5f5;
      --border: #e0e0e0;
      --primary: #1976d2;
      --code-bg: #2d2d2d;
      --code-fg: #f8f8f2;
    }
    :root[data-theme="dark"] {
      --bg: #121212;
      --text: #e0e0e0;
      --nav-bg: #1e1e1e;
      --border: #333333;
      --primary: #90caf9;
      --code-bg: #000000;
      --code-fg: #d4d4d4;
    }
    body { margin: 0; font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); display: flex; flex-direction: column; min-height: 100vh; }
    
    .layout { display: flex; flex: 1; flex-direction: column; }
    
    .sidebar { background: var(--nav-bg); padding: 1rem; border-right: 1px solid var(--border); overflow-y: auto; }
    .main { padding: 2rem; flex: 1; overflow-y: auto; }
    
    .op-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
    .method-badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: bold; font-size: 0.8rem; text-transform: uppercase; color: white; }
    .method-get { background: #61affe; }
    .method-post { background: #49cc90; }
    .method-put { background: #fca130; }
    .method-delete { background: #f93e3e; }
    .method-patch { background: #50e3c2; }
    
    table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
    th, td { border: 1px solid var(--border); padding: 0.5rem; text-align: left; }
    
    pre { background: var(--code-bg); color: var(--code-fg); padding: 1rem; border-radius: 4px; overflow-x: auto; }

    @media (min-width: 768px) {
      .layout { flex-direction: row; }
      .sidebar { width: 250px; flex-shrink: 0; }
      .main { padding: 2rem; }
    }
  `;

  let navHtml = `<ul style="list-style: none; padding: 0;">`;
  let mainHtml = ``;

  for (const [tag, operations] of Object.entries(data.groups)) {
    navHtml += `<li><strong style="display: block; margin-top: 1rem; margin-bottom: 0.5rem;">${tag}</strong><ul style="list-style: none; padding-left: 0.5rem;">`;
    for (const op of operations) {
      navHtml += `<li style="margin-bottom: 0.25rem;">
        <a href="#${op.id}" style="color: var(--text); text-decoration: none; display: flex; align-items: center; gap: 0.5rem;">
          <span class="method-badge method-${op.method}" style="font-size: 0.6rem; padding: 0.15rem 0.3rem;">${op.method}</span>
          <span>${op.path}</span>
        </a>
      </li>`;
      
      mainHtml += `<article id="${op.id}" style="margin-bottom: 4rem; padding-bottom: 2rem; border-bottom: 1px solid var(--border);">
        <div class="op-header">
          <span class="method-badge method-${op.method}">${op.method}</span>
          <h2 style="margin: 0; font-family: monospace;">${op.path}</h2>
        </div>
        <h3>${op.summary}</h3>
        <p>${op.description}</p>
        
        <h4>Parameters</h4>
        ${op.parameters.length > 0 ? `
        <table>
          <thead><tr><th>Name</th><th>In</th><th>Required</th><th>Type</th><th>Description</th></tr></thead>
          <tbody>
            ${op.parameters.map(p => `<tr><td>${p.name}</td><td>${p.in}</td><td>${p.required ? "Yes" : "No"}</td><td>${p.type}</td><td>${p.description}</td></tr>`).join("")}
          </tbody>
        </table>
        ` : "<p>No parameters.</p>"}
        
        <h4>Responses</h4>
        <table>
          <thead><tr><th>Status</th><th>Description</th></tr></thead>
          <tbody>
            ${Object.entries(op.responses).map(([status, desc]) => `<tr><td><strong>${status}</strong></td><td>${desc}</td></tr>`).join("")}
          </tbody>
        </table>

        ${data.codeExamples[op.id] && data.codeExamples[op.id]!.length > 0 ? `
          <h4>SDK Code Examples</h4>
          ${data.codeExamples[op.id]!.map(example => `
            <div style="margin-bottom: 1rem;">
              <strong>${example.language} - ${example.filepath}</strong>
              <pre><code>${example.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>
            </div>
          `).join("")}
        ` : ""}
      </article>`;
    }
    navHtml += `</ul></li>`;
  }
  navHtml += `</ul>`;

  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title} - API Reference</title>
  <style>${css}</style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar" aria-label="API Navigation">
      <h1 style="font-size: 1.25rem; margin-top: 0;">${data.title}</h1>
      <p style="font-size: 0.8rem; color: var(--text); opacity: 0.8;">v${data.version}</p>
      <nav>${navHtml}</nav>
    </aside>
    <main class="main" id="main-content">
      <p style="font-size: 1.1rem; max-width: 800px;">${data.description}</p>
      ${mainHtml}
    </main>
  </div>
</body>
</html>`;
}
