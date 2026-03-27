# OpenAPI 3.2.0 Conformance Table: Servers (ORM + REST API + Mocks + Tests)

This table tracks the completeness of language integration with OpenAPI 3.2.0 for server-side generation and extraction.

### Legend & Tracking Guide
*   **To**: Language -> OpenAPI (Generating the OpenAPI document from code/types/decorators)
*   **From**: OpenAPI -> Language (Generating server stubs/types/ORM models from the OpenAPI document)
*   **Presence `[To, From]`**: The object is successfully parsed, validated, utilized, or generated.
*   **Absence `[To, From]`**: The object is currently unsupported, dropped, or falls back to generic/`any` types.
*   **Skipped `[To, From]`**: Intentionally ignored because it is irrelevant or unsupported by the server architecture.
*   **Checkboxes**: Mark `[x]` as conformance is achieved.

| OpenAPI 3.2.0 Object / Feature | Presence `[To, From]` | Absence `[To, From]` | Skipped `[To, From]` | Notes / Implementation Strategy |
| :--- | :---: | :---: | :---: | :--- |
| **OpenAPI Object (Root)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Root document initialization |
| **OpenAPI Object (`openapi`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OpenAPI Object (`$self`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Base URI resolution for internal and external references |
| **OpenAPI Object (`info`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OpenAPI Object (`jsonSchemaDialect`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Validating schemas against explicit JSON Schema drafts |
| **OpenAPI Object (`servers`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OpenAPI Object (`paths`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OpenAPI Object (`webhooks`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Independent webhook routing / Event subscription dispatch |
| **OpenAPI Object (`components`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OpenAPI Object (`security`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OpenAPI Object (`tags`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OpenAPI Object (`externalDocs`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Info Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Global API Metadata (Title, Version, Description) |
| **Info Object (`title`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Info Object (`summary`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Global API short summary docstring |
| **Info Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Info Object (`termsOfService`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Info Object (`contact`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Info Object (`license`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Info Object (`version`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Contact Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Included in generated HTML docs/metadata |
| **Contact Object (`name`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Contact Object (`url`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Contact Object (`email`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **License Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Included in generated HTML docs/metadata |
| **License Object (`name`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **License Object (`identifier`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Server metadata / openapi.json generation |
| **License Object (`url`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Server Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Base URL generation, Router namespace/prefix mounting |
| **Server Object (`url`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Server Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Server Object (`name`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Server/Router instance naming |
| **Server Object (`variables`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Server Variable Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Dynamic route prefix validation / Enum injection |
| **Server Variable Object (`enum`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Server Variable Object (`default`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Server Variable Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Components Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Container for reusable ORM models, DTOs, Handlers |
| **Components Object (`schemas`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Components Object (`responses`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Components Object (`parameters`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Components Object (`examples`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Components Object (`requestBodies`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Components Object (`headers`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Components Object (`securitySchemes`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Components Object (`links`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Components Object (`callbacks`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Components Object (`pathItems`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Reusable router mounting blocks |
| **Components Object (`mediaTypes`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Reusable content negotiation blocks |
| **Paths Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Core router mounting and path mapping |
| **Paths Object (`/{path}`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Grouping endpoints by URI / Route-level parameters |
| **Path Item Object (`$ref`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`summary`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`get`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`put`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`post`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`delete`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`options`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`head`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`patch`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`trace`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`query`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | QUERY HTTP method handler binding |
| **Path Item Object (`additionalOperations`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Custom HTTP method handler bindings |
| **Path Item Object (`servers`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Path Item Object (`parameters`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Operation Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Individual Controller/Handler method bindings |
| **Operation Object (`tags`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Operation Object (`summary`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Operation Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Operation Object (`externalDocs`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Operation Object (`operationId`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Operation Object (`parameters`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Operation Object (`requestBody`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Operation Object (`responses`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Operation Object (`callbacks`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Operation Object (`deprecated`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Operation Object (`security`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Operation Object (`servers`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **External Documentation Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Javadoc/Docstring generation or extraction |
| **External Documentation Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **External Documentation Object (`url`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Parameter Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Parameter Object (`name`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Parameter Object (`in`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Parameter Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Parameter Object (`required`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Parameter Object (`deprecated`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Parameter Object (`allowEmptyValue`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Parameter Object (`example`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Parameter Object (`examples`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Parameter Object (`style`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Parameter Object (`explode`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Parameter Object (`allowReserved`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Parameter Object (`schema`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Parameter Object (`content`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Request Body Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Payload parsing, ORM hydration, and validation limits |
| **Request Body Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Request Body Object (`content`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Request Body Object (`required`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Media Type Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Content negotiation & Content-Type specific routing |
| **Media Type Object (`schema`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Media Type Object (`itemSchema`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Validation middleware for sequential payload elements |
| **Media Type Object (`example`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Media Type Object (`examples`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Media Type Object (`encoding`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Media Type Object (`prefixEncoding`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Media Type Object (`itemEncoding`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Encoding Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Handling multipart/form-data boundary & URL-encoded arrays |
| **Encoding Object (`contentType`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Encoding Object (`headers`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Encoding Object (`encoding`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Encoding Object (`prefixEncoding`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Encoding Object (`itemEncoding`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Encoding Object (`style`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Encoding Object (`explode`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Encoding Object (`allowReserved`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Responses Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Status code mapping (`200`, `4xx`) & `default` fallback handlers |
| **Responses Object (`default`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Responses Object (`HTTP Status Code`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Response Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Outgoing DTO serialization & header formatting |
| **Response Object (`summary`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Docstring generation for handler responses |
| **Response Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Response Object (`headers`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Response Object (`content`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Response Object (`links`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Callback Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Async out-of-band webhook dispatchers |
| **Callback Object (`{expression}`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Example Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Generating mock server endpoints / Test fixtures |
| **Example Object (`summary`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Example Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Example Object (`dataValue`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Example Object (`serializedValue`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Example Object (`externalValue`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Example Object (`value`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Link Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | HATEOAS / Relation mapping generation for APIs |
| **Link Object (`operationRef`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Link Object (`operationId`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Link Object (`parameters`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Link Object (`requestBody`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Link Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Link Object (`server`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Header Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Setting strongly-typed response headers (e.g. `X-RateLimit`) |
| **Header Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Header Object (`required`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Header Object (`deprecated`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Header Object (`example`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Header Object (`examples`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Header Object (`style`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Header Object (`explode`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Header Object (`schema`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Header Object (`content`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Tag Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Controller grouping, Namespace generation |
| **Tag Object (`name`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Tag Object (`summary`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Tag Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Tag Object (`externalDocs`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Tag Object (`parent`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Controller inheritance / nested routers |
| **Tag Object (`kind`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Controller categorization metadata |
| **Reference Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Reference Object (`$ref`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Internal component resolution & circular dependency cycles |
| **Reference Object (`summary`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Reference Object (`description`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Schema Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Schema Object (`discriminator`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Schema Object (`xml`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Schema Object (`externalDocs`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Schema Object (`example`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Discriminator Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Polymorphism / Single Table Inheritance ORM parsing |
| **Discriminator Object (`propertyName`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Discriminator Object (`mapping`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Discriminator Object (`defaultMapping`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Fallback STI mapping in ORM when missing type |
| **XML Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | XML DOM serialization/deserialization |
| **XML Object (`nodeType`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | XML deserialization binding rules (`attribute`/`element`) |
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
| **OAuth Flows Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Registering endpoints for supported grant types |
| **OAuth Flows Object (`implicit`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OAuth Flows Object (`password`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OAuth Flows Object (`clientCredentials`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OAuth Flows Object (`authorizationCode`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OAuth Flows Object (`deviceAuthorization`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Support for the Device Authorization grant flow |
| **OAuth Flow Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Extracting flow metadata (auth URL, token URL, scopes) |
| **OAuth Flow Object (`authorizationUrl`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OAuth Flow Object (`deviceAuthorizationUrl`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Routing for issuing device codes |
| **OAuth Flow Object (`tokenUrl`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OAuth Flow Object (`refreshUrl`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **OAuth Flow Object (`scopes`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
| **Security Requirement Object** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | Enforcing endpoint-level combinations (AND/OR auth logic) |
| **Security Requirement Object (`{name}`)** | `[ ]` , `[ ]` | `[ ]` , `[ ]` | `[ ]` , `[ ]` | TODO |
