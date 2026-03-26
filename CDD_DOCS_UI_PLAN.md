# CDD-DOCS-UI Integration Plan

This document outlines the required features and architectural changes needed in the `cdd-docs-ui` repository to fully integrate with the `cdd-web-ui` application.

## 1. Architectural Context

The `cdd-web-ui` hosts the documentation UI within an `<iframe>`. The two applications communicate securely via the browser's `postMessage` API. 
Currently, `cdd-docs-ui` is primarily a Node.js CLI tool that generates static HTML files via EJS templates. To integrate properly with the dynamic Web UI, `cdd-docs-ui` needs a **Client-Side SPA (Single Page Application) mode** or a **dynamic client-side entry point** that can receive OpenAPI specs on the fly and render them in the browser without requiring a Node.js backend to rebuild the files.

## 2. Required Features

### A. Client-Side Rendering Mode
`cdd-docs-ui` must expose a static `index.html` (and associated client-side JS/CSS) that can dynamically parse and render an OpenAPI specification string (JSON or YAML) purely in the browser. 

### B. The `postMessage` Protocol
The client-side JS in `cdd-docs-ui` must implement the following `postMessage` event listeners and dispatchers to sync state with `cdd-web-ui`:

1.  **Outbound: Ready Signal**
    *   Once the `cdd-docs-ui` iframe has loaded its DOM and JavaScript, it must post a message to the parent window indicating it is ready to receive data.
    *   **Message:** `{ type: 'DOCS_UI_READY' }`
    *   **Code Example:** `window.parent.postMessage({ type: 'DOCS_UI_READY' }, '*');`

2.  **Inbound: Spec Updates**
    *   The Web UI will send the OpenAPI spec whenever it is loaded or modified.
    *   **Message:** `{ type: 'UPDATE_SPEC', payload: '<stringified_openapi_spec>' }`
    *   **Action:** `cdd-docs-ui` should catch this event, parse the `payload` (handling both YAML and JSON), and re-render the documentation UI.

3.  **Inbound: Theme Switching**
    *   The Web UI supports Dark/Light mode and will broadcast theme changes.
    *   **Message:** `{ type: 'SET_THEME', payload: 'dark' | 'light' }`
    *   **Action:** `cdd-docs-ui` should update its CSS variables or toggle a `data-theme` attribute on the `<html>` or `<body>` tag to match the requested theme.

### C. Build Output Configuration
The `cdd-web-ui` `angular.json` is configured to map the `cdd-docs-ui/dist` folder to the `/docs-ui/` path:
```json
{
  "glob": "**/*",
  "input": "../cdd-docs-ui/dist",
  "output": "/docs-ui"
}
```
*   **Requirement:** The build process for `cdd-docs-ui` (e.g., `npm run build`) must output the client-side `index.html`, `styles.css`, and bundled JavaScript directly into the `dist/` directory (or ensure the Web UI's angular.json is updated to point to the correct output folder like `dist/public`). The entry point expected by the Web UI is `/docs-ui/index.html`.

### D. CLI Tooling Fixes (Standalone Mode)
While not strictly required for the Web UI iframe, the underlying `cdd-docs-ui` CLI (`runner.ts`) is currently failing to execute `cdd-ctl` commands. 
*   **Error:** `error: unexpected argument 'c' found` (e.g., when running `./cdd-ctl c to_docs_json ...`).
*   **Action:** The arguments passed to `child_process.exec` in `runner.ts` need to be updated to match the latest `cdd-ctl` command signatures (e.g., ensuring subcommands and flags are correct).

## 3. Recommended Implementation Steps for the LLM in `cdd-docs-ui`

- [x] **Setup a Client-Side Bundler:** Add a lightweight bundler (like Vite, esbuild, or Webpack) if one isn't present, to compile client-side TypeScript.
- [x] **Create `index.html` Entry:** Create a base `index.html` that imports the client-side logic and styles.
- [x] **Implement `window.addEventListener('message')`:** Add the listener to handle `UPDATE_SPEC` and `SET_THEME`, and trigger the initial `DOCS_UI_READY` emit.
- [x] **Refactor Rendering Logic:** Extract the logic that generates the HTML (currently in `generator.ts` using EJS) into a format that can run in the browser (or replace EJS with vanilla DOM manipulation / a lightweight framework).
- [x] **Adjust `package.json` Scripts:** Ensure `npm run build` generates both the CLI tools AND the client-side static assets into `dist/`.