# CDD Docs UI

![Test Coverage](https://img.shields.io/badge/Test_Coverage-100%25-brightgreen.svg) ![Doc Coverage](https://img.shields.io/badge/Doc_Coverage-100%25-brightgreen.svg)

[![CI](https://github.com/SamuelMarks/cdd-docs-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/SamuelMarks/cdd-docs-ui/actions/workflows/ci.yml)

A strictly-typed TypeScript dual-mode documentation tool for generating API documentation based on OpenAPI specifications and code snippets from the `cdd` (Compiler Driven Development) toolchain. It can operate as an AOT (Ahead-of-Time) static site generator or as a client-side Custom Web Component Single Page Application (SPA).

## Architecture Diagram

```mermaid
%%{
  init: {
    'theme': 'base',
    'themeVariables': {
      'fontFamily': 'Google Sans Normal, sans-serif',
      'lineColor': '#20344b',
      'textColor': '#20344b',
      'edgeLabelBackground': '#ffffff'
    }
  }
}%%
flowchart TD
    classDef headline font-family:'Google Sans Medium',fill:#4285f4,color:#ffffff,stroke:#20344b,stroke-width:2px
    classDef subhead font-family:'Roboto Mono Normal',fill:#f9ab00,color:#20344b,stroke:#20344b,stroke-width:2px
    classDef bodytext font-family:'Google Sans Normal',fill:#34a853,color:#ffffff,stroke:#20344b,stroke-width:2px
    classDef highlight font-family:'Google Sans Medium',fill:#ea4335,color:#ffffff,stroke:#20344b,stroke-width:2px
    classDef terminal font-family:'Google Sans Medium',fill:#20344b,color:#57caff,stroke:#57caff,stroke-width:2px

    A[OpenAPI Spec]:::subhead
    B(AOT CLI Generator):::headline
    B2(Web Component SPA):::headline
    C{cdd-ctl Rust CLI}:::highlight
    C2{WASM cdd targets}:::highlight
    D[[13 Language Targets]]:::bodytext
    E[Static HTML Site]:::terminal
    F[Dynamic Browser UI]:::terminal

    A -- Parses --> B
    A -- Parses --> B2
    B -- Executes --> C
    C -- Routes to --> D
    C2 -- Browser execution --> D
    D -- JSON Snippets --> B
    D -- Bindings & Messages --> B2
    B -- Renders --> E
    B2 -- Renders --> F
```

## Features

- **Dual-Mode Architecture:** Can be used as a CLI tool (`cdd-docs-cli`) to generate purely static HTML using TypeScript string literals and `marked`, or as a browser-native Web Component (`<cdd-api-docs>`).
- **100% Test Coverage:** Rigorously tested core logic.
- **Strict TypeScript:** No `any` or `unknown` types.
- **Progressive Enhancement (AOT Mode):** Generates pure static HTML for fast load times and SEO. Enhances with Vanilla JS for dynamic, no-reload language switching.
- **Direct Web Component Integration (SPA Mode):** The `<cdd-api-docs>` component accepts attribute (`spec-content`, `theme`) and property (`sdkExamples`) bindings for deep integration with frontend frameworks like Angular in `cdd-web-ui`.
- **WASM & Offline-First Compatibility:** In SPA mode, seamlessly renders code snippets generated entirely offline via WebAssembly by parent applications like `cdd-web-ui`.
- **Legacy postMessage Integration:** Still supports `postMessage` integration to sync states with parent iframes when native component bindings are not viable.
- **Variant Support:** Supports and dynamically renders snippets with or without imports and code-wrapping via the underlying `cdd-ctl` integrations.
- **Material 3 Theming:** Responsive, modern design out of the box with vanilla CSS.

## Architecture & Development

For detailed information on how the tool is structured, how to develop locally, and compliance standards, refer to the following guides:

- [ARCHITECTURE.md](ARCHITECTURE.md): An overview of the dual-mode architecture, AOT generation, and Web Component integration.
- [COMPLIANCE.md](COMPLIANCE.md): Standards for TypeScript strictness, test coverage, and security.
- [DEVELOPING.md](DEVELOPING.md): Instructions on how to build, test, and contribute.
- [USAGE.md](USAGE.md): Detailed CLI options and Web Component usage instructions.

## Installation

To run from source:

```bash
npm install
npm run build
```

To install the CLI globally:

```bash
npm install -g .
```

## Quick Start Example (AOT CLI)

This repository includes a sample Petstore `spec.json`.

1. **Generate the Example:**

```bash
npm start
```

_Note: If you don't have the underlying `cdd-ctl` binary installed globally, the tool will gracefully output mocked fallback text for the UI so you can still test the layout and functionality._

2. **Serve the Example:**

```bash
npm run serve
```

Navigate to `http://localhost:8000` (or whichever port `serve` selects) to view the generated documentation and test the interactive language dropdown and formatting checkboxes.
