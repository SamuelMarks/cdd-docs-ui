
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CddApiDocs } from "../src/web-component";
import { html, render } from "lit";
if (!customElements.get("cdd-api-docs")) customElements.define("cdd-api-docs", CddApiDocs);

describe("web-component", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should mount correctly with empty spec", async () => {
    render(html`<cdd-api-docs></cdd-api-docs>`, container);
    const el = container.querySelector("cdd-api-docs") as any;
    expect(el).toBeDefined();
    await el.updateComplete;
    expect(el.textContent).toContain("Loading or Invalid Specification...");
  });

  it("should mount and render spec content", async () => {
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
    
    render(html`<cdd-api-docs .specContent="${yamlStr}" .theme="${"dark"}"></cdd-api-docs>`, container);
    const el = container.querySelector("cdd-api-docs") as any;
    await el.updateComplete;
    
    expect(el.textContent).toContain("Test API");
    expect(el.textContent).toContain("v1.0.1");
    expect(el.textContent).toContain("Get users");
  });

  it("should handle invalid spec content", async () => {
    render(html`<cdd-api-docs .specContent="${"{ invalid"}"}></cdd-api-docs>`, container);
    const el = container.querySelector("cdd-api-docs") as any;
    await el.updateComplete;
    
    expect(el.textContent).toContain("Loading or Invalid Specification...");
  });

  it("should map SDK examples correctly", async () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: Test API
paths:
  /users:
    get:
      operationId: getUsers
`;
    const sdkExamples = [{ language: "rust", filepath: "getUsers.rs", content: "fn get_users() {}" }];
    
    render(html`<cdd-api-docs .specContent="${yamlStr}" .sdkExamples="${sdkExamples}"></cdd-api-docs>`, container);
    const el = container.querySelector("cdd-api-docs") as any;
    await el.updateComplete;
    
    expect(el.textContent).toContain("getUsers.rs");
    expect(el.textContent).toContain("fn get_users() {}");
  });
});
