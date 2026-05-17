import { describe, it, expect } from 'vitest';
import { normalizeSpec } from '../src/parser';
import { transformSwagger2ToOpenAPI3 } from '../src/swagger2';

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
        const doc: any = normalizeSpec(yamlStr);
        expect(doc.spec.openapi).toBe('3.2.0');
        expect(doc.spec.servers![0].url).toBe('https://api.example.com/v1');
        
        const paths: any = doc.spec.paths;
        expect(paths).toBeDefined();
        
        const getOp: any = paths!['/users'].get;
        expect(getOp?.parameters![0].name).toBe('limit');
        expect(getOp?.parameters![0].schema?.default).toBe(10);
        expect(getOp?.parameters![0].schema?.maximum).toBe(100);
        expect(getOp?.parameters![0].schema?.minimum).toBe(1);
        expect(getOp?.responses!['200']?.content!['application/json'].schema?.type).toBe('array');

        const postOp: any = paths!['/users'].post;
        expect(postOp?.requestBody?.content['application/json'].schema?.$ref).toBe('#/components/schemas/User');

        expect(doc.spec.components?.schemas?.User).toBeDefined();
    });

    it('should handle all oauth2 flows and basic auth in securityDefinitions', () => {
        const doc: any = normalizeSpec(`
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
        const sec = doc.spec.components?.securitySchemes as any;
        expect(sec.implicitOAuth.flows.implicit.authorizationUrl).toBe('http://auth');
        expect(sec.passwordOAuth.flows.password.tokenUrl).toBe('http://token');
        expect(sec.clientOAuth.flows.clientCredentials.tokenUrl).toBe('http://token');
        expect(sec.codeOAuth.flows.authorizationCode.tokenUrl).toBe('http://token');
        expect(sec.basicAuth.type).toBe('http');
        expect(sec.basicAuth.scheme).toBe('basic');
    });

    it('should transform formData to requestBody', () => {
        const doc: any = normalizeSpec(`
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
        const post = doc.spec.paths!['/upload'].post!;
        expect(post.requestBody?.content['multipart/form-data'].schema.properties.file.format).toBe('binary');
        expect(post.requestBody?.content['multipart/form-data'].schema.required).toEqual(['file']);
    });

    it('should handle missing path parameters, produces, and missing host/schemes', () => {
        const doc: any = normalizeSpec(`
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
        expect(doc.spec.servers).toBeUndefined(); // defaults
        expect(doc.spec.paths!['/test'].get!.responses!['200']?.content!['application/json'].schema.type).toBe('string');
    });

    it('should handle array parameters and global parameters/responses', () => {
        const doc: any = normalizeSpec(`
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
paths:
  /test:
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
        expect(doc.spec.components?.parameters?.GlobalParam).toBeDefined();
        expect(doc.spec.components?.responses?.GlobalResp).toBeDefined();
        
        const get = doc.spec.paths!['/test'].get!;
        expect(get.parameters![0].schema.items.$ref).toBe('#/components/schemas/Missing');
        expect(get.responses!['200']?.$ref).toBe('#/components/responses/GlobalResp');
    });

    it('should return immediately if not swagger 2.0', () => {
        const parsed = { openapi: '3.2.0' };
        transformSwagger2ToOpenAPI3(parsed);
        expect(parsed.openapi).toBe('3.2.0');
    });
});
    it('should cover fallback branches for swagger2', () => {
        const yamlStr = `
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
`;
        const result = normalizeSpec(yamlStr);
        expect((result.spec as any).servers[0].url).toBe('https://localhost/api');
    });
    it('should cover fallback branches for swagger2 - host only', () => {
        const yamlStr = `
swagger: "2.0"
info:
  title: Test
  version: 1.0.0
host: example.com
`;
        const result = normalizeSpec(yamlStr);
        expect((result.spec as any).servers[0].url).toBe('https://example.com');
    });
