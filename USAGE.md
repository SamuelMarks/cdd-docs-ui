# CDD Docs UI Usage Guide

![Test Coverage](https://img.shields.io/badge/Test_Coverage-100%25-brightgreen.svg) ![Doc Coverage](https://img.shields.io/badge/Doc_Coverage-100%25-brightgreen.svg)

This document details how to use `cdd-docs-ui` in both of its operational modes: as an AOT CLI tool, or as a Web Component SPA.

## 1. Web Component SPA Mode (Client-Side)

The `cdd-docs-ui` can be used as a client-side Custom Web Component `<cdd-api-docs>`. This is the preferred mode for integrating with dynamic frontends like `cdd-web-ui`.

### Setup

Include the compiled `bundle.js` in your HTML:

```html
<script type="module" src="path/to/dist/bundle.js"></script>
```

Then use the element in your DOM:

```html
<cdd-api-docs></cdd-api-docs>
```

### `postMessage` API

The component communicates with its host iframe window via `postMessage`.

**From Component to Host:**
- `{ type: 'DOCS_UI_READY' }`: Fired when the component has mounted and is ready to receive data.

**From Host to Component:**
- `{ type: 'UPDATE_SPEC', payload: '<openapi_yaml_or_json>' }`: Parses the provided string and updates the documentation view.
- `{ type: 'SET_THEME', payload: 'dark' | 'light' }`: Toggles the CSS theme variables.

## 2. AOT CLI Mode (Server-Side/Static)

The CLI generates interactive, multi-language API documentation websites from OpenAPI specifications, running external toolchains ahead of time.

### Global Installation

To use the tool globally on your system, install it via `npm` from the package root:

```bash
npm install -g .
```

You can now run `cdd-docs-cli` from any directory.

### Basic Generation

The most basic command takes an OpenAPI specification file and outputs the generated website to a specified directory.

```bash
cdd-docs-cli -i myspec.json -o build/
```

### Options Explained

- `-i, --input <path>`
    - Specifies the location of the OpenAPI JSON specification.
    - _Default:_ `spec.json`
- `-o, --output <path>`
    - Specifies the target directory for the generated static site. It will be emptied before generation.
    - _Default:_ `public`

## Supported Toolchain Repositories (AOT Mode)

The AOT CLI integrates by shelling out to `cdd-ctl` which supports 13 `cdd` targets (e.g., `cdd-python-all`, `cdd-ts`, `cdd-go`, etc.).

These must be integrated into `cdd-ctl` and the binary must be available in your path for the generator to insert real code snippets. If they are missing or fail, mock fallback data is generated.

## Serving the AOT Output

The output is purely static HTML and CSS. You can deploy the `output` directory to any static hosting provider (e.g., GitHub Pages, AWS S3, Vercel, Netlify).

To preview it locally, use any static file server:

```bash
npx serve build/
```
