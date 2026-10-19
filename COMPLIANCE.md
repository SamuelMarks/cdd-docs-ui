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

- The project limits its runtime dependencies to essential libraries (`express`, `js-yaml`, `marked`) to minimize surface area for vulnerabilities. It eschews heavier template engines like `ejs` and UI frameworks like `lit` in favor of TypeScript string literals and native Custom Elements (`HTMLElement`).

## Security Practices

- **No Sensitive Data Logged:** No secrets, API keys, or sensitive credentials are ever logged to the console or written to generated output files.
- **XSS Sanitization:** All user-supplied or spec-supplied strings (`info.title`, `op.summary`, `route`, `curl`, and SDK code snippets) are HTML-escaped via `escapeHtml` prior to DOM/HTML interpolation.
- **Graceful Error Handling:** Process execution errors (like an unavailable external CDD tool) are caught gracefully, substituting mock code to ensure the UI remains testable.
- **Child Process Execution:** The `runner.ts` module uses `child_process.execFile` securely, strictly passing argument arrays rather than invoking a shell. No unvalidated user input is passed to a shell executor.

## Frontend (Generated Site & Web Component)

- **Native Custom Elements & Vanilla JS:** The Client-Side SPA relies on native `HTMLElement` Web Components and vanilla DOM APIs to guarantee zero-framework overhead and long-term maintainability.
- **Progressive Enhancement:** The AOT generated site must be fully usable with JavaScript disabled. All interactive elements have native HTML fallback behaviors.
- **CSS Architecture:** Uses Vanilla CSS with CSS Variables (`:root`) themed around Material Design 3 guidelines for consistency and responsiveness. No heavy CSS frameworks (like Tailwind or Bootstrap) are used.

## Current Specification Status

- **OpenAPI 3.0.x & 3.1.x**: Fully supported.
- **Swagger 2.0 and OpenAPI 3.2.0**: Fully supported (`$self`, `query` HTTP method, `additionalOperations`, `webhooks`, `itemSchema`, `prefixEncoding`, `itemEncoding`, `oauth2MetadataUrl`, `deviceAuthorization`, `summary` on tags/operations/info).
- **Arazzo 1.1.0**: Supported for workflow specification parsing, step dependency DAG visualization, runtime expression rendering, interactive multi-step workflow execution, and 13-language SDK workflow snippet rendering (`conformance/arazzo-1.1.0/`).

## Support Matrix

| Specification Concept                                      | Status |
| ---------------------------------------------------------- | ------ |
| Info Object (`title`, `summary`, `description`, `version`) | ✅     |
| Server Object & Variable Templating                        | ✅     |
| Components Object (`schemas`, `parameters`, `responses`)   | ✅     |
| Paths Object & Path Item Object                            | ✅     |
| Operation Object (`QUERY`, `additionalOperations`)         | ✅     |
| Parameter Object (`path`, `query`, `querystring`, `header`, `cookie`) | ✅ |
| Request Body Object & Media Types (`itemSchema`)           | ✅     |
| Responses Object & Status Code Ranges                      | ✅     |
| Schema Object (JSON Schema 2020-12 & Polymorphism)         | ✅     |
| Reference Object (`$ref`, `summary`, `description`)        | ✅     |
| OAuth Flows (`deviceAuthorization`, `oauth2MetadataUrl`)   | ✅     |
| Security Scheme & Security Requirement Objects             | ✅     |
| Links & Callbacks                                          | ✅     |
| Webhooks                                                   | ✅     |
| Arazzo 1.1.0 Source Descriptions (`openapi`, `asyncapi`, `arazzo`) | ✅ |
| Arazzo 1.1.0 Workflows (`dependsOn`, `inputs`, `outputs`)  | ✅     |
| Arazzo 1.1.0 Steps (`operationId`, `operationPath`, `channelPath`, `workflowId`) | ✅ |
| Arazzo 1.1.0 Criteria, Selectors & Payload Replacements    | ✅     |
| Arazzo 1.1.0 Success & Failure Actions (`end`, `goto`, `retry`) | ✅ |
| Arazzo 1.1.0 Reusable Components & Runtime Expressions     | ✅     |

