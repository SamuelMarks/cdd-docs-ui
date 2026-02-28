# CDD Docs UI Architecture

This document describes the high-level architecture of `cdd-docs-ui`, a CLI tool that parses OpenAPI specifications and generates a purely static, server-side rendered (SSR) API documentation website with progressive enhancement for interactive code examples.

## Core Concepts

1. **Static Site Generation (SSG) with Graceful Degradation:**
   The primary goal is to generate static HTML files. Every endpoint and language combination has a dedicated URL (e.g., `/api/petstore/go/index.html`). This ensures the documentation works perfectly without JavaScript enabled, is highly SEO-friendly, and loads instantaneously.

2. **Progressive Enhancement:**
   For users with JavaScript enabled, the static site hydrates into a single-page application (SPA) experience for the code examples. Changing languages or toggling code snippet formatting (imports/wrapping) dynamically swaps the code content via DOM manipulation using a pre-fetched `examples.json` file, avoiding full page reloads.

3. **External Code Generation via `cdd` Toolchain:**
   Instead of reinventing code generators, this tool shells out to existing language-specific Code Duplication Detection (CDD) CLI tools (e.g., `cdd_python_client`, `cdd_go`). It passes the OpenAPI spec to these tools and expects JSON payloads containing the generated code examples.

## Component Breakdown

The application is built in TypeScript and consists of the following primary modules:

### 1. CLI Core (`src/cli-core.ts`)
Uses `commander` to parse command-line arguments. It acts as the entry point, collecting the input specification path, output directory path, and default snippet formatting options (`--no-imports`, `--no-wrapping`), before passing control to the Generator.

### 2. Generator (`src/generator.ts`)
The orchestrator of the SSG process.
- **Parsing:** Reads the OpenAPI `spec.json`.
- **Navigation Construction:** Parses the `paths` object in the OpenAPI spec to build a structured navigation tree (methods, paths, summaries).
- **Data Aggregation:** Calls the `runner` to execute the external CDD tools and collect code examples.
- **HTML Rendering:** Uses `ejs` (Embedded JavaScript templating) to render the `src/templates/layout.ejs` file. It iterates over every supported language to generate language-specific `index.html` files.
- **Asset Emission:** Writes the static CSS (`styles.css`) and the aggregated `examples.json` file to the output directory.

### 3. Runner (`src/runner.ts`)
Responsible for interacting with the operating system and external processes.
- **Process Execution:** Uses `child_process.exec` to run commands like `cdd_python_client to_docs_json -i spec.json`.
- **Variant Generation:** For every language, it executes the CDD tool four times to generate all possible permutations of snippet formatting:
  1. Default (Full code)
  2. `--no-imports`
  3. `--no-wrapping`
  4. `--no-imports` and `--no-wrapping`
- **Fallback Mocking:** If an external CDD tool is not installed or fails, the runner gracefully degrades by generating mock text (e.g., `FAILED CLI COMMAND cdd_go (variant: noImports)`). This ensures the documentation UI can still be generated and tested even if the underlying code generators are broken.

### 4. Templating (`src/templates/layout.ejs`)
The single HTML template defining the structure of the documentation.
- **Layout:** Implements a responsive, two-column layout (sidebar navigation and main content area) inspired by Material Design 3.
- **Static Content:** Loops through the OpenAPI paths to render endpoint descriptions, parameters, request bodies, and responses directly into HTML.
- **Interactive Logic:** Contains a vanilla `<script>` block that:
  - Fetches `/examples.json` on load.
  - Intercepts dropdown (`<select>`) and checkbox (`<input type="checkbox">`) changes.
  - Updates the browser URL (`window.history.pushState`) when the language changes.
  - Mutates the DOM (`<code>` tags) with the appropriate code snippet based on the selected language and formatting variants.

### 5. Types (`src/types.ts`)
Enforces strict TypeScript interfaces for all internal structures, including CLI options, OpenAPI Schema shapes (`OpenAPISpec`, `OpenAPIEndpoint`), and the expected output structures from the CDD tools (`AllExamples`, `CDDOutput`).

## Data Flow

1. User executes `cdd-docs-ui -i spec.json -o build/`.
2. `cli-core.ts` parses the arguments.
3. `generator.ts` reads `spec.json`.
4. `runner.ts` executes `cdd_*` tools to generate code examples for all languages and variants.
5. Code examples are aggregated into an `AllExamples` object in memory.
6. `generator.ts` writes `AllExamples` to `build/examples.json`.
7. `generator.ts` renders `layout.ejs` for each language (e.g., Python, Go) using the parsed spec and the `AllExamples` object to populate the initial HTML state.
8. Static HTML files and `styles.css` are written to the `build/` directory.
9. When a user opens `build/index.html` in a browser, the vanilla JS in `layout.ejs` fetches `examples.json` and takes over interactivity.