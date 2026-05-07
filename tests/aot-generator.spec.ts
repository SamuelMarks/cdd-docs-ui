
import { describe, it, expect } from "vitest";
import { generateAOTHtml } from "../src/aot-generator";
import { CodeExample } from "../src/types";

describe("aot-generator", () => {
  it("should generate HTML correctly from valid spec and examples", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.1
paths:
  /users:
    get:
      operationId: getUsers
      summary: Get users
      parameters:
        - name: limit
          in: query
          required: false
          schema:
            type: integer
      responses:
        "200":
          description: A list of users
`;
    const sdkExamples: CodeExample[] = [
      { language: "rust", filepath: "getUsers.rs", content: "fn get_users() {}" }
    ];

    const html = generateAOTHtml(yamlStr, sdkExamples, "light");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Test API");
    expect(html).toContain("Get users");
    expect(html).toContain("fn get_users() {}");
    expect(html).toContain("cURL");
    expect(html).toContain("SDK");
    expect(html).toContain("cdd-layout");
    expect(html).toContain("--cdd-primary: #005ac1"); // Light theme primary
  });

  it("should handle dark theme", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
`;
    const html = generateAOTHtml(yamlStr, [], "dark");
    expect(html).toContain("--cdd-primary: #adc6ff"); // Dark theme primary
  });

  it("should render schemas correctly", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Schema API
  version: 1.0.0
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
`;
    const html = generateAOTHtml(yamlStr);
    expect(html).toContain("User");
    expect(html).toContain("cdd-schema-table");
    expect(html).toContain("id");
    expect(html).toContain("name");
  });

  it("should handle references in schemas", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Ref API
  version: 1.0.0
components:
  schemas:
    User:
      $ref: "#/components/schemas/Profile"
    Profile:
      type: object
      properties:
        bio:
          type: string
`;
    const html = generateAOTHtml(yamlStr);
    expect(html).toContain("Profile");
  });

  it("should handle request body and headers in generateCurl and Try It Out", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Curl API
  version: 1.0.0
paths:
  /test/{id}:
    post:
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
        - name: X-Header
          in: header
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
      responses:
        "200":
          description: OK
`;
    const html = generateAOTHtml(yamlStr);
    expect(html).toContain("-H \"X-Header: <value>\"");
    expect(html).toContain("-H \"Content-Type: application/json\"");
    expect(html).toContain("-d '{\"key\": \"value\"}'");
    // Try It Out form checks
    expect(html).toContain("cdd-try-form");
    expect(html).toContain("method=\"POST\"");
    expect(html).toContain("data-in=\"path\"");
    expect(html).toContain("data-in=\"header\"");
    expect(html).toContain("try-post-/test/{id}-id");
    expect(html).toContain("try-post-/test/{id}-body");
  });

  it("should handle array schemas", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Array API
  version: 1.0.0
components:
  schemas:
    List:
      type: array
      items:
        type: string
`;
    const html = generateAOTHtml(yamlStr);
    expect(html).toContain("Array of:");
  });

  it("should handle nested schemas", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Nested API
  version: 1.0.0
components:
  schemas:
    Company:
      type: object
      properties:
        ceo:
          type: object
          properties:
            name:
              type: string
`;
    const html = generateAOTHtml(yamlStr);
    expect(html).toContain("ceo");
    expect(html).toContain("name");
    expect(html).toContain("id=\"schema-Company-prop-ceo\"");
    expect(html).toContain("id=\"schema-Company-prop-ceo-prop-name\"");
    expect(html).toContain("class=\"cdd-anchor\"");
  });

  it("should generate parameter deep links", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Param API
  version: 1.0.0
paths:
  /test:
    get:
      operationId: getTest
      parameters:
        - name: id
          in: query
          schema:
            type: string
`;
    const html = generateAOTHtml(yamlStr);
    expect(html).toContain("id=\"getTest-param-id\"");
  });

  it("should skip path item references and parameter references", () => {
     const yamlStr = `
openapi: 3.0.0
info:
  title: Ref Skip API
  version: 1.0.0
paths:
  /ref:
    $ref: "#/components/pathItems/Item"
  /params:
    get:
      parameters:
        - $ref: "#/components/parameters/Id"
      responses:
        "200":
          description: OK
`;
     const html = generateAOTHtml(yamlStr);
     expect(html).toContain("/params");
     expect(html).not.toContain("/ref");
  });

  it("should handle path item with no methods", () => {
     const yamlStr = `
openapi: 3.0.0
info:
  title: Empty Path API
  version: 1.0.0
paths:
  /empty:
    summary: No methods here
`;
     const html = generateAOTHtml(yamlStr);
     expect(html).not.toContain("/empty");
  });

  it("should handle schema with no type or unknown type", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Unknown Type API
  version: 1.0.0
components:
  schemas:
    Unknown:
      description: Just a description
`;
    const html = generateAOTHtml(yamlStr);
    expect(html).toContain("any");
    expect(html).toContain("Just a description");
  });
});

describe("aot-generator-code-variants", () => {
  it("should handle code variants with imports and wrapping", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Variant API
  version: 1.0.0
paths:
  /test:
    get:
      operationId: test
`;
    const sdkExamples: CodeExample[] = [
      { 
        language: "ts", 
        filepath: "test.ts", 
        content: "import sdk\nsdk.test()", 
        includeImports: true, 
        includeWrapping: false 
      },
      { 
        language: "sh", 
        filepath: "test.sh", 
        content: "curl test", 
        includeImports: false, 
        includeWrapping: false 
      }
    ];

    const html = generateAOTHtml(yamlStr, sdkExamples);
    expect(html).toContain("language-typescript");
    expect(html).toContain("language-bash");
    expect(html).toContain("cdd-show-if-imports");
    expect(html).toContain("cdd-hide-if-imports");
  });

  it("should handle parameters without schemas", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: No Schema Param
  version: 1.0.0
paths:
  /test:
    get:
      parameters:
        - name: p1
          in: query
          required: true
`;
    const html = generateAOTHtml(yamlStr);
    expect(html).toContain("p1");
  });

  it("should fallback when no language examples are provided", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Empty Lang
  version: 1.0.0
paths:
  /test:
    get:
      operationId: test
`;
    const html = generateAOTHtml(yamlStr, []);
    expect(html).toContain("No example for javascript");
  });

  it("should handle empty object schema types", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Empty Obj
  version: 1.0.0
components:
  schemas:
    EmptyType:
      type: object
`;
    const html = generateAOTHtml(yamlStr);
    expect(html).toContain("EmptyType");
  });

  it("should handle request parameter headers that are not references", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Header Param API
  version: 1.0.0
paths:
  /test:
    get:
      parameters:
        - name: X-Test
          in: header
`;
    const html = generateAOTHtml(yamlStr);
    expect(html).toContain("-H \"X-Test: <value>\"");
  });

  it("should handle full arrays and primitive schemas", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Arr API
  version: 1.0.0
components:
  schemas:
    JustString:
      type: string
      description: "A simple string"
    ArrOfArr:
      type: array
      items:
        type: array
        items:
          type: string
`;
    const html = generateAOTHtml(yamlStr);
    expect(html).toContain("A simple string");
    expect(html).toContain("Array of:");
  });

  it("should handle request bodies that are references and parameter references", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Ref Test
  version: 1.0.0
paths:
  /test:
    post:
      parameters:
        - $ref: "#/components/parameters/Test"
      requestBody:
        $ref: "#/components/requestBodies/Test"
components:
  parameters:
    Test:
      name: test
      in: query
  requestBodies:
    Test:
      description: test body
`;
    const html = generateAOTHtml(yamlStr);
    // Should skip rendering the inline form fields because we don't resolve refs deeply in AOT for try-it-out yet.
    // At least it won't crash.
    expect(html).toContain("/test");
  });

  it("should inject live reload script when requested", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Watch API
  version: 1.0.0
`;
    const htmlWith = generateAOTHtml(yamlStr, [], "light", true);
    expect(htmlWith).toContain("/__livereload");

    const htmlWithout = generateAOTHtml(yamlStr, [], "light", false);
    expect(htmlWithout).not.toContain("/__livereload");
  });
});
