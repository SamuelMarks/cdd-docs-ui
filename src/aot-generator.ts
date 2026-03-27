
import { DocData, CodeExample } from "./types";
import { normalizeSpec, mapSdkExamples, isReference } from "./parser";

export function generateAOTHtml(specContent: string, sdkExamples: CodeExample[] = [], theme: "light" | "dark" = "light"): string {
  const data = normalizeSpec(specContent);
  if (sdkExamples.length > 0) {
    mapSdkExamples(data, sdkExamples);
  }

  const spec = data.spec;
  const paths = spec.paths || {};
  let mainHtml = "";

  for (const [route, pathItem] of Object.entries(paths)) {
    if (isReference(pathItem)) continue;
    const methods = ["get", "post", "put", "delete", "patch", "options", "head", "trace"];
    for (const m of methods) {
      const op = (pathItem as any)[m];
      if (!op) continue;
      const id = op.operationId || `${m}-${route}`;
      mainHtml += `<article id="${id}">
        <h2>${m.toUpperCase()} ${route}</h2>
        <h3>${op.summary || ""}</h3>
        ${data.codeExamples[id] ? data.codeExamples[id].map(ex => `<div><strong>${ex.filepath}</strong><pre><code>${ex.content}</code></pre></div>`).join("") : ""}
      </article>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <title>${spec.info.title} - API Reference</title>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <h1 style="font-size: 1.25rem; margin-top: 0;">${spec.info.title}</h1>
      <p>v${spec.info.version}</p>
    </aside>
    <main class="main" id="main-content">
      <p style="font-size: 1.1rem; max-width: 800px;">${spec.info.description || ""}</p>
      ${mainHtml}
    </main>
  </div>
</body>
</html>`;
}
