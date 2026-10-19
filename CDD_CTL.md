# Integration Requirements for `cdd-ctl`

![Test Coverage](https://img.shields.io/badge/Test_Coverage-100%25-brightgreen.svg) ![Doc Coverage](https://img.shields.io/badge/Doc_Coverage-100%25-brightgreen.svg)

This document outlines the required features, structural changes, and delivery checklist for the `cdd-ctl` (Rust) repository to seamlessly integrate with the `cdd-docs-ui` documentation runner.

As `cdd-docs-ui` is responsible for generating comprehensive API documentation (in its AOT CLI mode), it relies on invoking `cdd-ctl` to dynamically generate valid code snippets across 13 distinct `cdd-*` source languages.

### Feature Delivery Checklist

#### 1. CLI Invocation & Core Routing

- [ ] **Unified Binary Integration:** Ensure all standalone `cdd_*` binaries are ported and integrated into a single `cdd-ctl` executable.
- [ ] **Target Routing:** Parse the `<target_language>` argument to route execution to the correct internal language generator module.
- [ ] **Action Subcommand (`to_docs_json`):** Implement the `to_docs_json` generation mode to bypass standard file I/O operations and generate purely in-memory.
- [ ] **Input File Flag (`-i` / `--input`):** Ensure the root CLI correctly passes the OpenAPI specification file path to all target sub-generators.

#### 2. Target Generators (13 Supported Languages)

Each of the 13 underlying `cdd-*` projects must fully implement the `to_docs_json` generation mode for their Client, Client CLI, and Server targets. All generators must support **OpenAPI 3.2.0**, **Swagger 2.0**, and **Arazzo 1.1.0** (as well as Google Discovery where specified).

- [ ] **C (`cdd-c`) Target:** Implement JSON emission for C89 (including FFI and Arazzo 1.1.0 workflow orchestrator support).
- [ ] **C++ (`cdd-cpp`) Target:** Implement JSON emission (OpenAPI 3.2.0, Swagger 2.0, and Arazzo 1.1.0 workflows).
- [ ] **C# (`cdd-csharp`) Target:** Implement JSON emission (including CLR and Arazzo 1.1.0 workflow support).
- [ ] **Go (`cdd-go`) Target:** Implement JSON emission (OpenAPI 3.2.0 and Arazzo 1.1.0 workflows).
- [ ] **Java (`cdd-java`) Target:** Implement JSON emission (OpenAPI 3.2.0 and Arazzo 1.1.0 workflows).
- [ ] **Kotlin (`cdd-kotlin`) Target:** Implement JSON emission (`ktor` Multiplatform, Auto-Admin UI, and Arazzo 1.1.0 workflows).
- [ ] **PHP (`cdd-php`) Target:** Implement JSON emission (OpenAPI 3.2.0 and Arazzo 1.1.0 workflows).
- [ ] **Python (`cdd-python-all`) Target:** Implement JSON emission (OpenAPI 3.2.0 and Arazzo 1.1.0 workflows).
- [ ] **Ruby (`cdd-ruby`) Target:** Implement JSON emission (OpenAPI 3.2.0 and Arazzo 1.1.0 workflows).
- [ ] **Rust (`cdd-rust`) Target:** Implement JSON emission (OpenAPI 3.2.0 and Arazzo 1.1.0 workflows).
- [ ] **Shell (`cdd-sh`) Target:** Implement JSON emission for `/bin/sh` (OpenAPI 3.2.0 and Arazzo 1.1.0 workflows).
- [ ] **Swift (`cdd-swift`) Target:** Implement JSON emission (OpenAPI 3.2.0 and Arazzo 1.1.0 workflows).
- [ ] **TypeScript (`cdd-ts`) Target:** Implement JSON emission (Auto-Admin UI, Angular, React, Vue, fetch, Axios, Node.js, OpenAPI 3.2.0, Swagger 2.0, and Arazzo 1.1.0 workflows).

#### 3. Variant Support & Modifiers

- [ ] **`--no-imports` Flag Implementation:** Modify AST/string builders across all 13 generators to strip or omit package declarations, dependencies, and imports when this flag is provided.
- [ ] **`--no-wrapping` Flag Implementation:** Modify AST/string builders across all 13 generators to strip enclosing boilerplate classes, struct initializations, or wrapper functions, yielding only the raw client execution logic.

#### 4. JSON Serialization (Stdout)

- [ ] **Clean Stdout Guarantee:** Enforce that absolutely no logging, debug information, compiler warnings, or progress tracking bars are printed to `stdout` during `to_docs_json` execution.
- [ ] **Payload Structure Mapping:** Construct the in-memory generated code into the exact JSON payload schema expected by `cdd-docs-ui`:
    ```json
    {
        "endpoints": {
            "/path/to/endpoint": {
                "get": "client.getEndpoint()",
                "post": "client.postEndpoint(data)"
            }
        }
    }
    ```
- [ ] **JSON Emission:** Serialize and emit the final JSON payload safely directly to `stdout`.

#### 5. Error Handling & Diagnostics

- [ ] **Strict Non-Zero Exit Codes:** Return explicit non-zero exit codes if snippet generation fails (e.g., due to parsing errors, invalid OpenAPI specs, or missing internal templates).
- [ ] **Stderr Routing:** Configure logging frameworks (e.g., `tracing`, `env_logger`) or `eprintln!` to exclusively write diagnostic information and warnings to `stderr`. This strictly isolates failures from the successful `stdout` JSON pipeline.

#### 6. Binary Distribution & CI/CD

- [ ] **Cross-Platform Compilation Matrix:** Setup GitHub Actions (or equivalent CI) to natively compile release binaries for macOS (Intel/ARM), Linux, and Windows.
- [ ] **Release Artifacts Automation:** Automatically zip and attach compiled binaries (`cdd-ctl`, `cdd-ctl.exe`) to GitHub Releases based on version tags.
- [ ] **Version Synchronization:** Establish a predictable versioning semantic so the `cdd-docs-ui` runner can safely verify, download, and execute compatible binary versions without manual intervention.
