# Implementation Plan: cdd-docs-ui

This repository dynamically renders API documentation for published schemas based on the URL context.

- [x] **1. Dynamic Routing**
  - [x] Refactor from statically generated HTML to a dynamic Single Page App (or Server-Side Rendered shell).
  - [x] Implement route parsing to extract parameters from `mydomain.com/u/[org]/[repo]`.
- [x] **2. Schema Ingestion**
  - [x] Implement a fetch layer that requests the generated `schema.json` from `cdd-storage` (routed through `cdd-gateway`).
  - [x] Handle loading states and 404s gracefully if the org/repo combination does not exist.
- [x] **3. Presentation Layer**
  - [x] Render the fetched OpenAPI/Swagger data using the internal UI components.
  - [x] Add version toggles so users can select different release tags.
  - [x] Provide download links for the generated SDK artifacts (pointed at `cdd-storage` via `cdd-gateway`).

## Quality Standards
- [ ] No use of `unwrap`
- [ ] No use of `anyhow` or similar approaches, instead have one big error enum (with `derive_more`)
- [x] Maintain 100% test coverage
- [x] Maintain 100% doc coverage
