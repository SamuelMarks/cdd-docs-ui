# CDD Docs UI

![Test Coverage](https://img.shields.io/badge/Test_Coverage-100%25-brightgreen.svg) ![Doc Coverage](https://img.shields.io/badge/Doc_Coverage-100%25-brightgreen.svg)

[![CI](https://github.com/SamuelMarks/cdd-docs-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/SamuelMarks/cdd-docs-ui/actions/workflows/ci.yml)

A strictly-typed TypeScript CLI tool for generating static, progressively-enhanced API documentation websites based on OpenAPI specifications and code snippets from the `cdd` (Compiler Driven Development) toolchain.

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
    B(cdd-docs-ui JS Runner):::headline
    C{cdd-ctl Rust CLI}:::highlight
    D[[13 Language Targets]]:::bodytext
    E[Static HTML Site]:::terminal

    A -- Parses --> B
    B -- Executes --> C
    C -- Routes to --> D
    D -- JSON Snippets --> B
    B -- Renders --> E
```

## Features

- **100% Test Coverage:** Rigorously tested core logic.
- **Strict TypeScript:** No `any` or `unknown` types.
- **Progressive Enhancement:** Generates pure static HTML for fast load times and SEO. Enhances with Vanilla JS for dynamic, no-reload language switching.
- **Variant Support:** Supports and dynamically renders snippets with or without imports and code-wrapping.
- **Material 3 Theming:** Responsive, modern design out of the box.

## Architecture & Development

For detailed information on how the tool is structured, how to develop locally, and compliance standards, refer to the following guides:

- [ARCHITECTURE.md](ARCHITECTURE.md): An overview of the SSG process and component architecture.
- [COMPLIANCE.md](COMPLIANCE.md): Standards for TypeScript strictness, test coverage, and security.
- [DEVELOPING.md](DEVELOPING.md): Instructions on how to build, test, and contribute.
- [USAGE.md](USAGE.md): Detailed CLI options and usage instructions.

## Installation

To run from source:

```bash
npm install
npm run build
```

To install globally:

```bash
npm install -g .
```

## Quick Start Example

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

Navigate to `http://localhost:8000` to view the generated documentation and test the interactive language dropdown and formatting checkboxes.
