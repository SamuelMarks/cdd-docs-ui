/**
 * Transforms a parsed Swagger 2.0 object into an OpenAPI 3.2.0 compatible structure in-place.
 * It maps root properties like host, basePath, and schemes to servers.
 * It moves definitions, parameters, and responses to the components object.
 * It converts securityDefinitions to securitySchemes.
 * It also restructures form and body parameters into requestBody.
 * 
 * @param parsed The raw object parsed from YAML or JSON
 */
export function transformSwagger2ToOpenAPI3(parsed: any): void {
    if (String(parsed.swagger) !== '2.0') return;

    parsed.openapi = '3.2.0';

    if (parsed.host || parsed.basePath || parsed.schemes) {
        const schemes = Array.isArray(parsed.schemes) ? parsed.schemes : ['https'];
        const host = parsed.host || 'localhost';
        const basePath = parsed.basePath || '';
        parsed.servers = schemes.map((scheme: string) => ({
            url: `${scheme}://${host}${basePath}`
        }));
    }

    parsed.components = parsed.components || {};
    
    if (parsed.definitions) {
        parsed.components.schemas = parsed.definitions;
        delete parsed.definitions;
    }
    if (parsed.parameters) {
        parsed.components.parameters = parsed.parameters;
        delete parsed.parameters;
    }
    if (parsed.responses) {
        parsed.components.responses = parsed.responses;
        delete parsed.responses;
    }
    if (parsed.securityDefinitions) {
        // Map security definitions like oauth2 implicit to OA3 format
        for (const [key, sd] of Object.entries(parsed.securityDefinitions) as any) {
            if (sd.type === 'oauth2') {
                const flows: any = {};
                if (sd.flow === 'implicit') {
                    flows.implicit = { authorizationUrl: sd.authorizationUrl, scopes: sd.scopes || {} };
                } else if (sd.flow === 'password') {
                    flows.password = { tokenUrl: sd.tokenUrl, scopes: sd.scopes || {} };
                } else if (sd.flow === 'application') {
                    flows.clientCredentials = { tokenUrl: sd.tokenUrl, scopes: sd.scopes || {} };
                } else if (sd.flow === 'accessCode') {
                    flows.authorizationCode = { authorizationUrl: sd.authorizationUrl, tokenUrl: sd.tokenUrl, scopes: sd.scopes || {} };
                }
                sd.flows = flows;
                delete sd.flow;
                delete sd.authorizationUrl;
                delete sd.tokenUrl;
                delete sd.scopes;
            } else if (sd.type === 'basic') {
                sd.type = 'http';
                sd.scheme = 'basic';
            }
        }
        parsed.components.securitySchemes = parsed.securityDefinitions;
        delete parsed.securityDefinitions;
    }

    const fixRefs = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        if (obj.$ref && typeof obj.$ref === 'string') {
            obj.$ref = obj.$ref
                .replace('#/definitions/', '#/components/schemas/')
                .replace('#/parameters/', '#/components/parameters/')
                .replace('#/responses/', '#/components/responses/')
                .replace('#/securityDefinitions/', '#/components/securitySchemes/');
        }
        for (const key of Object.keys(obj)) {
            fixRefs(obj[key]);
        }
    };
    fixRefs(parsed);

    const globalConsumes = Array.isArray(parsed.consumes) ? parsed.consumes : ['application/json'];
    const globalProduces = Array.isArray(parsed.produces) ? parsed.produces : ['application/json'];

    if (parsed.paths) {
        for (const [path, pathItem] of Object.entries(parsed.paths)) {
            if (!pathItem || typeof pathItem !== 'object') { delete parsed.paths[path]; continue; }
            for (const method of ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']) {
                const op = (pathItem as any)[method];
                if (!op || typeof op !== 'object') { delete (pathItem as any)[method]; continue; }

                const consumes = Array.isArray(op.consumes) ? op.consumes : globalConsumes;
                const produces = Array.isArray(op.produces) ? op.produces : globalProduces;

                if (Array.isArray(op.parameters)) {
                    const newParams: any[] = [];
                    let bodyParam: any = null;
                    const formParams: any[] = [];
                    
                    for (const p of op.parameters) {
                        if (p.in === 'body') {
                            bodyParam = p;
                        } else if (p.in === 'formData') {
                            formParams.push(p);
                        } else {
                            if (p.type === 'array' && p.items) {
                                p.schema = { type: 'array', items: p.items, collectionFormat: p.collectionFormat };
                                if (p.items.type) p.schema.items.type = p.items.type;
                                if (p.items.$ref) p.schema.items.$ref = p.items.$ref;
                            } else if (p.type) {
                                p.schema = { type: p.type, format: p.format };
                                if (p.default !== undefined) p.schema.default = p.default;
                                if (p.enum !== undefined) p.schema.enum = p.enum;
                                if (p.maximum !== undefined) p.schema.maximum = p.maximum;
                                if (p.minimum !== undefined) p.schema.minimum = p.minimum;
                            }
                            newParams.push(p);
                        }
                    }
                    op.parameters = newParams;

                    if (bodyParam) {
                        op.requestBody = {
                            description: bodyParam.description,
                            required: bodyParam.required,
                            content: {}
                        };
                        for (const c of consumes) {
                            op.requestBody.content[c] = { schema: bodyParam.schema };
                        }
                    } else if (formParams.length > 0) {
                        const schema: any = { type: 'object', properties: {} };
                        const required: string[] = [];
                        for (const fp of formParams) {
                            schema.properties[fp.name] = fp.type === 'file' 
                                ? { type: 'string', format: 'binary' } 
                                : { type: fp.type, format: fp.format };
                            if (fp.required) required.push(fp.name);
                        }
                        if (required.length > 0) schema.required = required;
                        
                        op.requestBody = {
                            content: {}
                        };
                        const consumesToUse = op.consumes ? op.consumes : ['application/x-www-form-urlencoded', 'multipart/form-data'];
                        for (const c of consumesToUse) {
                            op.requestBody.content[c] = { schema };
                        }
                    }
                }

                if (op.responses) {
                    for (const [code, resp] of Object.entries(op.responses)) {
                        if (!resp || typeof resp !== 'object' || (resp as any).$ref) continue;
                        const r = resp as any;
                        if (r.schema) {
                            r.content = {};
                            for (const p of produces) {
                                r.content[p] = { schema: r.schema };
                            }
                            delete r.schema;
                        }
                    }
                }
            }
        }
    }
}
