# CDD Docs UI Usage Guide

This document details how to use the `cdd-docs-ui` CLI to generate interactive, multi-language API documentation websites from OpenAPI specifications.

## Global Installation

To use the tool globally on your system, install it via `npm` from the package root:
```bash
npm install -g .
```

You can now run `cdd-docs-ui` from any directory.

## Basic Generation

The most basic command takes an OpenAPI specification file and outputs the generated website to a specified directory.
By default, the CLI looks for `spec.json` in the current directory and outputs to `public/`.

```bash
cdd-docs-ui -i myspec.json -o build/
```

### Options Explained

- `-i, --input <path>`
  - Specifies the location of the OpenAPI JSON specification.
  - *Default:* `spec.json`
- `-o, --output <path>`
  - Specifies the target directory for the generated static site. It will be emptied before generation.
  - *Default:* `public`
- `--no-imports`
  - Defines the **default state** of the website's initial load. The generated static HTML files will omit import statements in their code examples.
  - Users can still toggle imports on/off via the UI checkbox.
- `--no-wrapping`
  - Defines the **default state** of the website's initial load. The generated static HTML files will omit function/class wrapping in their code examples.
  - Users can still toggle wrapping on/off via the UI checkbox.

### Generating with Default States

If you want the deployed website to default to showing bare snippets (no imports, no wrapping) when a user first lands on the page, use the flags during generation:

```bash
cdd-docs-ui -i openapi.json -o out/site --no-imports --no-wrapping
```
*Note: The generator still runs all 4 CDD tools variants in the background to build `examples.json`, ensuring the interactive UI checkboxes still work perfectly.*

## Supported Toolchain Repositories

This CLI integrates by shelling out to the following `cdd` (Code Duplication Detection / Code Generation) generators:
- [cdd-python-client](https://github.com/offscale/cdd-python-client) (`cdd_python_client`)
- [cdd-go](https://github.com/SamuelMarks/cdd-go) (`cdd_go`)
- [cdd-csharp](https://github.com/SamuelMarks/cdd-csharp) (`cdd_csharp`)
- [cdd-c](https://github.com/SamuelMarks/cdd-c) (`cdd_c`)
- [cdd-kotlin](https://github.com/offscale/cdd-kotlin) (`cdd_kotlin`)
- [cdd-swift](https://github.com/offscale/cdd-swift) (`cdd_swift`)
- [cdd-sh](https://github.com/SamuelMarks/cdd-sh) (`cdd_sh`)
- [cdd-web-ng](https://github.com/offscale/cdd-web-ng) (`cdd_web_ng`)

These must be installed and available in your global PATH for the generator to insert real code snippets. If they are missing, mock fallback data is generated.

## Serving the Output

The output is purely static HTML, CSS, and JSON. You can deploy the `output` directory to any static hosting provider (e.g., GitHub Pages, AWS S3, Vercel, Netlify).

To preview it locally, use any static file server:
```bash
npx serve build/
```
Or use the built-in development server in the repository:
```bash
npm run serve
```