
import { describe, it, expect } from "vitest";
import { 
  normalizeSpec, mapSdkExamples, isReference, parseInfo, parseServer, parseSchema, 
  parseParameter, parseRequestBody, parseResponse, parsePathItem,
  parseSecurityScheme, parseComponents, parseTag, parseSecurityRequirement
} from "../src/parser";
import { DocData, CodeExample, PathItemObject } from "../src/types";

describe("parser edge cases", () => {
  it("should throw on missing info object", () => {
    expect(() => parseInfo(null)).toThrow("Missing info object");
  });

  it("should handle partial server objects with variables", () => {
    const s = parseServer({ url: "test", variables: { port: { default: "80" } } });
    expect(s.variables?.port.default).toBe("80");
  });

  it("should parse boolean schema properties", () => {
    const s = parseSchema({ type: "string", exclusiveMaximum: true, readOnly: true, writeOnly: false });
    expect((s as any).exclusiveMaximum).toBe(true);
    expect((s as any).readOnly).toBe(true);
    expect((s as any).writeOnly).toBe(false);
  });

  it("should parse security requirement properly", () => {
    const r = parseSecurityRequirement({ api_key: [] });
    expect(r.api_key).toEqual([]);
  });

  it("should handle discriminator and xml in schema", () => {
    const s = parseSchema({
      discriminator: { propertyName: "type", mapping: { a: "A" } },
      xml: { name: "test", attribute: true, wrapped: false }
    });
    expect((s as any).discriminator.mapping.a).toBe("A");
    expect((s as any).xml.attribute).toBe(true);
  });

  it("should handle full security scheme", () => {
    const ss = parseSecurityScheme({
      type: "oauth2",
      flows: { implicit: { authorizationUrl: "url", scopes: { read: "read" } } }
    });
    expect((ss as any).flows.implicit.scopes.read).toBe("read");
  });

  it("should handle parsing empty or missing components", () => {
    const c = parseComponents({});
    expect(c).toEqual({});
  });

  it("should handle external docs everywhere", () => {
    const t = parseTag({ name: "t", externalDocs: { url: "u" } });
    expect(t.externalDocs?.url).toBe("u");
  });

  it("should handle mapSdkExamples with no paths", () => {
    const doc: any = { spec: {}, codeExamples: {} };
    mapSdkExamples(doc, []); // should not throw
  });

  it("should handle normalizeSpec missing jsonSchemaDialect and webhooks", () => {
    const doc = normalizeSpec(`
openapi: 3.2.0
info:
  title: Test
  version: 1
webhooks:
  myHook:
    post:
      responses:
        '200':
          description: OK
`);
    expect(doc.spec.webhooks?.myHook).toBeDefined();
  });
});

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

describe("parser branches", () => {
  it("should parse parameters with examples and content", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: API
paths:
  /test:
    get:
      parameters:
        - name: test_param
          in: query
          examples:
            ex1:
              value: "foo"
          content:
            "application/json":
              schema:
                type: string
`;
    const docData = normalizeSpec(yamlStr);
    const param = docData.spec.paths!["/test"].get!.parameters![0] as any;
    expect(param.examples.ex1.value).toBe("foo");
    expect(param.content["application/json"].schema.type).toBe("string");
  });

  it("should map unrecognised sdk examples to the first operation", () => {
    const yamlStr = `
openapi: 3.0.0
info:
  title: API
paths:
  /test:
    get:
      operationId: myOperation
`;
    const docData = normalizeSpec(yamlStr);
    mapSdkExamples(docData, [
      { language: "rust", filepath: "unmatched.rs", content: "fn test() {}" }
    ]);
    expect(docData.codeExamples["myOperation"]).toBeDefined();
    expect(docData.codeExamples["myOperation"][0].filepath).toBe("unmatched.rs");
  });
});

describe("parser kitchen sink", () => {
  it("should parse an exhaustive openapi spec", () => {
    const yamlStr = `
openapi: 3.1.0
jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema"
info:
  title: API
  version: 1.0.0
servers:
  - url: http://foo.com
    variables:
      port:
        default: "80"
paths:
  /foo:
    $ref: "#/components/pathItems/Foo"
    summary: Override
    get:
      summary: "get foo"
      description: "desc"
      servers: []
      parameters: []
      requestBody:
        $ref: "#/components/requestBodies/Req"
      responses:
        "200":
          $ref: "#/components/responses/Res"
      callbacks:
        myCb:
          $ref: "#/components/callbacks/Cb"
      security:
        - OAuth: ["scope"]
webhooks:
  myWebhook:
    post:
      responses:
        "200":
          description: ok
components:
  schemas:
    Sch:
      type: object
      discriminator:
        propertyName: type
        mapping:
          a: b
      xml:
        name: foo
        namespace: bar
        prefix: p
        attribute: true
        wrapped: false
  responses:
    Res:
      description: res
      headers:
        X-Rate-Limit:
          $ref: "#/components/headers/Head"
      content:
        "application/json":
          schema:
            type: string
          encoding:
            foo:
              contentType: text/plain
              headers:
                X-Test:
                  description: test
              style: form
              explode: true
              allowReserved: true
      links:
        myLink:
          $ref: "#/components/links/Lnk"
  parameters:
    Param:
      name: p
      in: query
  examples:
    Ex:
      summary: ex
      description: desc
      value: v
      externalValue: ev
  requestBodies:
    Req:
      description: req
      content: {}
      required: true
  headers:
    Head:
      description: head
  securitySchemes:
    OAuth:
      type: oauth2
      description: desc
      name: oauth
      in: header
      scheme: bearer
      bearerFormat: JWT
      openIdConnectUrl: http://open.id
      flows:
        implicit:
          authorizationUrl: http://auth
          tokenUrl: http://token
          refreshUrl: http://refresh
          scopes:
            scope: desc
        password:
          scopes: {}
        clientCredentials:
          scopes: {}
        authorizationCode:
          scopes: {}
  links:
    Lnk:
      operationRef: "#/paths/~1foo/get"
      operationId: getFoo
      parameters: {}
      requestBody: {}
      description: link
      server:
        url: http://link
  callbacks:
    Cb:
      "{$request.body.url}":
        post:
          responses: {}
  pathItems:
    Foo:
      get: {}
security:
  - OAuth: []
tags:
  - name: t1
    description: desc
    externalDocs:
      url: http://ext
      description: ext
externalDocs:
  url: http://ext
`;
    const docData = normalizeSpec(yamlStr);
    expect(docData).toBeDefined();
  });
});

  it("should cover empty components", () => {
    const yamlStr = `
openapi: 3.1.0
info:
  title: API
components: {}
`;
    expect(normalizeSpec(yamlStr)).toBeDefined();
  });

  it("should cover empty tags and security", () => {
    const yamlStr = `
openapi: 3.1.0
info:
  title: API
tags:
  - {}
security:
  - {}
`;
    expect(normalizeSpec(yamlStr)).toBeDefined();
  });

  it("should cover empty security scheme and flow", () => {
    const yamlStr = `
openapi: 3.1.0
info:
  title: API
components:
  securitySchemes:
    S1:
      type: invalid_type
      in: invalid_in
    S2:
      type: apiKey
      flows:
        implicit: {}
`;
    expect(normalizeSpec(yamlStr)).toBeDefined();
  });

describe("mapSdkExamples branches", () => {
  it("should handle empty paths and missing operations", () => {
    const docData: any = { spec: {} };
    mapSdkExamples(docData, []);
    docData.spec.paths = {
      "/r": { $ref: "#/comp" }
    };
    mapSdkExamples(docData, []);
  });

  it("should map all method types", () => {
    const docData: any = {
      spec: {
        paths: {
          "/all": {
            get: { operationId: "get" },
            put: { operationId: "put" },
            post: { operationId: "post" },
            delete: { operationId: "delete" },
            options: { operationId: "options" },
            head: { operationId: "head" },
            patch: { operationId: "patch" },
            trace: { operationId: "trace" }
          }
        }
      },
      codeExamples: {
        "get": [] // pre-existing to hit line 518 branch
      }
    };
    mapSdkExamples(docData, [
      { language: "x", filepath: "get", content: "x" },
      { language: "x", filepath: "put", content: "x" },
      { language: "x", filepath: "post", content: "x" },
      { language: "x", filepath: "delete", content: "x" },
      { language: "x", filepath: "options", content: "x" },
      { language: "x", filepath: "head", content: "x" },
      { language: "x", filepath: "patch", content: "x" },
      { language: "x", filepath: "trace", content: "x" },
      { language: "x", filepath: "unmatched", content: "x" }
    ]);
    expect(docData.codeExamples.get.length).toBe(2);
    expect(docData.codeExamples.trace.length).toBe(1);
  });

  it("should handle operations missing operationId in fallback", () => {
    const docData: any = {
      spec: { paths: { "/no": { get: {} } } },
      codeExamples: {}
    };
    mapSdkExamples(docData, [
      { language: "x", filepath: "unmatched", content: "x" }
    ]);
    expect(docData.codeExamples["get-/no"].length).toBe(1);
  });

  it("should match by route slug and method if operationId is missing", () => {
    const docData: any = {
      spec: { paths: { "/users/{id}": { get: {} } } },
      codeExamples: {}
    };
    mapSdkExamples(docData, [
      { language: "x", filepath: "_users__id__get.ts", content: "x" }
    ]);
    expect(docData.codeExamples["get-/users/{id}"].length).toBe(1);
  });
});

  it("should cover missing fields in normalizeSpec", () => {
    const yamlStr = `
info:
  title: API
components:
  securitySchemes:
    S1:
      $ref: "#/comp"
`;
    expect(normalizeSpec(yamlStr)).toBeDefined();
  });
