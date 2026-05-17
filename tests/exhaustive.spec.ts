import { describe, it, expect } from 'vitest';
import { normalizeSpec } from '../src/parser';
import { testYaml } from './test-yaml';

describe('exhaustive parser test', () => {
    it('should parse full OpenAPI 3.2.0 spec completely', () => {
        const yamlStr = testYaml;
        const result: any = normalizeSpec(yamlStr);

        const spec: any = result.spec;
        expect((spec as any).openapi).toBe('3.2.0');
        expect((spec as any).jsonSchemaDialect).toBe('https://json-schema.org/draft/2020-12/schema');
        expect((spec as any).info.title).toBe('Full API');
        expect((spec as any).info.contact?.name).toBe('API Support');
        expect((spec as any).info.license?.name).toBe('MIT');
        expect((spec as any).servers![0].variables!['port'].default).toBe('443');

        expect((spec as any).tags![0].name).toBe('pets');
        expect((spec as any).security![0]['petstore_auth']).toBeDefined();
        expect((spec as any).externalDocs?.url).toBe('https://example.com/docs');

        expect((spec as any).webhooks!['newPet']).toBeDefined();

        const paths: any = spec.paths;
        expect(paths).toBeDefined();

        const getOp: any = ((paths as any)['/pets'] as any).get;
        expect((getOp as any).operationId).toBe('listPets');
        expect((getOp as any).parameters?.[0].schema.maximum).toBe(100);
        expect((getOp as any).parameters?.[0].schema.xml.name).toBe('limit');
        expect((getOp as any).parameters?.[0].schema.discriminator).toBeUndefined();
        expect((getOp as any).parameters?.[1].$ref).toBe('#/components/parameters/OffsetParam');

        const reqBody = (getOp as any).requestBody;
        expect(reqBody.content['application/json'].schema.properties.name.maxLength).toBe(50);
        expect(reqBody.content['application/json'].schema.discriminator.propertyName).toBe('type');
        expect(reqBody.content['application/json'].examples.fido.summary).toBe('Fido example');
        expect(reqBody.content['application/json'].encoding.history.contentType).toBe('application/json');

        const response200 = (getOp as any).responses['200'];
        expect(response200.headers['x-next'].schema.type).toBe('string');
        expect(response200.content['application/json'].schema.type).toBe('array');
        expect(response200.links.PetById.operationId).toBe('getPetById');

        const cb = (getOp as any).callbacks.onData['{$request.query.callbackUrl}'];
        expect(cb.post.responses['200'].description).toBe('callback successfully processed');

        const comp = spec.components;
        expect(comp).toBeDefined();
        expect(comp!.schemas!['Pet']).toBeDefined();
        expect(comp!.responses!['ErrorResponse']).toBeDefined();
        expect(comp!.parameters!['OffsetParam']).toBeDefined();
        expect(comp!.examples!['CatExample']).toBeDefined();
        expect(comp!.requestBodies!['PetBody']).toBeDefined();
        expect((comp as any).headers?.['X-Rate-Limit-Limit']).toBeDefined();
        expect(comp!.securitySchemes!['petstore_auth']).toBeDefined();
        expect(comp!.links!['PetLink']).toBeDefined();
        expect(comp!.callbacks!['PetCallback']).toBeDefined();
        expect(comp!.pathItems!['NewPet']).toBeDefined();

        const secScheme: any = comp!.securitySchemes!['petstore_auth'];
        expect(secScheme.type).toBe('oauth2');
        expect(secScheme.flows.implicit.authorizationUrl).toBe('https://example.com/api/oauth/dialog');
        expect(secScheme.flows.password.tokenUrl).toBe('https://example.com/api/oauth/token');
        expect(secScheme.flows.clientCredentials.tokenUrl).toBe('https://example.com/api/oauth/token');
        expect(secScheme.flows.authorizationCode.authorizationUrl).toBe('https://example.com/api/oauth/dialog');

        const refPathItem = (spec as any).webhooks!['newPet'];
        expect((refPathItem as any).$ref).toBe('#/components/pathItems/NewPet');
    });
});
