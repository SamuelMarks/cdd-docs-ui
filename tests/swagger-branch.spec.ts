/**
 * Unit tests for Swagger 2.0 edge-case branches (`src/swagger2.ts`).
 * @module swagger-branch.spec
 */
import { describe, it, expect } from 'vitest';
import { normalizeSpec, isReference } from '../src/parser';
import {
    PathItemObject,
    ParameterObject,
    SchemaObject,
    RequestBodyObject,
    ResponseObject,
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

describe('Swagger 2.0 branches', () => {
    it('should handle unhandled refs, invalid pathItem, and explicit consumes', () => {
        const doc = normalizeSpec(`
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
        const uploadPath = assertNotRef<PathItemObject>(doc.spec.paths?.['/upload']);
        const uploadReq = assertNotRef<RequestBodyObject>(uploadPath.post?.requestBody);
        const uploadSchema = assertNotRef<SchemaObject>(uploadReq.content['application/x-www-form-urlencoded']?.schema);
        expect(assertNotRef<SchemaObject>(uploadSchema.properties?.['file']).type).toBe('string');

        const headerParam = assertNotRef<ParameterObject>(uploadPath.post?.parameters?.[0]);
        expect(assertNotRef<SchemaObject>(headerParam.schema).type).toBe('array');

        const upload2Path = assertNotRef<PathItemObject>(doc.spec.paths?.['/upload2']);
        const upload2Req = assertNotRef<RequestBodyObject>(upload2Path.post?.requestBody);
        const upload2Schema = assertNotRef<SchemaObject>(upload2Req.content['multipart/form-data']?.schema);
        expect(assertNotRef<SchemaObject>(upload2Schema.properties?.['file2']).type).toBe('string');

        const unknownAuth = assertNotRef<SecuritySchemeObject>(doc.spec.components?.securitySchemes?.['unknownAuth']);
        expect(unknownAuth.type).toBe('apiKey');

        const oauthUnknownFlow = assertNotRef<SecuritySchemeObject>(
            doc.spec.components?.securitySchemes?.['oauthUnknownFlow'],
        );
        expect(oauthUnknownFlow.flows).toEqual({});
    });

    it('should recursively fix refs, including arrays', () => {
        const doc = normalizeSpec(`
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
        const testPath = assertNotRef<PathItemObject>(doc.spec.paths?.['/test']);
        const idParam = assertNotRef<ParameterObject>(testPath.get?.parameters?.[0]);
        expect(assertNotRef<SchemaObject>(idParam.schema).format).toBe('int32');

        const resp200 = assertNotRef<ResponseObject>(testPath.get?.responses?.['200']);
        const respSchema = assertNotRef<SchemaObject>(resp200.content?.['application/json']?.schema);
        const firstAllOf = respSchema.allOf?.[0];
        expect(isReference(firstAllOf) && firstAllOf.$ref).toBe('#/components/schemas/Pet');
    });
});
