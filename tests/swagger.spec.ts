/**
 * Unit tests for Swagger 2.0 to OpenAPI 3.2.0 transformation (`src/swagger2.ts`).
 * @module swagger.spec
 */
import { describe, it, expect } from 'vitest';
import { normalizeSpec, isReference } from '../src/parser';
import { transformSwagger2ToOpenAPI3 } from '../src/swagger2';
import {
    PathItemObject,
    ParameterObject,
    SchemaObject,
    ResponseObject,
    RequestBodyObject,
    SecuritySchemeObject,
    ReferenceObject,
} from '../src/types';

/**
 * Narrows a union with `ReferenceObject` to the target non-reference type.
 * @param val The value to narrow.
 * @returns The narrowed non-reference value.
 */
function assertNotRef<T extends object>(val: T | ReferenceObject | undefined): T {
    if (!val || isReference(val)) {
        throw new Error('Expected non-reference object');
    }
    return val;
}

describe('Swagger 2.0 parser', () => {
    it('should parse swagger 2.0 correctly', () => {
        const yamlStr = `
swagger: "2.0"
info:
  title: Swagger 2 API
  version: "1.0"
host: api.example.com
basePath: /v1
schemes:
  - https
consumes:
  - application/json
produces:
  - application/json
paths:
  /users:
    get:
      parameters:
        - name: limit
          in: query
          type: integer
          default: 10
          enum: [10, 20]
          maximum: 100
          minimum: 1
      responses:
        "200":
          description: OK
          schema:
            type: array
            items:
              $ref: '#/definitions/User'
    post:
      parameters:
        - name: user
          in: body
          required: true
          schema:
            $ref: '#/definitions/User'
      responses:
        "201":
          description: Created
definitions:
  User:
    type: object
    properties:
      id:
        type: integer
`;
        const doc = normalizeSpec(yamlStr);
        expect(doc.spec.openapi).toBe('3.2.0');
        expect(doc.spec.servers?.[0]?.url).toBe('https://api.example.com/v1');

        const paths = doc.spec.paths;
        expect(paths).toBeDefined();

        const usersPath = assertNotRef<PathItemObject>(paths?.['/users']);
        const getOp = usersPath.get;
        const limitParam = assertNotRef<ParameterObject>(getOp?.parameters?.[0]);
        expect(limitParam.name).toBe('limit');
        const limitSchema = assertNotRef<SchemaObject>(limitParam.schema);
        expect(limitSchema.default).toBe(10);
        expect(limitSchema.maximum).toBe(100);
        expect(limitSchema.minimum).toBe(1);

        const resp200 = assertNotRef<ResponseObject>(getOp?.responses?.['200']);
        const resp200Schema = assertNotRef<SchemaObject>(resp200.content?.['application/json']?.schema);
        expect(resp200Schema.type).toBe('array');

        const postOp = usersPath.post;
        const reqBody = assertNotRef<RequestBodyObject>(postOp?.requestBody);
        const bodySchema = reqBody.content['application/json']?.schema;
        expect(isReference(bodySchema) && bodySchema.$ref).toBe('#/components/schemas/User');

        expect(doc.spec.components?.schemas?.['User']).toBeDefined();
    });

    it('should handle all oauth2 flows and basic auth in securityDefinitions', () => {
        const doc = normalizeSpec(`
swagger: "2.0"
info:
  title: test
  version: 1
securityDefinitions:
  implicitOAuth:
    type: oauth2
    flow: implicit
    authorizationUrl: http://auth
    scopes:
      read: read
  passwordOAuth:
    type: oauth2
    flow: password
    tokenUrl: http://token
  clientOAuth:
    type: oauth2
    flow: application
    tokenUrl: http://token
  codeOAuth:
    type: oauth2
    flow: accessCode
    authorizationUrl: http://auth
    tokenUrl: http://token
  basicAuth:
    type: basic
`);
        const sec = doc.spec.components?.securitySchemes;
        expect(assertNotRef<SecuritySchemeObject>(sec?.['implicitOAuth']).flows?.implicit?.authorizationUrl).toBe(
            'http://auth',
        );
        expect(assertNotRef<SecuritySchemeObject>(sec?.['passwordOAuth']).flows?.password?.tokenUrl).toBe(
            'http://token',
        );
        expect(assertNotRef<SecuritySchemeObject>(sec?.['clientOAuth']).flows?.clientCredentials?.tokenUrl).toBe(
            'http://token',
        );
        expect(assertNotRef<SecuritySchemeObject>(sec?.['codeOAuth']).flows?.authorizationCode?.tokenUrl).toBe(
            'http://token',
        );
        const basic = assertNotRef<SecuritySchemeObject>(sec?.['basicAuth']);
        expect(basic.type).toBe('http');
        expect(basic.scheme).toBe('basic');
    });

    it('should transform formData to requestBody', () => {
        const doc = normalizeSpec(`
swagger: "2.0"
info:
  title: test
  version: 1
paths:
  /upload:
    post:
      consumes:
        - multipart/form-data
      parameters:
        - name: file
          in: formData
          type: file
          required: true
        - name: extra
          in: formData
          type: string
          required: false
      responses:
        "200":
          description: ok
`);
        const uploadPath = assertNotRef<PathItemObject>(doc.spec.paths?.['/upload']);
        const reqBody = assertNotRef<RequestBodyObject>(uploadPath.post?.requestBody);
        const formSchema = assertNotRef<SchemaObject>(reqBody.content['multipart/form-data']?.schema);
        const fileProp = assertNotRef<SchemaObject>(formSchema.properties?.['file']);
        expect(fileProp.format).toBe('binary');
        expect(formSchema.required).toEqual(['file']);
    });

    it('should handle missing path parameters, produces, and missing host/schemes', () => {
        const doc = normalizeSpec(`
swagger: "2.0"
info:
  title: test
  version: 1
paths:
  /test:
    get:
      responses:
        "200":
          description: ok
          schema:
            type: string
`);
        expect(doc.spec.servers).toBeUndefined();
        const testPath = assertNotRef<PathItemObject>(doc.spec.paths?.['/test']);
        const resp200 = assertNotRef<ResponseObject>(testPath.get?.responses?.['200']);
        expect(assertNotRef<SchemaObject>(resp200.content?.['application/json']?.schema).type).toBe('string');
    });

    it('should handle array parameters and global parameters/responses', () => {
        const doc = normalizeSpec(`
swagger: "2.0"
info:
  title: test
  version: 1
parameters:
  GlobalParam:
    name: glob
    in: query
    type: string
responses:
  GlobalResp:
    description: glob res
    schema:
      type: string
paths:
  /test:
    parameters:
      - name: pathShared
        in: header
        type: string
    get:
      parameters:
        - name: arr
          in: query
          type: array
          items:
            $ref: '#/definitions/Missing'
      responses:
        "200":
          $ref: '#/responses/GlobalResp'
`);
        const globalParam = assertNotRef<ParameterObject>(doc.spec.components?.parameters?.['GlobalParam']);
        expect(assertNotRef<SchemaObject>(globalParam.schema).type).toBe('string');
        const globalResp = assertNotRef<ResponseObject>(doc.spec.components?.responses?.['GlobalResp']);
        expect(assertNotRef<SchemaObject>(globalResp.content?.['application/json']?.schema).type).toBe('string');

        const testPath = assertNotRef<PathItemObject>(doc.spec.paths?.['/test']);
        const sharedParam = assertNotRef<ParameterObject>(testPath.parameters?.[0]);
        expect(assertNotRef<SchemaObject>(sharedParam.schema).type).toBe('string');
        const arrParam = assertNotRef<ParameterObject>(testPath.get?.parameters?.[0]);
        const arrSchema = assertNotRef<SchemaObject>(arrParam.schema);
        expect(isReference(arrSchema.items) && arrSchema.items.$ref).toBe('#/components/schemas/Missing');
        const resp200 = testPath.get?.responses?.['200'];
        expect(isReference(resp200) && resp200.$ref).toBe('#/components/responses/GlobalResp');
    });

    it('should return immediately if not swagger 2.0 and handle non-record elements gracefully', () => {
        const parsed: Record<string, unknown> = { openapi: '3.2.0' };
        transformSwagger2ToOpenAPI3(parsed);
        expect(parsed['openapi']).toBe('3.2.0');

        const swaggerWithEdgeCases: Record<string, unknown> = {
            swagger: '2.0',
            components: { existing: true },
            parameters: {
                invalidParam: null,
            },
            responses: {
                invalidGlobalResp: null,
            },
            securityDefinitions: {
                invalidEntry: null,
            },
            paths: {
                '/edge': {
                    parameters: [null, { name: 'p', in: 'query', type: 'integer' }],
                    get: {
                        parameters: [null, { in: 'formData', type: 'string' }],
                        responses: {
                            invalidResp: null,
                        },
                    },
                },
            },
        };
        transformSwagger2ToOpenAPI3(swaggerWithEdgeCases);
        expect(swaggerWithEdgeCases['openapi']).toBe('3.2.0');
    });

    it('should cover fallback branches for swagger2 (basePath only and host only)', () => {
        const result1 = normalizeSpec(`
swagger: "2.0"
info:
  title: Test
  version: 1.0.0
basePath: /api
securityDefinitions:
  oauth2:
    type: oauth2
    flow: implicit
    authorizationUrl: https://auth.example.com
paths:
  /empty:
  /not-object: 123
  /test:
    get:
      parameters:
        - name: p1
          in: query
          required: false
      responses:
        '200':
          description: ok
`);
        expect(result1.spec.servers?.[0]?.url).toBe('https://localhost/api');

        const result2 = normalizeSpec(`
swagger: "2.0"
info:
  title: Test
  version: 1.0.0
host: example.com
`);
        expect(result2.spec.servers?.[0]?.url).toBe('https://example.com');
    });
});
