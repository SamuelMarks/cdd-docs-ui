/**
 * Swagger 2.0 to OpenAPI 3.2.0 In-Place Transformer.
 * @module swagger2
 */

import { STANDARD_HTTP_METHODS } from './openapi-types';
import { isRecord } from './parser';

/**
 * Recursively rewrites Swagger 2.0 `$ref` pointers (`#/definitions/`, `#/parameters/`, `#/responses/`, `#/securityDefinitions/`)
 * into OpenAPI 3.x `#/components/...` pointers.
 * @param obj The value or object tree to inspect and rewrite in-place.
 */
function fixRefs(obj: unknown): void {
    if (Array.isArray(obj)) {
        for (const item of obj) {
            fixRefs(item);
        }
        return;
    }
    if (!isRecord(obj)) return;
    if (typeof obj['$ref'] === 'string') {
        obj['$ref'] = obj['$ref']
            .replace('#/definitions/', '#/components/schemas/')
            .replace('#/parameters/', '#/components/parameters/')
            .replace('#/responses/', '#/components/responses/')
            .replace('#/securityDefinitions/', '#/components/securitySchemes/');
    }
    for (const key of Object.keys(obj)) {
        fixRefs(obj[key]);
    }
}

/**
 * Wraps Swagger 2.0 top-level parameter schema attributes (`type`, `format`, `items`, `default`, `enum`, `maximum`, `minimum`)
 * into an OpenAPI 3.x `schema` sub-object in-place.
 * @param rawParam The raw parameter record to upgrade.
 */
function upgradeSwagger2ParameterSchema(rawParam: Record<string, unknown>): void {
    if (rawParam['type'] === 'array' && isRecord(rawParam['items'])) {
        rawParam['schema'] = {
            type: 'array',
            items: rawParam['items'],
            collectionFormat: rawParam['collectionFormat'],
        };
    } else if (rawParam['type']) {
        const paramSchema: Record<string, unknown> = {
            type: rawParam['type'],
            format: rawParam['format'],
        };
        if (rawParam['default'] !== undefined) paramSchema['default'] = rawParam['default'];
        if (rawParam['enum'] !== undefined) paramSchema['enum'] = rawParam['enum'];
        if (rawParam['maximum'] !== undefined) paramSchema['maximum'] = rawParam['maximum'];
        if (rawParam['minimum'] !== undefined) paramSchema['minimum'] = rawParam['minimum'];
        rawParam['schema'] = paramSchema;
    }
}

/**
 * Wraps a Swagger 2.0 response `schema` into an OpenAPI 3.x `content` media type map in-place.
 * @param resp The raw response record to upgrade.
 * @param produces The list of media types produced.
 */
function upgradeSwagger2ResponseSchema(resp: Record<string, unknown>, produces: string[]): void {
    if (typeof resp['$ref'] === 'string') return;
    if (resp['schema']) {
        const contentMap: Record<string, unknown> = {};
        for (const p of produces) {
            contentMap[p] = { schema: resp['schema'] };
        }
        resp['content'] = contentMap;
        delete resp['schema'];
    }
}

/**
 * Transforms a parsed Swagger 2.0 object into an OpenAPI 3.2.0 compatible structure in-place.
 * It maps root properties like host, basePath, and schemes to servers.
 * It moves definitions, parameters, and responses to the components object.
 * It converts securityDefinitions to securitySchemes.
 * It also restructures form and body parameters into requestBody.
 *
 * @param parsed The raw record object parsed from YAML or JSON.
 */
export function transformSwagger2ToOpenAPI3(parsed: Record<string, unknown>): void {
    if (String(parsed['swagger']) !== '2.0') return;

    parsed['openapi'] = '3.2.0';

    if (parsed['host'] || parsed['basePath'] || parsed['schemes']) {
        const schemes = Array.isArray(parsed['schemes']) ? parsed['schemes'].map(String) : ['https'];
        const host = parsed['host'] ? String(parsed['host']) : 'localhost';
        const basePath = parsed['basePath'] ? String(parsed['basePath']) : '';
        parsed['servers'] = schemes.map((scheme: string) => ({
            url: `${scheme}://${host}${basePath}`,
        }));
    }

    const components: Record<string, unknown> = isRecord(parsed['components']) ? parsed['components'] : {};
    parsed['components'] = components;

    const globalConsumes = Array.isArray(parsed['consumes']) ? parsed['consumes'].map(String) : ['application/json'];
    const globalProduces = Array.isArray(parsed['produces']) ? parsed['produces'].map(String) : ['application/json'];

    if (parsed['definitions']) {
        components['schemas'] = parsed['definitions'];
        delete parsed['definitions'];
    }
    if (isRecord(parsed['parameters'])) {
        for (const paramVal of Object.values(parsed['parameters'])) {
            if (isRecord(paramVal)) {
                upgradeSwagger2ParameterSchema(paramVal);
            }
        }
        components['parameters'] = parsed['parameters'];
        delete parsed['parameters'];
    }
    if (isRecord(parsed['responses'])) {
        for (const respVal of Object.values(parsed['responses'])) {
            if (isRecord(respVal)) {
                upgradeSwagger2ResponseSchema(respVal, globalProduces);
            }
        }
        components['responses'] = parsed['responses'];
        delete parsed['responses'];
    }
    const secDefs = parsed['securityDefinitions'];
    if (isRecord(secDefs)) {
        for (const sd of Object.values(secDefs)) {
            if (!isRecord(sd)) continue;
            if (sd['type'] === 'oauth2') {
                const flows: Record<string, unknown> = {};
                const scopes = isRecord(sd['scopes']) ? sd['scopes'] : {};
                if (sd['flow'] === 'implicit') {
                    flows['implicit'] = { authorizationUrl: sd['authorizationUrl'], scopes };
                } else if (sd['flow'] === 'password') {
                    flows['password'] = { tokenUrl: sd['tokenUrl'], scopes };
                } else if (sd['flow'] === 'application') {
                    flows['clientCredentials'] = { tokenUrl: sd['tokenUrl'], scopes };
                } else if (sd['flow'] === 'accessCode') {
                    flows['authorizationCode'] = {
                        authorizationUrl: sd['authorizationUrl'],
                        tokenUrl: sd['tokenUrl'],
                        scopes,
                    };
                }
                sd['flows'] = flows;
                delete sd['flow'];
                delete sd['authorizationUrl'];
                delete sd['tokenUrl'];
                delete sd['scopes'];
            } else if (sd['type'] === 'basic') {
                sd['type'] = 'http';
                sd['scheme'] = 'basic';
            }
        }
        components['securitySchemes'] = secDefs;
        delete parsed['securityDefinitions'];
    }

    fixRefs(parsed);

    const paths = parsed['paths'];
    if (isRecord(paths)) {
        for (const [pathKey, pathItem] of Object.entries(paths)) {
            if (!isRecord(pathItem)) {
                delete paths[pathKey];
                continue;
            }
            if (Array.isArray(pathItem['parameters'])) {
                const pathParams: Record<string, unknown>[] = [];
                for (const rawParam of pathItem['parameters']) {
                    if (!isRecord(rawParam)) continue;
                    upgradeSwagger2ParameterSchema(rawParam);
                    pathParams.push(rawParam);
                }
                pathItem['parameters'] = pathParams;
            }
            for (const method of STANDARD_HTTP_METHODS) {
                const op = pathItem[method];
                if (!isRecord(op)) {
                    delete pathItem[method];
                    continue;
                }

                const consumes = Array.isArray(op['consumes']) ? op['consumes'].map(String) : globalConsumes;
                const produces = Array.isArray(op['produces']) ? op['produces'].map(String) : globalProduces;

                if (Array.isArray(op['parameters'])) {
                    const newParams: Record<string, unknown>[] = [];
                    let bodyParam: Record<string, unknown> | null = null;
                    const formParams: Record<string, unknown>[] = [];

                    for (const rawParam of op['parameters']) {
                        if (!isRecord(rawParam)) continue;
                        if (rawParam['in'] === 'body') {
                            bodyParam = rawParam;
                        } else if (rawParam['in'] === 'formData') {
                            formParams.push(rawParam);
                        } else {
                            upgradeSwagger2ParameterSchema(rawParam);
                            newParams.push(rawParam);
                        }
                    }
                    op['parameters'] = newParams;

                    if (bodyParam) {
                        const contentMap: Record<string, unknown> = {};
                        for (const c of consumes) {
                            contentMap[c] = { schema: bodyParam['schema'] };
                        }
                        op['requestBody'] = {
                            description: bodyParam['description'],
                            required: bodyParam['required'],
                            content: contentMap,
                        };
                    } else if (formParams.length > 0) {
                        const properties: Record<string, unknown> = {};
                        const required: string[] = [];
                        for (const fp of formParams) {
                            const fpName = String(fp['name'] || '');
                            properties[fpName] =
                                fp['type'] === 'file'
                                    ? { type: 'string', format: 'binary' }
                                    : { type: fp['type'], format: fp['format'] };
                            if (fp['required']) required.push(fpName);
                        }
                        const schema: Record<string, unknown> = {
                            type: 'object',
                            properties,
                        };
                        if (required.length > 0) schema['required'] = required;

                        const contentMap: Record<string, unknown> = {};
                        const consumesToUse = Array.isArray(op['consumes'])
                            ? op['consumes'].map(String)
                            : ['application/x-www-form-urlencoded', 'multipart/form-data'];
                        for (const c of consumesToUse) {
                            contentMap[c] = { schema };
                        }
                        op['requestBody'] = {
                            content: contentMap,
                        };
                    }
                }

                const responses = op['responses'];
                if (isRecord(responses)) {
                    for (const resp of Object.values(responses)) {
                        if (!isRecord(resp)) continue;
                        upgradeSwagger2ResponseSchema(resp, produces);
                    }
                }
            }
        }
    }
}
