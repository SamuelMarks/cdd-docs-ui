import { describe, it, expect } from 'vitest';
import { normalizeSpec } from '../src/parser';

describe('Swagger 2.0 branches', () => {
    it('should handle unhandled refs, invalid pathItem, and explicit consumes', () => {
        const doc: any = normalizeSpec(`
swagger: "2.0"
info:
  title: test
  version: 1
paths:
  /test: {}
  /test2:
    get: {}
  /upload:
    post:
      produces:
        - application/json
      consumes:
        - application/x-www-form-urlencoded
      parameters:
        - name: file
          in: formData
          type: string
        - name: missing
          in: header
          type: array
          items:
            type: string
      responses:
        "200": {}
  /upload2:
    post:
      parameters:
        - name: file2
          in: formData
          type: string
      responses:
        "200": {}
securityDefinitions:
  unknownAuth:
    type: apiKey
  oauthUnknownFlow:
    type: oauth2
    flow: unknown
`);
        expect(doc.spec.paths!['/upload'].post!.requestBody?.content['application/x-www-form-urlencoded'].schema.properties.file.type).toBe('string');
        expect(doc.spec.paths!['/upload'].post!.parameters![0].schema.type).toBe('array');
        expect(doc.spec.paths!['/upload2'].post!.requestBody?.content['multipart/form-data'].schema.properties.file2.type).toBe('string');
        expect((doc.spec.components?.securitySchemes as any).unknownAuth.type).toBe('apiKey');
        expect((doc.spec.components?.securitySchemes as any).oauthUnknownFlow.flows).toEqual({});
    });

    it('should recursively fix refs, including arrays', () => {
        const doc: any = normalizeSpec(`
swagger: "2.0"
info:
  title: test
  version: 1
paths:
  /test:
    get:
      parameters:
        - name: id
          in: query
          type: integer
          format: int32
      responses:
        "200":
          description: ok
          schema:
            allOf:
              - $ref: '#/definitions/Pet'
`);
        expect(doc.spec.paths!['/test'].get!.parameters![0].schema.format).toBe('int32');
        expect(doc.spec.paths!['/test'].get!.responses!['200']?.content!['application/json'].schema.allOf[0].$ref).toBe('#/components/schemas/Pet');
    });
});
