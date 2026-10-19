/**
 * Exhaustive OpenAPI 3.2.0 parser integration test suite.
 * @module exhaustive.spec
 */
import { describe, it, expect } from 'vitest';
import { normalizeSpec, isReference } from '../src/parser';
import {
    PathItemObject,
    ParameterObject,
    SchemaObject,
    RequestBodyObject,
    ResponseObject,
    ExampleObject,
    LinkObject,
    CallbackObject,
    HeaderObject,
    SecuritySchemeObject,
    ReferenceObject,
} from '../src/types';
import { testYaml } from './test-yaml';

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

describe('exhaustive parser test', () => {
    it('should parse full OpenAPI 3.2.0 spec completely', () => {
        const result = normalizeSpec(testYaml);
        const spec = result.spec;

        expect(spec.openapi).toBe('3.2.0');
        expect(spec.jsonSchemaDialect).toBe('https://json-schema.org/draft/2020-12/schema');
        expect(spec.info.title).toBe('Full API');
        expect(spec.info.contact?.name).toBe('API Support');
        expect(spec.info.license?.name).toBe('MIT');
        expect(spec.servers?.[0]?.variables?.['port']?.default).toBe('443');

        expect(spec.tags?.[0]?.name).toBe('pets');
        expect(spec.security?.[0]?.['petstore_auth']).toBeDefined();
        expect(spec.externalDocs?.url).toBe('https://example.com/docs');

        expect(spec.webhooks?.['newPet']).toBeDefined();

        const paths = spec.paths;
        expect(paths).toBeDefined();

        const petsPath = assertNotRef<PathItemObject>(paths?.['/pets']);
        const getOp = petsPath.get;
        expect(getOp?.operationId).toBe('listPets');

        const firstParam = assertNotRef<ParameterObject>(getOp?.parameters?.[0]);
        const firstParamSchema = assertNotRef<SchemaObject>(firstParam.schema);
        expect(firstParamSchema.maximum).toBe(100);
        expect(firstParamSchema.xml?.name).toBe('limit');
        expect(firstParamSchema.discriminator).toBeUndefined();

        const secondParam = getOp?.parameters?.[1];
        expect(isReference(secondParam) && secondParam.$ref).toBe('#/components/parameters/OffsetParam');

        const reqBody = assertNotRef<RequestBodyObject>(getOp?.requestBody);
        const jsonMedia = reqBody.content['application/json'];
        const reqSchema = assertNotRef<SchemaObject>(jsonMedia?.schema);
        const nameProp = assertNotRef<SchemaObject>(reqSchema.properties?.['name']);
        expect(nameProp.maxLength).toBe(50);
        expect(reqSchema.discriminator?.propertyName).toBe('type');

        const fidoEx = assertNotRef<ExampleObject>(jsonMedia?.examples?.['fido']);
        expect(fidoEx.summary).toBe('Fido example');
        expect(jsonMedia?.encoding?.['history']?.contentType).toBe('application/json');

        const response200 = assertNotRef<ResponseObject>(getOp?.responses?.['200']);
        const xNextHeader = assertNotRef<HeaderObject>(response200.headers?.['x-next']);
        expect(assertNotRef<SchemaObject>(xNextHeader.schema).type).toBe('string');
        expect(assertNotRef<SchemaObject>(response200.content?.['application/json']?.schema).type).toBe('array');
        expect(assertNotRef<LinkObject>(response200.links?.['PetById']).operationId).toBe('getPetById');

        const onDataCb = assertNotRef<CallbackObject>(getOp?.callbacks?.['onData']);
        const cbPathItem = assertNotRef<PathItemObject>(onDataCb['{$request.query.callbackUrl}']);
        const cbResp200 = assertNotRef<ResponseObject>(cbPathItem.post?.responses?.['200']);
        expect(cbResp200.description).toBe('callback successfully processed');

        const comp = spec.components;
        expect(comp).toBeDefined();
        expect(comp?.schemas?.['Pet']).toBeDefined();
        expect(comp?.responses?.['ErrorResponse']).toBeDefined();
        expect(comp?.parameters?.['OffsetParam']).toBeDefined();
        expect(comp?.examples?.['CatExample']).toBeDefined();
        expect(comp?.requestBodies?.['PetBody']).toBeDefined();
        expect(comp?.headers?.['X-Rate-Limit-Limit']).toBeDefined();
        expect(comp?.securitySchemes?.['petstore_auth']).toBeDefined();
        expect(comp?.links?.['PetLink']).toBeDefined();
        expect(comp?.callbacks?.['PetCallback']).toBeDefined();
        expect(comp?.pathItems?.['NewPet']).toBeDefined();

        const secScheme = assertNotRef<SecuritySchemeObject>(comp?.securitySchemes?.['petstore_auth']);
        expect(secScheme.type).toBe('oauth2');
        expect(secScheme.flows?.implicit?.authorizationUrl).toBe('https://example.com/api/oauth/dialog');
        expect(secScheme.flows?.password?.tokenUrl).toBe('https://example.com/api/oauth/token');
        expect(secScheme.flows?.clientCredentials?.tokenUrl).toBe('https://example.com/api/oauth/token');
        expect(secScheme.flows?.authorizationCode?.authorizationUrl).toBe('https://example.com/api/oauth/dialog');

        const refPathItem = spec.webhooks?.['newPet'];
        expect(isReference(refPathItem) && refPathItem.$ref).toBe('#/components/pathItems/NewPet');
    });
});
