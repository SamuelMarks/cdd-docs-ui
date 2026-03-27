
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
    expect(html).toContain("<html lang=\"en\" data-theme=\"light\">");
    expect(html).toContain("Test API");
    expect(html).toContain("v1.0.1");
    expect(html).toContain("Get users");
    expect(html).toContain("getUsers.rs");
    expect(html).toContain("fn get_users() {}");
  });

  it("should handle dark theme", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Test API
`;
    const html = generateAOTHtml(yamlStr, [], "dark");
    expect(html).toContain("data-theme=\"dark\"");
  });
});
