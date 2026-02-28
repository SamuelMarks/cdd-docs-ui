/**
 * @fileoverview Core site generation logic orchestrating templates and data aggregation.
 */
import fs from 'fs-extra';
import path from 'path';
import ejs from 'ejs';
import { collectAllExamples, LANGUAGES } from './runner';
import type { CLIOptions, OpenAPISpec, VariantName } from './types';

/**
 * Interface representing an item in the sidebar navigation.
 */
export interface NavItem {
    /** The URL path for the API endpoint. */
    path: string;
    /** The HTTP method used for the endpoint. */
    method: string;
    /** A brief summary of the endpoint's purpose. */
    summary: string;
    /** Tags grouping the endpoint. */
    tags: string[];
}

/**
 * Provides static CSS for the rendered site.
 *
 * @returns {string} The raw CSS string.
 */
export function getStyles(): string {
    return `
:root {
  --md-sys-color-primary: #6750A4;
  --md-sys-color-on-primary: #FFFFFF;
  --md-sys-color-surface: #FEF7FF;
  --md-sys-color-on-surface: #1D1B20;
  --md-sys-color-surface-variant: #E7E0EC;
  --md-sys-color-on-surface-variant: #49454F;
  --md-sys-color-background: #FEF7FF;
  --md-sys-color-on-background: #1D1B20;
  --md-sys-color-outline: #79747E;
  
  --code-bg: #1e1e1e;
  --code-fg: #d4d4d4;
  --code-comment: #6a9955;
  --code-keyword: #569cd6;
  --code-string: #ce9178;

  --sidebar-width: 280px;
  --code-panel-width: 45%;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Roboto', system-ui, -apple-system, sans-serif;
  background-color: var(--md-sys-color-background);
  color: var(--md-sys-color-on-background);
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* Sidebar Navigation */
.sidebar {
  width: var(--sidebar-width);
  background-color: var(--md-sys-color-surface);
  border-right: 1px solid var(--md-sys-color-surface-variant);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 24px 16px;
  border-bottom: 1px solid var(--md-sys-color-surface-variant);
}

.sidebar-header h1 {
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--md-sys-color-primary);
}

.nav-list {
  list-style: none;
  padding: 8px 0;
}

.nav-item {
  display: flex;
}

.nav-link {
  flex: 1;
  padding: 12px 16px;
  text-decoration: none;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.875rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 0 24px 24px 0;
  margin-right: 16px;
}

.nav-link:hover {
  background-color: rgba(103, 80, 164, 0.08); /* Primary hover */
  color: var(--md-sys-color-on-surface);
}

.method-badge {
  font-size: 0.65rem;
  font-weight: bold;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
  min-width: 48px;
  text-align: center;
}

.method-get { background: #E8F5E9; color: #2E7D32; }
.method-post { background: #E3F2FD; color: #1565C0; }
.method-put { background: #FFF3E0; color: #E65100; }
.method-delete { background: #FFEBEE; color: #C62828; }
.method-patch { background: #E0F7FA; color: #00838F; }

/* Main Content Area */
.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Document Area */
.doc-area {
  flex: 1;
  overflow-y: auto;
  padding: 40px;
}

.endpoint-section {
  margin-bottom: 64px;
  max-width: 800px;
}

.endpoint-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.endpoint-title {
  font-size: 1.5rem;
  font-weight: 400;
}

.endpoint-path {
  font-family: monospace;
  background: var(--md-sys-color-surface-variant);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9rem;
}

.endpoint-desc {
  color: var(--md-sys-color-on-surface-variant);
  line-height: 1.5;
  margin-bottom: 24px;
}

/* Parameters Table */
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 16px;
}

th, td {
  text-align: left;
  padding: 12px;
  border-bottom: 1px solid var(--md-sys-color-surface-variant);
}

th {
  font-weight: 500;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.875rem;
}

td {
  font-size: 0.875rem;
}

/* Code Panel Area */
.code-panel {
  width: var(--code-panel-width);
  background-color: var(--code-bg);
  color: var(--code-fg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lang-selector {
  background-color: #252526;
  padding: 16px 16px 8px 16px;
  display: flex;
  align-items: center;
}

.lang-selector label {
  color: var(--md-sys-color-on-primary);
  margin-right: 12px;
  font-size: 0.875rem;
}

.lang-select {
  background: #3c3c3c;
  color: #fff;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 0.875rem;
  outline: none;
  cursor: pointer;
}

.lang-options {
  background-color: #252526;
  padding: 0 16px 16px 16px;
  display: flex;
  gap: 16px;
  border-bottom: 1px solid #333;
}
.lang-options label {
  color: var(--md-sys-color-on-primary);
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.code-snippets {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.code-block-wrapper {
  margin-bottom: 64px;
}

.code-block-header {
  font-family: monospace;
  font-size: 0.8rem;
  color: #888;
  margin-bottom: 8px;
}

pre {
  background: #1e1e1e;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  border: 1px solid #333;
}

/* Responsive */
@media (max-width: 900px) {
  .main-content {
    flex-direction: column;
  }
  
  .code-panel {
    width: 100%;
    height: 50vh;
  }
}

@media (max-width: 600px) {
  body {
    flex-direction: column;
  }
  
  .sidebar {
    width: 100%;
    height: 60px;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    border-right: none;
    border-bottom: 1px solid var(--md-sys-color-surface-variant);
  }
  
  .sidebar-header {
    padding: 16px;
    border-bottom: none;
    border-right: 1px solid var(--md-sys-color-surface-variant);
  }
  
  .nav-list {
    display: flex;
    flex-direction: row;
    padding: 0 8px;
    align-items: center;
  }
  
  .nav-item {
    margin-right: 8px;
  }
  
  .nav-link {
    white-space: nowrap;
    margin-right: 0;
    border-radius: 16px;
    padding: 8px 12px;
  }
}
  `;
}

/**
 * Main generator sequence orchestrating reading the OpenAPI specification,
 * parsing endpoints, running the CDD CLI tools to get snippets, and rendering ejs.
 *
 * @param options - Application CLI settings dictating inputs, outputs, and format flags.
 * @returns A Promise confirming site construction.
 */
export async function generateSite(options: CLIOptions): Promise<void> {
    const { inputPath, outputPath, noImports, noWrapping } = options;
    const specPath = path.resolve(inputPath);
    const outDir = path.resolve(outputPath);

    const exists = await fs.pathExists(specPath);
    if (!exists) {
        throw new Error(`OpenAPI spec not found at: ${specPath}`);
    }

    const specContent = await fs.readJson(specPath);
    const spec = specContent as OpenAPISpec;

    let apiName = 'api';
    if (spec.info?.title) {
        apiName = spec.info.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
    if (apiName === 'swagger-petstore') {
        apiName = 'petstore';
    }

    // Determine initial selected variant based on user CLI options for static build output.
    let initialVariant: VariantName = 'default';
    if (noImports && noWrapping) {
        initialVariant = 'noImportsNoWrapping';
    } else if (noImports) {
        initialVariant = 'noImports';
    } else if (noWrapping) {
        initialVariant = 'noWrapping';
    }

    const allExamples = await collectAllExamples(specPath);

    const navigation: NavItem[] = [];
    if (spec.paths) {
        for (const [routePath, methods] of Object.entries(spec.paths)) {
            for (const [method, details] of Object.entries(methods)) {
                if (!['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
                    continue;
                }
                navigation.push({
                    path: routePath,
                    method: method.toLowerCase(),
                    summary: details.summary ?? routePath,
                    tags: details.tags ?? ['default'],
                });
            }
        }
    }

    const layoutPath = path.join(__dirname, 'templates', 'layout.ejs');
    const layoutEjs = await fs.readFile(layoutPath, 'utf-8');

    const langs = Object.keys(LANGUAGES);

    await fs.emptyDir(outDir);

    for (const lang of langs) {
        console.log(`Building pages for ${lang}...`);

        // Provide a fallback empty state if specific language generation failed silently elsewhere.
        const emptyLangExamples = {
            default: { endpoints: {} },
            noImports: { endpoints: {} },
            noWrapping: { endpoints: {} },
            noImportsNoWrapping: { endpoints: {} },
        };
        const examplesRef = allExamples[lang] || emptyLangExamples;

        const context = {
            spec,
            apiName,
            currentLang: lang,
            languages: langs,
            navigation,
            examples: examplesRef,
            initialVariant,
            noImportsChecked: !!noImports,
            noWrappingChecked: !!noWrapping,
        };

        const html = await ejs.render(layoutEjs, context, { root: path.join(__dirname, 'templates'), async: true });

        const pageDir = path.join(outDir, 'api', apiName, lang);
        await fs.ensureDir(pageDir);
        await fs.writeFile(path.join(pageDir, 'index.html'), html);
    }

    const examplesJsonPath = path.join(outDir, 'examples.json');
    await fs.writeJson(examplesJsonPath, allExamples);

    const defaultLang = 'python';
    const redirectHtml = `<meta http-equiv="refresh" content="0; url=/api/${apiName}/${defaultLang}/" />`;
    await fs.writeFile(path.join(outDir, 'index.html'), redirectHtml);

    const apiDir = path.join(outDir, 'api', apiName);
    await fs.ensureDir(apiDir);
    await fs.writeFile(path.join(apiDir, 'index.html'), redirectHtml);

    const cssPath = path.join(outDir, 'styles.css');
    await fs.writeFile(cssPath, getStyles());
}
