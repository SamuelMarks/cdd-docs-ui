# OpenAPI 3.2.0 Conformance Table: Client SDK (HTTP Client + Mocks + Tests)

*Note: This file tracks the capabilities of the underlying `cdd-ctl` targets that `cdd-docs-ui` relies on for generating code snippets.*


This table tracks the completeness of language integration with OpenAPI 3.2.0 for Client SDK generation and extraction.

### Legend & Tracking Guide
*   **To**: Language -> OpenAPI (Generating the OpenAPI document from strongly typed client SDKs)
*   **From**: OpenAPI -> Language (Generating HTTP Client code, interfaces, and methods from the OpenAPI document)
*   **Presence `[To, From]`**: The object is successfully parsed, validated, utilized, or generated.
*   **Absence `[To, From]`**: The object is currently unsupported, dropped, or falls back to generic/`any` types.
*   **Skipped `[To, From]`**: Intentionally ignored because it is irrelevant or unsupported by the Client architecture.
*   **Checkboxes**: Mark `[x]` as conformance is achieved.

| OpenAPI 3.2.0 Object / Feature | Presence `[To, From]` | Absence `[To, From]` | Skipped `[To, From]` | Notes / Implementation Strategy |
| :--- | :---: | :---: | :---: | :--- |
| **OpenAPI Object (Root)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Root generation / parsing |
| **OpenAPI Object (`openapi`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **OpenAPI Object (`$self`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Base URI resolution for internal and external references |
| **OpenAPI Object (`info`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **OpenAPI Object (`jsonSchemaDialect`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Recognizing custom dialect validation rules locally |
| **OpenAPI Object (`servers`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **OpenAPI Object (`paths`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **OpenAPI Object (`webhooks`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Generating local event/webhook parsing utilities |
| **OpenAPI Object (`components`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **OpenAPI Object (`security`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OpenAPI Object (`tags`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **OpenAPI Object (`externalDocs`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Info Object** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | SDK Header metadata, docstrings, package descriptions |
| **Info Object (`title`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Info Object (`summary`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Short package description in package.json/pom.xml |
| **Info Object (`description`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Info Object (`termsOfService`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Info Object (`contact`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Info Object (`license`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Info Object (`version`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Contact Object** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | Package maintainer info in manifest |
| **Contact Object (`name`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Contact Object (`url`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Contact Object (`email`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **License Object** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | Package license generation |
| **License Object (`name`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **License Object (`identifier`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Package license SPDX field |
| **License Object (`url`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Server Object** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | Default Base URL configuration in Client builder |
| **Server Object (`url`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Server Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Server Object (`name`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Generated as enum/constants for environment selection |
| **Server Object (`variables`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Server Variable Object** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | SDK builder/constructor parameters (e.g. `region`, `env`) |
| **Server Variable Object (`enum`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Server Variable Object (`default`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Server Variable Object (`description`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Components Object** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | Container for reusable types, interfaces, classes |
| **Components Object (`schemas`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Components Object (`responses`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Components Object (`parameters`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Components Object (`examples`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Components Object (`requestBodies`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Components Object (`headers`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Components Object (`securitySchemes`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Components Object (`links`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Components Object (`callbacks`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Components Object (`pathItems`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Reusable SDK resource group resolution |
| **Components Object (`mediaTypes`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Reusable payload serialization definitions |
| **Paths Object** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | Mapped to top-level client namespaces or groups |
| **Paths Object (`/{path}`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | Grouping related operations under a single resource |
| **Path Item Object (`$ref`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`summary`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`get`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Path Item Object (`put`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`post`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Path Item Object (`delete`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Path Item Object (`options`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`head`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`patch`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`trace`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`query`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | QUERY HTTP method generation |
| **Path Item Object (`additionalOperations`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Custom HTTP method generation |
| **Path Item Object (`servers`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`parameters`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Operation Object** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | Specific Client methods (e.g., `client.users.get(id)`) |
| **Operation Object (`tags`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Operation Object (`summary`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Operation Object (`description`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Operation Object (`externalDocs`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Operation Object (`operationId`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Operation Object (`parameters`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Operation Object (`requestBody`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Operation Object (`responses`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Operation Object (`callbacks`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Operation Object (`deprecated`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Operation Object (`security`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Operation Object (`servers`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **External Documentation Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Rendered into method/class Javadoc or IDE docstrings |
| **External Documentation Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **External Documentation Object (`url`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Parameter Object** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Parameter Object (`name`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Parameter Object (`in`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Parameter Object (`description`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Parameter Object (`required`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Parameter Object (`deprecated`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Parameter Object (`allowEmptyValue`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Parameter Object (`example`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Parameter Object (`examples`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Parameter Object (`style`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Parameter Object (`explode`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Parameter Object (`allowReserved`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Parameter Object (`schema`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Parameter Object (`content`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Request Body Object** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | Typed request payload object/class argument |
| **Request Body Object (`description`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Request Body Object (`content`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Request Body Object (`required`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Media Type Object** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | Automatically setting `Content-Type` / `Accept` headers |
| **Media Type Object (`schema`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Media Type Object (`itemSchema`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Strong typing for array items in sequential media types |
| **Media Type Object (`example`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Media Type Object (`examples`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Media Type Object (`encoding`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Media Type Object (`prefixEncoding`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Media Type Object (`itemEncoding`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Encoding Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | URL-encoding logic for complex queries, multipart builders |
| **Encoding Object (`contentType`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Encoding Object (`headers`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Encoding Object (`encoding`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Encoding Object (`prefixEncoding`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Encoding Object (`itemEncoding`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Encoding Object (`style`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Encoding Object (`explode`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Encoding Object (`allowReserved`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Responses Object** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | Return type branching (Success types vs. Error throwing) |
| **Responses Object (`default`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Responses Object (`HTTP Status Code`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Response Object** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | Strongly typed response payload class wrapper |
| **Response Object (`summary`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Javadoc/Docstring for specific response branches |
| **Response Object (`description`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Response Object (`headers`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Response Object (`content`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Response Object (`links`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Callback Object** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | Often skipped in synchronous SDKs |
| **Callback Object (`{expression}`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Example Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Mock HTTP client generation & unit test fixtures |
| **Example Object (`summary`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Example Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Example Object (`dataValue`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Example Object (`serializedValue`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Example Object (`externalValue`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Example Object (`value`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Link Object** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | Fluent method chaining helpers (e.g., `resp.getAuthor()`) |
| **Link Object (`operationRef`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Link Object (`operationId`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Link Object (`parameters`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Link Object (`requestBody`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Link Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Link Object (`server`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Header Object** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | Exposing typed headers on the Return/Response object |
| **Header Object (`description`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Header Object (`required`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Header Object (`deprecated`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Header Object (`example`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Header Object (`examples`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Header Object (`style`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Header Object (`explode`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Header Object (`schema`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Header Object (`content`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Tag Object** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | SDK Namespace grouping (e.g., `client.billing.*`) |
| **Tag Object (`name`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Tag Object (`summary`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Tag Object (`description`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Tag Object (`externalDocs`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Tag Object (`parent`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Nested client namespaces (e.g., `client.billing.invoices`) |
| **Tag Object (`kind`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Organizing generated classes by kind |
| **Reference Object** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Reference Object (`$ref`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | Internal/External type resolution |
| **Reference Object (`summary`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Reference Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Schema Object** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Schema Object (`discriminator`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Schema Object (`xml`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Schema Object (`externalDocs`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Schema Object (`example`)** | `[x]` , `[x]` | `[ ]` , `[ ]` | `[x]` , `[x]` | TODO |
| **Discriminator Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Client-side deserialization factories (Polymorphic JSON decoding) |
| **Discriminator Object (`propertyName`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Discriminator Object (`mapping`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Discriminator Object (`defaultMapping`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Default fallback for polymorphic deserialization |
| **XML Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | XML DOM mapping / Often skipped if JSON-only |
| **XML Object (`nodeType`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Precise XML DOM mapping controls |
| **XML Object (`name`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **XML Object (`namespace`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **XML Object (`prefix`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **XML Object (`attribute`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **XML Object (`wrapped`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Security Scheme Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Security Scheme Object (`type`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Security Scheme Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Security Scheme Object (`name`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Security Scheme Object (`in`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Security Scheme Object (`scheme`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Security Scheme Object (`bearerFormat`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Security Scheme Object (`flows`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Security Scheme Object (`openIdConnectUrl`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Security Scheme Object (`oauth2MetadataUrl`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | OAuth2 metadata discovery |
| **Security Scheme Object (`deprecated`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OAuth Flows Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Helpers for token exchange requests |
| **OAuth Flows Object (`implicit`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OAuth Flows Object (`password`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OAuth Flows Object (`clientCredentials`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OAuth Flows Object (`authorizationCode`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OAuth Flows Object (`deviceAuthorization`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Support for the Device Authorization grant flow |
| **OAuth Flow Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | URL discovery for token exchange |
| **OAuth Flow Object (`authorizationUrl`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OAuth Flow Object (`deviceAuthorizationUrl`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | SDK method for initiating device flow authentication |
| **OAuth Flow Object (`tokenUrl`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OAuth Flow Object (`refreshUrl`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OAuth Flow Object (`scopes`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Security Requirement Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Automatic attachment of required auth headers per method |
| **Security Requirement Object (`{name}`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
