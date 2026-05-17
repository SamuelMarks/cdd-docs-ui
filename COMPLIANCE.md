# Compliance and Standards

![Test Coverage](https://img.shields.io/badge/Test_Coverage-100%25-brightgreen.svg) ![Doc Coverage](https://img.shields.io/badge/Doc_Coverage-100%25-brightgreen.svg)

The `cdd-docs-ui` project strictly adheres to the following engineering standards and conventions to ensure security, maintainability, and high code quality.

## Strict TypeScript

The project is written exclusively in TypeScript and compiles under the strictest settings.

- **No Implicit `any`:** `noImplicitAny: true` is enforced globally. No variable or parameter may lack an explicit type definition.
- **No `unknown` types:** Code should be strongly typed using domain-specific interfaces (e.g., `OpenAPISpec`, `CDDOutput`) rather than relying on generic placeholders.
- **Strict Null Checks:** `strictNullChecks: true` is enabled. All potential `null` or `undefined` values must be handled explicitly.
- **Complete Type Definitions:** All complex objects (like OpenAPI schemas and CLI options) are strictly defined in `src/types.ts` or `src/openapi-types.ts`.

## Code Coverage

The project maintains a rigorous 100% test coverage threshold across all metrics using Vitest:

- **Statements:** 100%
- **Branches:** 100%
- **Functions:** 100%
- **Lines:** 100%

Every function, conditional branch, error catch block, and module execution path must be covered by unit tests. Pull requests must pass the `npm run test` script without lowering these thresholds.

## Documentation

- **JSDoc / TSDoc:** 100% documentation coverage is required for all exported variables, functions, interfaces, and modules within the `src/` directory.
- **Explanatory Comments:** Comments should explain _why_ a complex decision was made, not _what_ the code is doing (which should be obvious from the strong typings and naming conventions).

## Dependencies

- The project limits its runtime dependencies to essential libraries (`commander`, `lit`, `marked`, `fs-extra`) to minimize surface area for vulnerabilities. It eschews heavier template engines like `ejs` in favor of TypeScript string literals.

## Security Practices

- **No Sensitive Data Logged:** No secrets, API keys, or sensitive credentials are ever logged to the console or written to generated output files.
- **Graceful Error Handling:** Process execution errors (like an unavailable external CDD tool) are caught gracefully, logging a warning rather than crashing the generation process, and substituting mock code to ensure the UI remains testable.
- **Child Process Execution:** The `runner.ts` module uses `child_process.exec` securely, strictly passing predefined commands combined with file paths. No unvalidated user input is passed directly to the shell executor.

## Frontend (Generated Site & Web Component)

- **Lit & Vanilla JS:** The Client-Side SPA relies on `lit` and vanilla DOM APIs to guarantee long-term maintainability.
- **Progressive Enhancement:** The AOT generated site must be fully usable with JavaScript disabled. All interactive elements have native HTML fallback behaviors.
- **CSS Architecture:** Uses Vanilla CSS with CSS Variables (`:root`) themed around Material Design 3 guidelines for consistency and responsiveness. No heavy CSS frameworks (like Tailwind or Bootstrap) are used.
