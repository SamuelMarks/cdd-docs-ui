# CDD-DOCS-UI Integration Plan

![Test Coverage](https://img.shields.io/badge/Test_Coverage-100%25-brightgreen.svg) ![Doc Coverage](https://img.shields.io/badge/Doc_Coverage-100%25-brightgreen.svg)

This document outlines the required features and architectural changes needed in the `cdd-docs-ui` repository to fully integrate with the `cdd-web-ui` application. 

**Note: These features have now been successfully implemented.** `cdd-docs-ui` operates as a dual-mode documentation tool.

## 1. Architectural Context

The `cdd-web-ui` hosts the documentation UI within an `<iframe>`. The two applications communicate securely via the browser's `postMessage` API.
To integrate properly with the dynamic Web UI, `cdd-docs-ui` implements a **Client-Side SPA (Single Page Application) mode** (via a Custom Web Component) that can receive OpenAPI specs on the fly and render them in the browser without requiring a Node.js backend to rebuild the files.

## 2. Implemented Features

### A. Client-Side Rendering Mode

`cdd-docs-ui` exposes a static `index.html` (and associated client-side JS/CSS via `bundle.js`) that dynamically parses and renders an OpenAPI specification string (JSON or YAML) purely in the browser.

### B. The `postMessage` Protocol

The client-side JS in `cdd-docs-ui` implements the following `postMessage` event listeners and dispatchers to sync state with `cdd-web-ui`:

1.  **Outbound: Ready Signal**
    - Once the `cdd-docs-ui` iframe has loaded its DOM and JavaScript, it posts a message to the parent window indicating it is ready to receive data.
    - **Message:** `{ type: 'DOCS_UI_READY' }`
    - **Code Example:** `window.parent.postMessage({ type: 'DOCS_UI_READY' }, '*');`

2.  **Inbound: Spec Updates**
    - The Web UI sends the OpenAPI spec whenever it is loaded or modified.
    - **Message:** `{ type: 'UPDATE_SPEC', payload: '<stringified_openapi_spec>' }`
    - **Action:** `cdd-docs-ui` catches this event, parses the `payload` (handling both YAML and JSON), and re-renders the documentation UI.

3.  **Inbound: Theme Switching**
    - The Web UI supports Dark/Light mode and broadcasts theme changes.
    - **Message:** `{ type: 'SET_THEME', payload: 'dark' | 'light' }`
    - **Action:** `cdd-docs-ui` updates its CSS variables to match the requested theme.

### C. Build Output Configuration

The `cdd-web-ui` `angular.json` is configured to map the `cdd-docs-ui/dist` folder to the `/docs-ui/` path:

```json
{
    "glob": "**/*",
    "input": "../cdd-docs-ui/dist",
    "output": "/docs-ui"
}
```

- **Implemented:** The build process for `cdd-docs-ui` (`npm run build`) outputs the client-side `bundle.js` and CLI scripts directly into the `dist/` directory, making integration seamless.

### D. CLI Tooling Fixes (Standalone Mode)

The underlying `cdd-docs-ui` CLI (`runner.ts`) correctly executes `cdd-ctl` commands.

- **Implemented:** The arguments passed to `child_process.exec` in `runner.ts` have been updated to match the latest `cdd-ctl` command signatures (e.g., `cdd-ctl <target> to_docs_json -i <spec>`).

## 3. Implementation Steps for the LLM in `cdd-docs-ui` (Completed)

- [x] **Setup a Client-Side Bundler:** Added `esbuild` to compile client-side TypeScript to `dist/bundle.js`.
- [x] **Create Web Component Entry:** Created `<cdd-api-docs>` logic.
- [x] **Implement `window.addEventListener('message')`:** Added the listener to handle `UPDATE_SPEC` and `SET_THEME`, and trigger the initial `DOCS_UI_READY` emit.
- [x] **Refactor Rendering Logic:** Extracted the logic that generates the HTML (replacing EJS with TypeScript literal strings and `marked`) into a format that can run in the browser.
- [x] **Adjust `package.json` Scripts:** Ensured `npm run build` generates both the CLI tools AND the client-side static assets into `dist/`.
