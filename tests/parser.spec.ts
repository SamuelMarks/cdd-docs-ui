
import { describe, it, expect } from "vitest";
import { normalizeSpec, mapSdkExamples } from "../src/parser";
import { DocData, CodeExample } from "../src/types";

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
    expect(result.title).toBe("Test API");
    expect(result.version).toBe("1.0.1");
    expect(result.groups["Default"]).toBeDefined();
    expect(result.groups["Default"][0].id).toBe("getUsers");
    expect(result.groups["Default"][0].parameters[0].name).toBe("limit");
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
    expect(result.title).toBe("Empty API");
    expect(Object.keys(result.groups).length).toBe(0);
  });

  it("should skip unsupported HTTP methods", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Test API
paths:
  /test:
    head:
      responses:
        "200":
          description: ok
`;
    const result = normalizeSpec(yamlStr);
    expect(Object.keys(result.groups).length).toBe(0);
  });
  
  it("should map SDK examples properly based on ID match", () => {
    const docData: DocData = {
      title: "Test",
      version: "1.0",
      description: "",
      groups: {
        "Default": [{
          id: "getUsers",
          path: "/users",
          method: "get",
          summary: "",
          description: "",
          parameters: [],
          responses: {},
          tag: "Default"
        }]
      },
      codeExamples: {}
    };
    
    const examples: CodeExample[] = [
      { language: "rust", filepath: "getUsers.rs", content: "fn get_users() {}" }
    ];
    
    mapSdkExamples(docData, examples);
    expect(docData.codeExamples["getUsers"]).toBeDefined();
    expect(docData.codeExamples["getUsers"][0].language).toBe("rust");
  });

  it("should map SDK examples properly to first operation if ID mismatch", () => {
    const docData: DocData = {
      title: "Test",
      version: "1.0",
      description: "",
      groups: {
        "Default": [{
          id: "postUsers",
          path: "/users",
          method: "post",
          summary: "",
          description: "",
          parameters: [],
          responses: {},
          tag: "Default"
        }]
      },
      codeExamples: {}
    };
    
    const examples: CodeExample[] = [
      { language: "go", filepath: "unknown.go", content: "package main" }
    ];
    
    mapSdkExamples(docData, examples);
    expect(docData.codeExamples["postUsers"]).toBeDefined();
    expect(docData.codeExamples["postUsers"][0].language).toBe("go");
  });

  it("should not crash mapping SDK examples if docData groups are empty", () => {
    const docData: DocData = { title: "T", version: "1", description: "", groups: {}, codeExamples: {} };
    expect(() => mapSdkExamples(docData, [{ language: "c", filepath: "1", content: "" }])).not.toThrow();
  });
});
