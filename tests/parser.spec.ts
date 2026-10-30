/**
 * Unit tests for OpenAPI 3.2.0, Swagger 2.0, and Arazzo 1.1.0 parser and SDK example mapper (`src/parser.ts`).
 * @module parser.spec
 */
import { describe, it, expect } from 'vitest';
import {
    normalizeSpec,
    mapSdkExamples,
    isReference,
    isRecord,
    isSpecUrl,
    normalizeSpecUrl,
    dedentCodeString,
    expandStructuredCodeVariants,
    extractExamplesFromCddOutputRecord,
    decomposeFlatCodeString,
    isScaffoldingOrNonSnippetFile,
    extractOperationSnippetFromSdkFile,
    toJsonValue,
    parseInfo,
    parseServer,
    parseSchema,
    parseParameter,
    parseRequestBody,
    parseResponse,
    parsePathItem,
    parseSecurityScheme,
    parseComponents,
    parseReference,
    parseLicense,
    parseContact,
    parseServerVariable,
    parseExample,
    parseEncoding,
    parseHeader,
    parseMediaType,
    parseOAuthFlow,
    parseExternalDocs,
    parseCallback,
    parsePaths,
    parseTag,
    parseSecurityRequirement,
    parseLink,
    parseResponses,
    parseOperation,
} from '../src/parser';
import {
    DocData,
    CodeExample,
    PathItemObject,
    SchemaObject,
    ParameterObject,
    SecuritySchemeObject,
    ResponseObject,
    ExampleObject,
    HeaderObject,
    LinkObject,
    CallbackObject,
    RequestBodyObject,
    ReferenceObject,
    MediaTypeObject,
} from '../src/types';

/**
 * Asserts that a parsed OpenAPI object is not a ReferenceObject and narrows its type.
 * @param val The object or reference to narrow.
 * @returns The narrowed non-reference object.
 */
function assertNotRef<T extends object>(val: T | ReferenceObject | undefined): T {
    if (!val || isReference(val)) {
        throw new Error('Expected non-reference object');
    }
    return val;
}

describe('isRecord and toJsonValue helpers', () => {
    it('should narrow records and coerce unknown values into JsonValue', () => {
        expect(isRecord({})).toBe(true);
        expect(isRecord(null)).toBe(false);
        expect(isRecord([])).toBe(false);
        expect(isRecord('str')).toBe(false);

        expect(toJsonValue(null)).toBeNull();
        expect(toJsonValue('hello')).toBe('hello');
        expect(toJsonValue(42)).toBe(42);
        expect(toJsonValue(true)).toBe(true);
        expect(toJsonValue([1, 'two', { a: false, skip: undefined }])).toEqual([1, 'two', { a: false }]);
        expect(toJsonValue(Symbol('sym'))).toBe('Symbol(sym)');
    });
});

describe('parser edge cases', () => {
    it('should throw on missing info object', () => {
        expect(() => parseInfo(null)).toThrow('Missing info object');
        expect(() => parseInfo(undefined)).toThrow('Missing info object');
    });

    it('should handle empty or partial info, contact, license, server, reference', () => {
        const info = parseInfo({});
        expect(info.title).toBe('');
        expect(info.version).toBe('');

        expect(parseContact(null)).toEqual({
            name: undefined,
            url: undefined,
            email: undefined,
        });
        expect(parseContact({ url: '' })).toEqual({
            name: undefined,
            url: undefined,
            email: undefined,
        });

        expect(parseLicense(null)).toEqual({
            name: '',
            identifier: undefined,
            url: undefined,
        });
        expect(parseLicense({ name: 'Apache', identifier: 'Apache-2.0', url: 'https://apache' })).toEqual({
            name: 'Apache',
            identifier: 'Apache-2.0',
            url: 'https://apache',
        });

        expect(parseServerVariable(null)).toEqual({
            enum: undefined,
            default: '',
            description: undefined,
        });
        expect(parseServerVariable({ description: 'desc', enum: ['a', 'b'], default: 'a' })).toEqual({
            enum: ['a', 'b'],
            default: 'a',
            description: 'desc',
        });

        expect(parseServer(null)).toEqual({ url: '' });
        const s = parseServer({
            url: 'test',
            description: 'server desc',
            variables: { port: { default: '80' } },
        });
        expect(s.url).toBe('test');
        expect(s.description).toBe('server desc');
        expect(s.variables?.['port']?.default).toBe('80');

        expect(parseReference(null)).toEqual({
            $ref: '',
            summary: undefined,
            description: undefined,
        });
        expect(parseReference({ $ref: '#/a', summary: 's', description: 'd' })).toEqual({
            $ref: '#/a',
            summary: 's',
            description: 'd',
        });
    });

    it('should parse all schema properties and fallbacks cleanly', () => {
        expect(parseSchema(null)).toEqual({});
        const refSchema = parseSchema({ $ref: '#/components/schemas/Pet' });
        expect(isReference(refSchema)).toBe(true);

        const s = assertNotRef<SchemaObject>(
            parseSchema({
                title: 'MyTitle',
                type: 'string',
                format: 'email',
                description: 'desc',
                multipleOf: 2,
                maximum: 10,
                exclusiveMaximum: true,
                minimum: 1,
                exclusiveMinimum: true,
                maxLength: 50,
                minLength: 3,
                pattern: '^[a-z]+$',
                maxItems: 5,
                minItems: 1,
                uniqueItems: false,
                maxProperties: 10,
                minProperties: 1,
                required: ['a'],
                enum: ['a', 'b'],
                allOf: [{ type: 'string' }],
                oneOf: [{ type: 'number' }],
                anyOf: [{ type: 'boolean' }],
                not: { type: 'null' },
                items: { type: 'string' },
                properties: { a: { type: 'string' } },
                additionalProperties: true,
                default: 'def',
                nullable: true,
                readOnly: true,
                writeOnly: false,
                example: 'ex',
                deprecated: true,
                discriminator: { propertyName: 'type', mapping: { a: 'A' }, defaultMapping: 'A' },
                xml: {
                    name: 'test',
                    namespace: 'ns',
                    prefix: 'p',
                    attribute: true,
                    wrapped: false,
                    nodeType: 'element',
                },
                externalDocs: { url: 'https://docs' },
            }),
        );

        expect(s.title).toBe('MyTitle');
        expect(s.multipleOf).toBe(2);
        expect(s.maximum).toBe(10);
        expect(s.exclusiveMaximum).toBe(true);
        expect(s.minimum).toBe(1);
        expect(s.exclusiveMinimum).toBe(true);
        expect(s.maxLength).toBe(50);
        expect(s.minLength).toBe(3);
        expect(s.pattern).toBe('^[a-z]+$');
        expect(s.maxItems).toBe(5);
        expect(s.minItems).toBe(1);
        expect(s.uniqueItems).toBe(false);
        expect(s.maxProperties).toBe(10);
        expect(s.minProperties).toBe(1);
        expect(s.required).toEqual(['a']);
        expect(s.enum).toEqual(['a', 'b']);
        expect(s.allOf).toHaveLength(1);
        expect(s.oneOf).toHaveLength(1);
        expect(s.anyOf).toHaveLength(1);
        expect(s.not).toBeDefined();
        expect(s.items).toBeDefined();
        expect(s.additionalProperties).toBe(true);
        expect(s.default).toBe('def');
        expect(s.nullable).toBe(true);
        expect(s.readOnly).toBe(true);
        expect(s.writeOnly).toBe(false);
        expect(s.example).toBe('ex');
        expect(s.deprecated).toBe(true);
        expect(s.discriminator?.mapping?.['a']).toBe('A');
        expect(s.discriminator?.defaultMapping).toBe('A');
        expect(s.xml?.attribute).toBe(true);
        expect(s.xml?.wrapped).toBe(false);
        expect(s.xml?.nodeType).toBe('element');
        expect(s.externalDocs?.url).toBe('https://docs');

        const s2 = assertNotRef<SchemaObject>(
            parseSchema({
                additionalProperties: { type: 'string' },
                discriminator: {},
                xml: {},
            }),
        );
        expect(
            typeof s2.additionalProperties === 'object' && assertNotRef<SchemaObject>(s2.additionalProperties).type,
        ).toBe('string');
        expect(s2.discriminator?.propertyName).toBe('');
        expect(s2.xml?.name).toBeUndefined();
    });

    it('should parse example, header, encoding, mediaType, requestBody, parameter, link, response, callback', () => {
        expect(isReference(parseExample({ $ref: '#/ex' }))).toBe(true);
        expect(parseExample(null)).toEqual({
            summary: undefined,
            description: undefined,
            value: undefined,
            externalValue: undefined,
        });
        const ex = assertNotRef<ExampleObject>(
            parseExample({ summary: 's', description: 'd', value: 123, externalValue: 'http://ex' }),
        );
        expect(ex.value).toBe(123);

        expect(isReference(parseHeader({ $ref: '#/h' }))).toBe(true);
        expect(parseHeader(null)).toEqual({});
        const hdr = assertNotRef<HeaderObject>(
            parseHeader({
                description: 'desc',
                required: true,
                deprecated: false,
                schema: { type: 'string' },
                example: 'val',
            }),
        );
        expect(hdr.description).toBe('desc');
        expect(hdr.required).toBe(true);
        expect(hdr.deprecated).toBe(false);
        expect(hdr.example).toBe('val');

        expect(parseEncoding(null)).toEqual({});
        const enc = parseEncoding({
            contentType: 'text/plain',
            style: 'form',
            explode: false,
            allowReserved: true,
            headers: { 'X-H': { description: 'h' } },
            prefixEncoding: { p: { contentType: 'text/csv' } },
            itemEncoding: { i: { contentType: 'text/xml' } },
        });
        expect(enc.contentType).toBe('text/plain');
        expect(enc.explode).toBe(false);
        expect(enc.allowReserved).toBe(true);
        expect(enc.prefixEncoding?.['p']?.contentType).toBe('text/csv');
        expect(enc.itemEncoding?.['i']?.contentType).toBe('text/xml');

        expect(parseMediaType(null)).toEqual({});
        const mt = parseMediaType({
            schema: { type: 'string' },
            itemSchema: { type: 'number' },
            example: 'ex',
            examples: { e1: { value: 'v' } },
            encoding: { f: { contentType: 'text/plain' } },
            prefixEncoding: { p: { contentType: 'text/plain' } },
            itemEncoding: { i: { contentType: 'text/plain' } },
        });
        expect(mt.example).toBe('ex');
        expect(mt.itemSchema).toBeDefined();

        expect(isReference(parseRequestBody({ $ref: '#/rb' }))).toBe(true);
        expect(parseRequestBody(null)).toEqual({ content: {} });
        const rb = assertNotRef<RequestBodyObject>(
            parseRequestBody({
                description: 'rb',
                required: true,
                content: { 'application/json': { schema: { type: 'object' } } },
            }),
        );
        expect(rb.description).toBe('rb');
        expect(rb.required).toBe(true);

        expect(isReference(parseParameter({ $ref: '#/p' }))).toBe(true);
        const defaultParam = assertNotRef<ParameterObject>(parseParameter(null));
        expect(defaultParam.name).toBe('Unknown');
        expect(defaultParam.in).toBe('query');

        const fullParam = assertNotRef<ParameterObject>(
            parseParameter({
                name: 'p',
                in: 'cookie',
                description: 'd',
                required: true,
                deprecated: true,
                allowEmptyValue: true,
                style: 'form',
                explode: false,
                allowReserved: true,
                schema: { type: 'string' },
                example: 'e',
                examples: { ex: { value: 1 } },
                content: { 'text/plain': { schema: { type: 'string' } } },
            }),
        );
        expect(fullParam.in).toBe('cookie');
        expect(fullParam.allowEmptyValue).toBe(true);
        expect(fullParam.explode).toBe(false);
        expect(fullParam.allowReserved).toBe(true);

        expect(isReference(parseLink({ $ref: '#/l' }))).toBe(true);
        expect(parseLink(null)).toEqual({});
        const lnk = assertNotRef<LinkObject>(
            parseLink({
                operationRef: '#/op',
                operationId: 'opId',
                parameters: { id: '$response.body#/id' },
                requestBody: 'body',
                description: 'desc',
                server: { url: 'http://srv' },
            }),
        );
        expect(lnk.operationId).toBe('opId');
        expect(lnk.parameters?.['id']).toBe('$response.body#/id');

        expect(isReference(parseResponse({ $ref: '#/r' }))).toBe(true);
        expect(parseResponse(null)).toEqual({ description: '' });
        const resp = assertNotRef<ResponseObject>(
            parseResponse({
                description: 'ok',
                headers: { H: { description: 'h' } },
                content: { 'text/plain': {} },
                links: { L: { operationId: 'op' } },
            }),
        );
        expect(resp.description).toBe('ok');
        expect(resp.headers?.['H']).toBeDefined();
        expect(resp.links?.['L']).toBeDefined();

        expect(parseResponses(null)).toEqual({});
        const resps = parseResponses({
            default: { description: 'def' },
            '200': { description: 'ok' },
        });
        expect(assertNotRef<ResponseObject>(resps.default).description).toBe('def');
        expect(assertNotRef<ResponseObject>(resps['200']).description).toBe('ok');

        expect(isReference(parseCallback({ $ref: '#/cb' }))).toBe(true);
        expect(parseCallback(null)).toEqual({});
        const cb = assertNotRef<CallbackObject>(parseCallback({ 'http://url': { get: { operationId: 'test' } } }));
        expect(assertNotRef<PathItemObject>(cb['http://url']).get?.operationId).toBe('test');
    });

    it('should parse security requirement, operation, pathItem, paths, oauthFlow, securityScheme, components, tag', () => {
        expect(parseExternalDocs(null)).toEqual({ url: '', description: undefined });
        expect(parseSecurityRequirement(null)).toEqual({});
        const r = parseSecurityRequirement({ api_key: [], invalid: 'not-array' });
        expect(r['api_key']).toEqual([]);
        expect(r['invalid']).toEqual([]);

        expect(parseOperation(null)).toEqual({});
        const op = parseOperation({
            tags: ['t'],
            summary: 's',
            description: 'd',
            externalDocs: { url: 'u' },
            operationId: 'id',
            parameters: [{ name: 'p', in: 'header' }],
            requestBody: { content: {} },
            responses: { '200': { description: 'ok' } },
            callbacks: { cb: { '/x': {} } },
            deprecated: true,
            security: [{ a: ['b'] }],
            servers: [{ url: 'u' }],
        });
        expect(op.deprecated).toBe(true);
        expect(op.tags).toEqual(['t']);

        expect(isReference(parsePathItem({ $ref: '#/paths/x' }))).toBe(true);
        expect(parsePathItem(null)).toEqual({});
        expect(parsePaths(null)).toEqual({});
        expect(parsePaths({ invalid: {}, '/valid': { get: { operationId: 'v' } } })).toEqual({
            '/valid': { get: { operationId: 'v' } },
        });

        expect(parseOAuthFlow(null)).toEqual({ scopes: {} });
        const flow = parseOAuthFlow({
            authorizationUrl: 'url',
            tokenUrl: 'token',
            refreshUrl: 'refresh',
            deviceAuthorizationUrl: 'device',
            scopes: { a: 'a' },
        });
        expect(flow.authorizationUrl).toBe('url');
        expect(flow.tokenUrl).toBe('token');
        expect(flow.refreshUrl).toBe('refresh');
        expect(flow.deviceAuthorizationUrl).toBe('device');
        expect(flow.scopes['a']).toBe('a');

        expect(isReference(parseSecurityScheme({ $ref: '#/sec' }))).toBe(true);
        expect(parseSecurityScheme(null)).toEqual({ type: 'http' });
        const ss = assertNotRef<SecuritySchemeObject>(
            parseSecurityScheme({
                type: 'oauth2',
                description: 'd',
                name: 'n',
                in: 'cookie',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                openIdConnectUrl: 'http://oid',
                oauth2MetadataUrl: 'http://meta',
                flows: {
                    implicit: { authorizationUrl: 'url', scopes: { read: 'read' } },
                    password: { tokenUrl: 't' },
                    clientCredentials: { tokenUrl: 't' },
                    authorizationCode: { authorizationUrl: 'a', tokenUrl: 't' },
                    deviceAuthorization: { deviceAuthorizationUrl: 'd' },
                },
            }),
        );
        expect(ss.in).toBe('cookie');
        expect(ss.flows?.implicit?.scopes['read']).toBe('read');
        expect(ss.flows?.password?.tokenUrl).toBe('t');
        expect(ss.flows?.clientCredentials?.tokenUrl).toBe('t');
        expect(ss.flows?.authorizationCode?.authorizationUrl).toBe('a');
        expect(ss.flows?.deviceAuthorization?.deviceAuthorizationUrl).toBe('d');

        expect(parseComponents(null)).toEqual({});
        expect(parseTag(null)).toEqual({ name: 'Unknown' });
        const t = parseTag({
            name: 't',
            summary: 's',
            description: 'd',
            externalDocs: { url: 'u' },
            parent: 'p',
            kind: 'k',
        });
        expect(t.externalDocs?.url).toBe('u');
        expect(t.parent).toBe('p');
        expect(t.kind).toBe('k');
    });

    it('should handle mapSdkExamples with no paths', () => {
        const doc: DocData = {
            spec: { openapi: '3.2.0', info: { title: 'T', version: '1' } },
            codeExamples: {},
        };
        mapSdkExamples(doc, []);
        expect(doc.codeExamples).toEqual({});
    });

    it('should handle normalizeSpec missing jsonSchemaDialect and webhooks', () => {
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
        expect(doc.spec.webhooks?.['myHook']).toBeDefined();
    });
});

describe('parser', () => {
    it('should normalize valid openapi correctly', () => {
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
        expect(result.spec.info.title).toBe('Test API');
        expect(result.spec.info.version).toBe('1.0.1');
        const paths = result.spec.paths;
        expect(paths).toBeDefined();
        const usersPath = assertNotRef<PathItemObject>(paths?.['/users']);
        expect(usersPath.get?.operationId).toBe('getUsers');
        expect(usersPath.get?.parameters?.[0]).toBeDefined();
    });

    it('should handle empty or invalid spec gracefully', () => {
        expect(() => normalizeSpec('not-a-yaml-object')).toThrow('Invalid OpenAPI specification format');
        expect(() => normalizeSpec('{')).toThrow('Invalid OpenAPI specification format');
    });

    it('should handle spec without paths', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Empty API
`;
        const result = normalizeSpec(yamlStr);
        expect(result.spec.info.title).toBe('Empty API');
        expect(result.spec.paths).toBeUndefined();
    });

    it('should map SDK examples properly based on ID match', () => {
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
        const examples: CodeExample[] = [{ language: 'rust', filepath: 'getUsers.rs', content: 'fn get_users() {}' }];

        mapSdkExamples(docData, examples);
        expect(docData.codeExamples['getUsers']).toBeDefined();
        expect(docData.codeExamples['getUsers']?.[0]?.language).toBe('rust');
    });
});

describe('parser branches', () => {
    it('should parse parameters with examples and content', () => {
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
        const pathItem = assertNotRef<PathItemObject>(docData.spec.paths?.['/test']);
        const param = assertNotRef<ParameterObject>(pathItem.get?.parameters?.[0]);
        const ex1 = assertNotRef<ExampleObject>(param.examples?.['ex1']);
        expect(ex1.value).toBe('foo');
        const schema = assertNotRef<SchemaObject>(param.content?.['application/json']?.schema);
        expect(schema.type).toBe('string');
    });

    it('should ignore unrecognised sdk examples', () => {
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
        mapSdkExamples(docData, [{ language: 'rust', filepath: 'unmatched.rs', content: 'test' }]);
        expect(docData.codeExamples['myOperation']).toBeUndefined();
    });
});

describe('parser kitchen sink', () => {
    it('should parse an exhaustive openapi spec', () => {
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
        expect(docData.spec.jsonSchemaDialect).toBe('https://json-schema.org/draft/2020-12/schema');
        expect(docData.spec.components?.schemas?.['Sch']).toBeDefined();
        expect(docData.spec.components?.links?.['Lnk']).toBeDefined();
    });
});

describe('additional coverage cases', () => {
    it('should cover empty components, tags, security, and fallback openapi version', () => {
        const doc1 = normalizeSpec(`
info:
  title: API
components: {}
tags:
  - {}
security:
  - {}
`);
        expect(doc1.spec.openapi).toBe('3.2.0');
        expect(doc1.spec.components).toEqual({});
        expect(doc1.spec.tags?.[0]?.name).toBe('Unknown');
        expect(doc1.spec.security?.[0]).toEqual({});

        const doc2 = normalizeSpec(`
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
      in: query
      flows:
        implicit: {}
    S3:
      $ref: "#/comp"
`);
        const s1 = assertNotRef<SecuritySchemeObject>(doc2.spec.components?.securitySchemes?.['S1']);
        expect(s1.type).toBe('http');
        expect(s1.in).toBeUndefined();
        const s2 = assertNotRef<SecuritySchemeObject>(doc2.spec.components?.securitySchemes?.['S2']);
        expect(s2.type).toBe('apiKey');
        expect(s2.in).toBe('query');
        expect(isReference(doc2.spec.components?.securitySchemes?.['S3'])).toBe(true);
    });
});

describe('mapSdkExamples branches', () => {
    it('should handle empty paths and reference path items', () => {
        const docData: DocData = {
            spec: {
                openapi: '3.2.0',
                info: { title: 'T', version: '1' },
                paths: { '/r': { $ref: '#/comp' } },
            },
            codeExamples: {},
        };
        mapSdkExamples(docData, []);
        expect(docData.codeExamples).toEqual({});
    });

    it('should map all method types including query and additionalOperations', () => {
        const docData: DocData = {
            spec: {
                openapi: '3.2.0',
                info: { title: 'T', version: '1' },
                paths: {
                    '/all': {
                        get: { operationId: 'getOp' },
                        put: { operationId: 'putOp' },
                        post: { operationId: 'postOp' },
                        delete: { operationId: 'deleteOp' },
                        options: { operationId: 'optionsOp' },
                        head: { operationId: 'headOp' },
                        patch: { operationId: 'patchOp' },
                        trace: { operationId: 'traceOp' },
                        query: { operationId: 'queryOp' },
                        additionalOperations: {
                            COPY: { operationId: 'copyOp' },
                        },
                    },
                },
            },
            codeExamples: {
                getOp: [],
            },
        };
        mapSdkExamples(docData, [
            { language: 'x', filepath: 'getOp', content: 'x' },
            { language: 'x', filepath: 'putOp', content: 'x' },
            { language: 'x', filepath: 'postOp', content: 'x' },
            { language: 'x', filepath: 'deleteOp', content: 'x' },
            { language: 'x', filepath: 'optionsOp', content: 'x' },
            { language: 'x', filepath: 'headOp', content: 'x' },
            { language: 'x', filepath: 'patchOp', content: 'x' },
            { language: 'x', filepath: 'traceOp', content: 'x' },
            { language: 'x', filepath: 'queryOp', content: 'x' },
            { language: 'x', filepath: 'copyOp', content: 'x' },
            { language: 'x', filepath: 'unmatched', content: 'x' },
        ]);
        expect(docData.codeExamples['getOp']?.length).toBe(1);
        expect(docData.codeExamples['traceOp']?.length).toBe(1);
        expect(docData.codeExamples['queryOp']?.length).toBe(1);
        expect(docData.codeExamples['copyOp']?.length).toBe(1);
    });

    it('should match by route slug and method if operationId is missing', () => {
        const docData: DocData = {
            spec: {
                openapi: '3.2.0',
                info: { title: 'T', version: '1' },
                paths: { '/users/{id}': { get: {} } },
            },
            codeExamples: {},
        };
        mapSdkExamples(docData, [
            { language: 'x', filepath: '_users__id__get.ts', content: 'x' },
            { language: 'x', filepath: '_users__id__post.ts', content: 'x' },
        ]);
        expect(docData.codeExamples['get-/users/{id}']?.length).toBe(1);
    });

    it('should normalize standalone Arazzo specs, companion Arazzo specs, $self, webhooks, and map workflow examples', () => {
        const arazzoWithSelf = normalizeSpec(
            JSON.stringify({
                arazzo: '1.1.0',
                $self: 'https://example.com/arazzo.json',
                info: { title: 'Standalone Arazzo', version: '1.0.0' },
                sourceDescriptions: [{ name: 'api', url: './openapi.json', type: 'openapi' }],
                workflows: [{ workflowId: 'my-workflow', steps: [{ stepId: 's1' }] }],
            }),
        );
        expect(arazzoWithSelf.specKind).toBe('arazzo');
        expect(arazzoWithSelf.spec.$self).toBe('https://example.com/arazzo.json');

        // Map workflow examples when no OpenAPI operations exist
        delete arazzoWithSelf.workflowCodeExamples;
        mapSdkExamples(arazzoWithSelf, [
            { language: 'ts', filepath: 'workflow_my-workflow', content: 'code1' },
            { language: 'python', filepath: '_workflows_my_workflow', content: 'code2' },
            { language: 'go', filepath: 'unmatched_file', content: 'code3' },
        ]);
        expect(arazzoWithSelf.workflowCodeExamples?.['my-workflow']).toHaveLength(2);

        const arazzoNoSelf = normalizeSpec(
            JSON.stringify({
                arazzo: '1.1.0',
                info: { title: 'No Self Arazzo', version: '1.0.0' },
                sourceDescriptions: [],
                workflows: [{ workflowId: 'wf2', steps: [{ stepId: 's1' }] }],
            }),
        );
        expect(arazzoNoSelf.spec.$self).toBeUndefined();

        const combined = normalizeSpec(
            JSON.stringify({
                openapi: '3.2.0',
                $self: 'https://example.com/openapi.json',
                info: { title: 'Combined API', version: '1.0.0' },
                webhooks: {
                    orderHook: {
                        post: { operationId: 'onOrderHook', responses: {} },
                        put: { responses: {} },
                    },
                    refHook: { $ref: '#/components/pathItems/Ref' },
                },
            }),
            JSON.stringify({
                arazzo: '1.1.0',
                info: { title: 'Companion Arazzo', version: '1.0.0' },
                sourceDescriptions: [{ name: 'api', url: './openapi.json' }],
                workflows: [{ workflowId: 'orderWorkflow', steps: [{ stepId: 's1', operationId: 'onOrderHook' }] }],
            }),
        );
        expect(combined.specKind).toBe('combined');
        expect(combined.spec.$self).toBe('https://example.com/openapi.json');
        mapSdkExamples(combined, [
            { language: 'ts', filepath: 'onOrderHook.ts', content: 'whCode' },
            { language: 'ts', filepath: 'orderWorkflow.ts', content: 'wfCode' },
        ]);
        expect(combined.codeExamples['onOrderHook']).toHaveLength(1);
        expect(combined.workflowCodeExamples?.['orderWorkflow']).toHaveLength(1);
    });
});

describe('OpenAPI 3.2.0 extensions & path item details', () => {
    it('should parse servers and parameters in pathItem and OpenAPI 3.2.0 fields', () => {
        const doc = normalizeSpec(
            [
                'openapi: 3.2.0',
                'info:',
                '  title: Test',
                '  version: 1.0.0',
                '  summary: Info summary',
                'tags:',
                '  - name: testTag',
                '    summary: sum',
                '    parent: parent',
                '    kind: custom',
                'components:',
                '  mediaTypes:',
                '    myMediaType:',
                '      itemSchema: { type: string }',
                '      prefixEncoding:',
                '        myProp:',
                '          contentType: text/plain',
                '      itemEncoding:',
                '        myProp:',
                '          contentType: text/plain',
                '  securitySchemes:',
                '    myOAuth2:',
                '      type: oauth2',
                '      oauth2MetadataUrl: http://example.com/oauth2',
                '      flows:',
                '        deviceAuthorization:',
                '          deviceAuthorizationUrl: http://example.com/device',
                '          scopes:',
                '            read: Read access',
                '  schemas:',
                '    MySchema:',
                '      discriminator:',
                '        propertyName: kind',
                '        defaultMapping: kind1',
                '      xml:',
                '        nodeType: attribute',
                '  parameters:',
                '    myParam:',
                '      name: myParam',
                '      in: query',
                '      content:',
                '        text/plain:',
                '          encoding:',
                '            myProp:',
                '              prefixEncoding:',
                '                myProp:',
                '                  contentType: text/plain',
                '              itemEncoding:',
                '                myProp:',
                '                  contentType: text/plain',
                'paths:',
                '  /test:',
                '    summary: Path summary',
                '    description: Path desc',
                '    servers:',
                '      - url: https://path.server',
                '    parameters:',
                '      - name: id',
                '        in: query',
                '        example: 123',
                '    query:',
                '      operationId: queryOp',
                '    additionalOperations:',
                '      SUBSCRIBE:',
                '        operationId: subscribeOp',
            ].join('\n'),
        );
        expect(doc.spec.info.summary).toBe('Info summary');
        const testPath = assertNotRef<PathItemObject>(doc.spec.paths?.['/test']);
        expect(testPath.summary).toBe('Path summary');
        expect(testPath.description).toBe('Path desc');
        expect(testPath.servers?.[0]?.url).toBe('https://path.server');
        expect(assertNotRef<ParameterObject>(testPath.parameters?.[0]).example).toBe(123);
        expect(testPath.query?.operationId).toBe('queryOp');
        expect(testPath.additionalOperations?.['SUBSCRIBE']?.operationId).toBe('subscribeOp');
        const mediaType = assertNotRef<MediaTypeObject>(doc.spec.components?.mediaTypes?.['myMediaType']);
        expect(mediaType.prefixEncoding?.['myProp']?.contentType).toBe('text/plain');
    });

    it('should classify and normalize URLs, expand structured code variants, and avoid substring collisions in mapSdkExamples', () => {
        expect(isSpecUrl('')).toBe(false);
        expect(isSpecUrl('spec.yaml', () => true)).toBe(false);
        expect(isSpecUrl('https://example.com/spec.yaml')).toBe(true);
        expect(isSpecUrl('/cdd-gateway/storage/org/repo/schema.json')).toBe(true);
        expect(isSpecUrl('example.com/spec.yaml')).toBe(true);
        expect(isSpecUrl('openapi: 3.2.0\ninfo:\n  title: T')).toBe(false);
        expect(isSpecUrl('{"openapi": "3.2.0"}')).toBe(false);

        expect(normalizeSpecUrl('https://example.com/spec.yaml')).toBe('https://example.com/spec.yaml');
        expect(normalizeSpecUrl('/cdd-gateway/spec.json')).toBe('/cdd-gateway/spec.json');
        expect(normalizeSpecUrl('example.com/spec.yaml')).toBe('https://example.com/spec.yaml');

        expect(expandStructuredCodeVariants({}, 'python', 'empty_get')).toEqual([]);
        const singleVariant = expandStructuredCodeVariants({ snippet: 'print(1)' }, 'python', 'single_get');
        expect(singleVariant).toHaveLength(1);
        expect(singleVariant[0]?.includeImports).toBe(false);

        const wrapperEndOnly = expandStructuredCodeVariants(
            { snippet: 'print(1)', wrapperEnd: 'main()' },
            'python',
            'wrap_end_get',
        );
        expect(wrapperEndOnly).toHaveLength(4);

        const fourVariants = expandStructuredCodeVariants(
            {
                default: {
                    imports: 'import os',
                    wrapperStart: 'def main():',
                    snippet: '    print(1)',
                    wrapperEnd: 'main()',
                },
            },
            'python',
            'four_get',
            { operationId: 'opFour' },
        );
        expect(fourVariants).toHaveLength(4);
        expect(fourVariants[0]?.operationId).toBe('opFour');

        const extracted = extractExamplesFromCddOutputRecord(
            {
                endpoints: {
                    invalidMethods: 'not-a-record',
                    '/items': {
                        get: 'itemsGet()',
                        post: { imports: 'import a', snippet: 'itemsPost()' },
                        put: 123,
                    },
                },
                operations: {
                    invalidOp: 'not-a-record',
                    getPetById: {
                        operationId: 'getPetById',
                        path: '/pets/{id}',
                        method: 'GET',
                        code: {
                            imports: 'using System;',
                            wrapper_start: 'class Program {',
                            snippet: 'await client.GetPetByIdAsync(1);',
                            wrapper_end: '}',
                        },
                    },
                    listPets: {
                        code: 'await client.ListPetsAsync();',
                    },
                    badCodeOp: {
                        code: 123,
                    },
                    directFieldsOp: {
                        snippet: 'await client.DirectAsync();',
                    },
                },
                webhooks: {
                    hookA: {
                        post: 'hookPost()',
                    },
                },
                workflows: {
                    wf1: 'wf1Code()',
                    wf2: { imports: 'import b', snippet: 'wf2Code()' },
                    wf3: 123,
                },
            },
            'go',
        );
        expect(extracted.some(e => e.route === '/items' && e.method === 'get')).toBe(true);
        expect(extracted.filter(e => e.route === '/items' && e.method === 'post')).toHaveLength(4);
        expect(extracted.some(e => e.webhookName === 'hookA' && e.method === 'post')).toBe(true);
        expect(extracted.some(e => e.workflowId === 'wf1')).toBe(true);
        expect(extracted.filter(e => e.workflowId === 'wf2')).toHaveLength(4);

        // Test dedentCodeString and array-shaped operations, webhooks, workflows (cdd-cpp, cdd-csharp, cdd-go, cdd-swift)
        expect(dedentCodeString('\n  \n')).toBe('');
        expect(dedentCodeString('    int a = 1;\n\n    int b = 2;\n')).toBe('int a = 1;\n\nint b = 2;');

        const arrayExtracted = extractExamplesFromCddOutputRecord(
            {
                operations: [
                    'not-a-record',
                    {
                        method: 'GET',
                        path: '/pets',
                        operationId: 'listPets',
                        code: {
                            imports: '#include "client.hpp"',
                            wrapper_start: 'int main() {',
                            snippet: '    client.list_pets();\n\n    return 0;',
                            wrapper_end: '}',
                        },
                    },
                    {
                        method: '',
                        path: '',
                        operationId: '',
                        code: 'bareOp()',
                    },
                    {
                        method: 'WORKFLOW',
                        path: '',
                        operationId: '',
                        code: 'fallbackWf()',
                    },
                ],
                webhooks: [
                    'not-a-record',
                    {
                        method: 'POST',
                        path: '/newPet',
                        operationId: 'onNewPet',
                        webhookName: 'newPet',
                        code: 'handleNewPet();',
                    },
                    {
                        method: '',
                        path: '',
                        operationId: '',
                        code: 'anonWebhook();',
                    },
                ],
                workflows: [
                    'not-a-record',
                    { workflowId: 'arrWf1', code: 'runArrWf1();' },
                    { operationId: 'arrWf2', snippet: 'runArrWf2();' },
                    { code: 'missingWfId();' },
                ],
            },
            'cpp',
        );
        expect(
            arrayExtracted.find(
                e => e.operationId === 'listPets' && !e.includeImports && !e.includeWrapping,
            )?.content,
        ).toBe('client.list_pets();\n\nreturn 0;');
        expect(arrayExtracted.some(e => e.workflowId === 'workflow')).toBe(true);
        expect(arrayExtracted.some(e => e.webhookName === 'newPet' && e.method === 'post')).toBe(true);
        expect(arrayExtracted.some(e => e.workflowId === 'arrWf1')).toBe(true);
        expect(arrayExtracted.some(e => e.workflowId === 'arrWf2')).toBe(true);

        const recWfOps = extractExamplesFromCddOutputRecord(
            {
                operations: {
                    wfByMethod: {
                        operationId: 'wfOp1',
                        method: 'WORKFLOW',
                        code: 'wf1()',
                    },
                    wfByRoute: {
                        operationId: '',
                        path: '/workflows/wfRoute2',
                        code: 'wf2()',
                    },
                    wfFallback: {
                        operationId: '',
                        method: 'WORKFLOW',
                        code: 'wf3()',
                    },
                },
            },
            'csharp',
        );
        expect(recWfOps.some(e => e.workflowId === 'wfOp1')).toBe(true);
        expect(recWfOps.some(e => e.workflowId === 'wfRoute2')).toBe(true);
        expect(recWfOps.some(e => e.workflowId === 'workflow')).toBe(true);

        const overlapDoc = normalizeSpec(
            JSON.stringify({
                openapi: '3.2.0',
                info: { title: 'Overlap', version: '1.0.0' },
                paths: {
                    '/users': {
                        get: { operationId: 'get', responses: {} },
                    },
                    '/users/profile': {
                        get: { operationId: 'getUserProfile', responses: {} },
                    },
                },
                webhooks: {
                    userHook: {
                        post: { responses: {} },
                    },
                },
            }),
            JSON.stringify({
                arazzo: '1.1.0',
                info: { title: 'OverlapWf', version: '1.0.0' },
                sourceDescriptions: [{ name: 'api', url: './openapi.json' }],
                workflows: [
                    { workflowId: 'order', steps: [{ stepId: 's1' }] },
                    { workflowId: 'orderItem', steps: [{ stepId: 's2' }] },
                ],
            }),
        );

        mapSdkExamples(overlapDoc, [
            { language: 'ts', filepath: 'sdk_getUserProfile.ts', content: 'profile()' },
            { language: 'ts', filepath: 'explicit_op.ts', content: 'byOpId()', operationId: 'getUserProfile' },
            { language: 'ts', filepath: 'explicit_route.ts', content: 'users()', route: '/users', method: 'get' },
            {
                language: 'ts',
                filepath: 'explicit_wh.ts',
                content: 'wh()',
                webhookName: 'userHook',
                method: 'post',
            },
            {
                language: 'go',
                filepath: 'route_wh.go',
                content: 'goWh()',
                route: '/userHook',
                method: 'post',
            },
            {
                language: 'rust',
                filepath: 'missing_route.rs',
                content: 'noMatch()',
                route: '',
                method: 'post',
            },
            { language: 'ts', filepath: 'explicit_wf.ts', content: 'wfOrder()', workflowId: 'order' },
            { language: 'ts', filepath: 'explicit_wf_dup.ts', content: 'wfOrderDup()', workflowId: 'order' },
            { language: 'ts', filepath: 'workflow_orderItem.ts', content: 'wfOrderItem()' },
        ]);

        expect(overlapDoc.codeExamples['getUserProfile']?.[0]?.content).toBe('profile()');
        expect(overlapDoc.codeExamples['getUserProfile']).toHaveLength(1);
        expect(overlapDoc.codeExamples['get']?.[0]?.content).toBe('users()');
        expect(overlapDoc.codeExamples['webhook-post-userHook']?.[0]?.content).toBe('wh()');
        expect(overlapDoc.codeExamples['webhook-post-userHook']?.[1]?.content).toBe('goWh()');
        expect(overlapDoc.workflowCodeExamples?.['order']?.[0]?.content).toBe('wfOrder()');
        expect(overlapDoc.workflowCodeExamples?.['order']).toHaveLength(1);
        expect(overlapDoc.workflowCodeExamples?.['orderItem']?.[0]?.content).toBe('wfOrderItem()');
    });

    it('should decompose flat-string snippets across all languages into structured imports, wrapper_start, snippet, and wrapper_end', () => {
        expect(decomposeFlatCodeString('   ')).toEqual({ snippet: '' });

        // Python with imports + def main() + client init + if __name__ == "__main__"
        const pyDecomposed = decomposeFlatCodeString(
            [
                'import json',
                'from generated_client import Client',
                '',
                'def main():',
                '    client = Client(base_url="https://api.example.com")',
                '    response = client.list_pets()',
                '    print(response)',
                '',
                'if __name__ == "__main__":',
                '    main()',
            ].join('\n'),
        );
        expect(pyDecomposed['imports']).toContain('from generated_client import Client');
        expect(pyDecomposed['wrapper_start']).toContain('def main():');
        expect(pyDecomposed['wrapper_start']).toContain('client = Client');
        expect(pyDecomposed['snippet']).toBe('response = client.list_pets()\nprint(response)');
        expect(pyDecomposed['wrapper_end']).toContain('if __name__ == "__main__":');

        // Ruby with require + def main ... end + main if __FILE__ == $0
        const rbDecomposed = decomposeFlatCodeString(
            [
                "require 'json'",
                "require 'my_api_client'",
                '',
                'def main',
                "  client = MyApiClient.new('https://api.example.com')",
                '  response = client.list_pets',
                '  puts response.inspect',
                'end',
                '',
                'main if __FILE__ == $0',
            ].join('\n'),
        );
        expect(rbDecomposed['imports']).toContain("require 'my_api_client'");
        expect(rbDecomposed['wrapper_start']).toContain('def main');
        expect(rbDecomposed['snippet']).toBe('response = client.list_pets\nputs response.inspect');
        expect(rbDecomposed['wrapper_end']).toContain('main if __FILE__ == $0');

        // Shell with `. ./routes.sh` + `main() { ... }\nmain "$@"`
        const shDecomposed = decomposeFlatCodeString(
            ['. ./routes.sh', '', 'main() {', '  listPets "arg1"', '}', '', 'main "$@"'].join('\n'),
        );
        expect(shDecomposed['imports']).toBe('. ./routes.sh');
        expect(shDecomposed['wrapper_start']).toBe('main() {');
        expect(shDecomposed['snippet']).toBe('listPets "arg1"');
        expect(shDecomposed['wrapper_end']).toContain('main "$@"');

        // Go with `package main` + multi-line `import ( ... )` + `func main() { ... }`
        const goDecomposed = decomposeFlatCodeString(
            [
                'package main',
                '',
                'import (',
                '\t"fmt"',
                ')',
                '',
                'func main() {',
                '\tvar client = NewClient()',
                '\tres := client.ListPets()',
                '\tfmt.Println(res)',
                '}',
            ].join('\n'),
        );
        expect(goDecomposed['imports']).toContain('package main');
        expect(goDecomposed['imports']).toContain('"fmt"');
        expect(goDecomposed['wrapper_start']).toContain('func main() {');
        expect(goDecomposed['snippet']).toBe('res := client.ListPets()\nfmt.Println(res)');
        expect(goDecomposed['wrapper_end']).toBe('}');

        // C with `#include` + `int main(void)` + `struct HttpClient` + `api_init` + `api_cleanup` + `return CDD_C_SUCCESS;`
        const cDecomposed = decomposeFlatCodeString(
            [
                '#include "generated_client.h"',
                '#include <stdio.h>',
                '',
                'int main(void) {',
                '  struct HttpClient client;',
                '  api_init(&client, "https://api.example.com");',
                '  api_list_pets(&client);',
                '  api_cleanup(&client);',
                '  return CDD_C_SUCCESS;',
                '}',
            ].join('\n'),
        );
        expect(cDecomposed['imports']).toContain('#include "generated_client.h"');
        expect(cDecomposed['wrapper_start']).toContain('api_init');
        expect(cDecomposed['snippet']).toBe('api_list_pets(&client);');
        expect(cDecomposed['wrapper_end']).toContain('api_cleanup');

        // Java with `import` + `public class Example` + `public static void main` + `try { ... } catch (...) { ... }`
        const javaDecomposed = decomposeFlatCodeString(
            [
                'import my.api.ApiClient;',
                'import my.api.ApiException;',
                '',
                'public class Example {',
                '    public static void main(String[] args) {',
                '        try {',
                '            var client = new ApiClient();',
                '            client.listPets();',
                '        } catch (ApiException e) {',
                '            e.printStackTrace();',
                '        }',
                '    }',
                '}',
            ].join('\n'),
        );
        expect(javaDecomposed['imports']).toContain('import my.api.ApiClient;');
        expect(javaDecomposed['wrapper_start']).toContain('public static void main');
        expect(javaDecomposed['snippet']).toBe('client.listPets();');
        expect(javaDecomposed['wrapper_end']).toContain('catch (ApiException e)');

        // PHP / C# / Rust / Vue imports & wrappers
        const phpDecomposed = decomposeFlatCodeString(
            [
                '<?php',
                'declare(strict_types=1);',
                'namespace App\\Example;',
                'use App\\ApiClient;',
                "require_once 'vendor/autoload.php';",
                '$client = new ApiClient();',
            ].join('\n'),
        );
        expect(phpDecomposed['imports']).toContain('<?php');
        expect(phpDecomposed['imports']).toContain('use App\\ApiClient;');

        const csDecomposed = decomposeFlatCodeString(
            [
                'using System;',
                'public class Program {',
                '    public static async Task Main() {',
                '        await Run();',
                '    }',
                '}',
            ].join('\n'),
        );
        expect(csDecomposed['imports']).toBe('using System;');
        expect(csDecomposed['snippet']).toBe('await Run();');

        // Edge cases: Python def main without trailing main() or client init, Ruby def main without main if __FILE__ or client init, Shell main() without main "$@", Vue <script setup>, and non-wrapper 3-line block
        expect(decomposeFlatCodeString('def main():\n    do_work()\n    return 1')['snippet']).toBe(
            'do_work()\nreturn 1',
        );
        expect(decomposeFlatCodeString('def main\n  do_work\nend')['snippet']).toBe('do_work');
        expect(decomposeFlatCodeString('main() {\n  do_work\n}')['snippet']).toBe('do_work');
        expect(decomposeFlatCodeString('<script setup>\nconst a = 1;\nfetch("/x");\n</script>')['snippet']).toBe(
            'fetch("/x");',
        );
        expect(decomposeFlatCodeString('const a = 1;\nconst b = 2;\nconst c = 3;')['snippet']).toBe(
            'const a = 1;\nconst b = 2;\nconst c = 3;',
        );
    });

    it('should filter scaffolding/config files and extract concise snippets from raw multi-operation SDK files', () => {
        expect(isScaffoldingOrNonSnippetFile('Cargo.toml')).toBe(true);
        expect(isScaffoldingOrNonSnippetFile('src/models/pet.ts')).toBe(true);
        expect(isScaffoldingOrNonSnippetFile('.github/workflows/ci.yml')).toBe(true);
        expect(isScaffoldingOrNonSnippetFile('tests/api.spec.ts')).toBe(true);
        expect(isScaffoldingOrNonSnippetFile('test_client.py')).toBe(true);
        expect(isScaffoldingOrNonSnippetFile('client/api.ts')).toBe(false);
        expect(isScaffoldingOrNonSnippetFile('api.ts')).toBe(false);

        // Short file <= 25 lines returns as-is
        expect(extractOperationSnippetFromSdkFile('short()', 'listPets', '/pets', 'get')).toBe('short()');

        // Multi-line SDK file (> 25 lines) with matching operationId and fallback route/method match
        const longSdkContent = [
            '// SDK Client Header',
            ...Array.from({ length: 15 }, (_, i) => `// line ${i}`),
            'export async function list_pets(limit: number) {',
            '    const res = await fetch("/pets");',
            '    return res.json();',
            '}',
            ...Array.from({ length: 10 }, (_, i) => `// spacer ${i}`),
            'export async function handleOrdersRoute() {',
            '    const method = "POST";',
            '    return fetch("/orders", { method });',
            '}',
        ].join('\n');

        const byOpId = extractOperationSnippetFromSdkFile(longSdkContent, 'listPets', '/pets', 'get');
        expect(byOpId).toContain('export async function list_pets');
        expect(byOpId).not.toContain('handleOrdersRoute');

        const byRoute = extractOperationSnippetFromSdkFile(longSdkContent, 'nonExistentOp', '/orders', 'post');
        expect(byRoute).toContain('export async function handleOrdersRoute');

        const routeWrongMethod = extractOperationSnippetFromSdkFile(
            longSdkContent,
            'nonExistentOp',
            '/orders',
            'delete',
        );
        expect(routeWrongMethod).toBeNull();

        const noMatch = extractOperationSnippetFromSdkFile(longSdkContent, undefined, '/missing', 'delete');
        expect(noMatch).toBeNull();

        // Verify mapSdkExamples filters Cargo.toml and extracts snippets from raw SDK files
        const specDoc = normalizeSpec(
            JSON.stringify({
                openapi: '3.2.0',
                info: { title: 'SDK Slice API', version: '1.0.0' },
                paths: {
                    '/pets': {
                        get: { operationId: 'listPets', responses: {} },
                    },
                    '/orders': {
                        post: { operationId: 'createOrder', responses: {} },
                    },
                },
            }),
        );

        mapSdkExamples(specDoc, [
            { language: 'rust', filepath: 'Cargo.toml', content: '[package]\nname = "sdk"' },
            { language: 'ts', filepath: 'src/listPets.ts', content: longSdkContent },
            {
                language: 'ts',
                filepath: 'src/listPets_unsliced.ts',
                content: Array.from({ length: 30 }, () => '// comment').join('\n'),
            },
            { language: 'ts', filepath: 'src/sdk_client.ts', content: longSdkContent },
            { language: 'ts', filepath: 'src/sdk_client_second.ts', content: longSdkContent },
            {
                language: 'ts',
                filepath: 'src/unrelated_long.ts',
                content: Array.from({ length: 30 }, () => '// comment').join('\n'),
            },
        ]);

        expect(specDoc.codeExamples['listPets']?.[0]?.content).toContain('export async function list_pets');
        expect(specDoc.codeExamples['createOrder']?.[0]?.content).toContain('export async function handleOrdersRoute');
    });
});
