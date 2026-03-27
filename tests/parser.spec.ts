
import { describe, it, expect } from "vitest";
import { normalizeSpec, mapSdkExamples, isReference } from "../src/parser";
import { DocData, CodeExample, PathItemObject } from "../src/types";

describe("parser", () => {
  it("should normalize valid openapi correctly", () => {
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
    const result = normalizeSpec(yamlStr);
    expect(result.spec.info.title).toBe("Test API");
    expect(result.spec.info.version).toBe("1.0.1");
    const paths = result.spec.paths;
    expect(paths).toBeDefined();
    expect(paths!["/users"]).toBeDefined();
    expect((paths!["/users"] as PathItemObject).get?.operationId).toBe("getUsers");
    expect((paths!["/users"] as PathItemObject).get?.parameters?.[0] as any).toBeDefined();
  });

  it("should handle empty or invalid spec gracefully", () => {
     expect(() => normalizeSpec("not-a-yaml-object")).toThrow("Invalid OpenAPI specification format");
     expect(() => normalizeSpec("{")).toThrow("Invalid OpenAPI specification format");
  });

  it("should handle spec without paths", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Empty API
`;
    const result = normalizeSpec(yamlStr);
    expect(result.spec.info.title).toBe("Empty API");
    expect(result.spec.paths).toBeUndefined();
  });

  it("should map SDK examples properly based on ID match", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Test API
paths:
  /users:
    get:
      operationId: getUsers
`;
    const docData = normalizeSpec(yamlStr);
    const examples: CodeExample[] = [
      { language: "rust", filepath: "getUsers.rs", content: "fn get_users() {}" }
    ];
    
    mapSdkExamples(docData, examples);
    expect(docData.codeExamples["getUsers"]).toBeDefined();
    expect(docData.codeExamples["getUsers"][0].language).toBe("rust");
  });
});
