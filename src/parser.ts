import {
    DocData,
    CodeExample,
    OpenAPI320,
    InfoObject,
    ContactObject,
    LicenseObject,
    ServerObject,
    ServerVariableObject,
    PathsObject,
    PathItemObject,
    OperationObject,
    ParameterObject,
    RequestBodyObject,
    MediaTypeObject,
    ResponsesObject,
    ResponseObject,
    HeaderObject,
    LinkObject,
    CallbackObject,
    ExampleObject,
    ReferenceObject,
    EncodingObject,
    TagObject,
    ExternalDocumentationObject,
    SecurityRequirementObject,
    ComponentsObject,
    SchemaObject,
    DiscriminatorObject,
    XMLObject,
    SecuritySchemeObject,
    OAuthFlowsObject,
    OAuthFlowObject,
} from './types';
import yaml from 'js-yaml';

/**
 * Parses a raw info object into a normalized InfoObject.
 * @param obj The raw info object from the spec.
 * @returns A normalized InfoObject.
 * @throws {Error} If the info object is missing.
 */
export function parseInfo(obj: any): InfoObject {
    if (!obj) throw new Error('Missing info object');
    return {
        title: String(obj.title || ''),
        summary: obj.summary ? String(obj.summary) : undefined,
        description: obj.description ? String(obj.description) : undefined,
        termsOfService: obj.termsOfService ? String(obj.termsOfService) : undefined,
        contact: obj.contact ? parseContact(obj.contact) : undefined,
        license: obj.license ? parseLicense(obj.license) : undefined,
        version: String(obj.version || ''),
    };
}

/**
 * Parses a raw contact object into a normalized ContactObject.
 * @param obj The raw contact object from the spec.
 * @returns A normalized ContactObject.
 */
export function parseContact(obj: any): ContactObject {
    return {
        name: obj.name ? String(obj.name) : undefined,
        url: obj.url ? String(obj.url) : undefined,
        email: obj.email ? String(obj.email) : undefined,
    };
}

/**
 * Parses a raw license object into a normalized LicenseObject.
 * @param obj The raw license object from the spec.
 * @returns A normalized LicenseObject.
 */
export function parseLicense(obj: any): LicenseObject {
    return {
        name: String(obj.name || ''),
        identifier: obj.identifier ? String(obj.identifier) : undefined,
        url: obj.url ? String(obj.url) : undefined,
    };
}

/**
 * Parses a raw server variable object into a normalized ServerVariableObject.
 * @param obj The raw server variable object from the spec.
 * @returns A normalized ServerVariableObject.
 */
export function parseServerVariable(obj: any): ServerVariableObject {
    return {
        enum: Array.isArray(obj.enum) ? obj.enum.map(String) : undefined,
        default: String(obj.default || ''),
        description: obj.description ? String(obj.description) : undefined,
    };
}

/**
 * Parses a raw server object into a normalized ServerObject.
 * @param obj The raw server object from the spec.
 * @returns A normalized ServerObject.
 */
export function parseServer(obj: any): ServerObject {
    const server: ServerObject = {
        url: String(obj.url || ''),
    };
    if (obj.description) server.description = String(obj.description);
    if (obj.variables && typeof obj.variables === 'object') {
        server.variables = {};
        for (const [k, v] of Object.entries(obj.variables)) {
            server.variables[k] = parseServerVariable(v);
        }
    }
    return server;
}

/**
 * Parses a raw reference object into a normalized ReferenceObject.
 * @param obj The raw reference object from the spec.
 * @returns A normalized ReferenceObject.
 */
export function parseReference(obj: any): ReferenceObject {
    return {
        $ref: String(obj.$ref),
        summary: obj.summary ? String(obj.summary) : undefined,
        description: obj.description ? String(obj.description) : undefined,
    };
}

/**
 * Checks if an object is a ReferenceObject.
 * @param obj The object to check.
 * @returns True if the object has a $ref property.
 */
export function isReference(obj: any): obj is ReferenceObject {
    return obj && typeof obj.$ref === 'string';
}

/**
 * Parses a raw schema object into a normalized SchemaObject or ReferenceObject.
 * @param obj The raw schema object from the spec.
 * @returns A normalized SchemaObject or ReferenceObject.
 */
export function parseSchema(obj: any): SchemaObject | ReferenceObject {
    if (isReference(obj)) return parseReference(obj);

    const schema: SchemaObject = {};
    if (obj.type) schema.type = String(obj.type);
    if (obj.description) schema.description = String(obj.description);
    if (obj.format) schema.format = String(obj.format);
    if (obj.title) schema.title = String(obj.title);
    if (typeof obj.multipleOf === 'number') schema.multipleOf = obj.multipleOf;
    if (typeof obj.maximum === 'number') schema.maximum = obj.maximum;
    if (typeof obj.exclusiveMaximum === 'boolean') schema.exclusiveMaximum = obj.exclusiveMaximum;
    if (typeof obj.minimum === 'number') schema.minimum = obj.minimum;
    if (typeof obj.exclusiveMinimum === 'boolean') schema.exclusiveMinimum = obj.exclusiveMinimum;
    if (typeof obj.maxLength === 'number') schema.maxLength = obj.maxLength;
    if (typeof obj.minLength === 'number') schema.minLength = obj.minLength;
    if (obj.pattern) schema.pattern = String(obj.pattern);
    if (typeof obj.maxItems === 'number') schema.maxItems = obj.maxItems;
    if (typeof obj.minItems === 'number') schema.minItems = obj.minItems;
    if (typeof obj.uniqueItems === 'boolean') schema.uniqueItems = obj.uniqueItems;
    if (typeof obj.maxProperties === 'number') schema.maxProperties = obj.maxProperties;
    if (typeof obj.minProperties === 'number') schema.minProperties = obj.minProperties;
    if (Array.isArray(obj.required)) schema.required = obj.required.map(String);
    if (Array.isArray(obj.enum)) schema.enum = obj.enum;
    if (Array.isArray(obj.allOf)) schema.allOf = obj.allOf.map(parseSchema);
    if (Array.isArray(obj.oneOf)) schema.oneOf = obj.oneOf.map(parseSchema);
    if (Array.isArray(obj.anyOf)) schema.anyOf = obj.anyOf.map(parseSchema);
    if (obj.not) schema.not = parseSchema(obj.not);
    if (obj.items) schema.items = parseSchema(obj.items);
    if (obj.properties && typeof obj.properties === 'object') {
        schema.properties = {};
        for (const [k, v] of Object.entries(obj.properties)) {
            schema.properties[k] = parseSchema(v);
        }
    }
    if (obj.additionalProperties !== undefined) {
        schema.additionalProperties =
            typeof obj.additionalProperties === 'boolean'
                ? obj.additionalProperties
                : parseSchema(obj.additionalProperties);
    }
    if (obj.default !== undefined) schema.default = obj.default;
    if (typeof obj.nullable === 'boolean') schema.nullable = obj.nullable;
    if (typeof obj.readOnly === 'boolean') schema.readOnly = obj.readOnly;
    if (typeof obj.writeOnly === 'boolean') schema.writeOnly = obj.writeOnly;
    if (obj.example !== undefined) schema.example = obj.example;
    if (typeof obj.deprecated === 'boolean') schema.deprecated = obj.deprecated;

    if (obj.discriminator) {
        schema.discriminator = {
            propertyName: String(obj.discriminator.propertyName),
        };
        if (obj.discriminator.mapping && typeof obj.discriminator.mapping === 'object') {
            schema.discriminator.mapping = {};
            for (const [k, v] of Object.entries(obj.discriminator.mapping)) {
                schema.discriminator.mapping[k] = String(v);
            }
        }
        if (obj.discriminator.defaultMapping !== undefined) {
            schema.discriminator.defaultMapping = String(obj.discriminator.defaultMapping);
        }
    }
    if (obj.xml) {
        schema.xml = {
            name: obj.xml.name ? String(obj.xml.name) : undefined,
            namespace: obj.xml.namespace ? String(obj.xml.namespace) : undefined,
            prefix: obj.xml.prefix ? String(obj.xml.prefix) : undefined,
            attribute: typeof obj.xml.attribute === 'boolean' ? obj.xml.attribute : undefined,
            wrapped: typeof obj.xml.wrapped === 'boolean' ? obj.xml.wrapped : undefined,
            nodeType: obj.xml.nodeType ? String(obj.xml.nodeType) : undefined,
        };
    }
    if (obj.externalDocs) schema.externalDocs = parseExternalDocs(obj.externalDocs);

    return schema;
}

/**
 * Parses a raw example object into a normalized ExampleObject or ReferenceObject.
 * @param obj The raw example object from the spec.
 * @returns A normalized ExampleObject or ReferenceObject.
 */
export function parseExample(obj: any): ExampleObject | ReferenceObject {
    if (isReference(obj)) return parseReference(obj);
    return {
        summary: obj.summary ? String(obj.summary) : undefined,
        description: obj.description ? String(obj.description) : undefined,
        value: obj.value,
        externalValue: obj.externalValue ? String(obj.externalValue) : undefined,
    };
}

/**
 * Parses a raw header object into a normalized HeaderObject or ReferenceObject.
 * @param obj The raw header object from the spec.
 * @returns A normalized HeaderObject or ReferenceObject.
 */
export function parseHeader(obj: any): HeaderObject | ReferenceObject {
    if (isReference(obj)) return parseReference(obj);
    const header: HeaderObject = {};
    if (obj.description) header.description = String(obj.description);
    if (typeof obj.required === 'boolean') header.required = obj.required;
    if (typeof obj.deprecated === 'boolean') header.deprecated = obj.deprecated;
    if (obj.schema) header.schema = parseSchema(obj.schema);
    if (obj.example !== undefined) header.example = obj.example;
    return header;
}

/**
 * Parses a raw encoding object into a normalized EncodingObject.
 * @param obj The raw encoding object from the spec.
 * @returns A normalized EncodingObject.
 */
export function parseEncoding(obj: any): EncodingObject {
    const encoding: EncodingObject = {};
    if (obj.contentType) encoding.contentType = String(obj.contentType);
    if (obj.headers && typeof obj.headers === 'object') {
        encoding.headers = {};
        for (const [k, v] of Object.entries(obj.headers)) {
            encoding.headers[k] = parseHeader(v);
        }
    }
    if (obj.style) encoding.style = String(obj.style);
    if (typeof obj.explode === 'boolean') encoding.explode = obj.explode;
    if (typeof obj.allowReserved === 'boolean') encoding.allowReserved = obj.allowReserved;
    
    if (obj.prefixEncoding && typeof obj.prefixEncoding === 'object') {
        encoding.prefixEncoding = {};
        for (const [k, v] of Object.entries(obj.prefixEncoding)) {
            encoding.prefixEncoding[k] = parseEncoding(v);
        }
    }
    if (obj.itemEncoding && typeof obj.itemEncoding === 'object') {
        encoding.itemEncoding = {};
        for (const [k, v] of Object.entries(obj.itemEncoding)) {
            encoding.itemEncoding[k] = parseEncoding(v);
        }
    }
    
    return encoding;
}

/**
 * Parses a raw media type object into a normalized MediaTypeObject.
 * @param obj The raw media type object from the spec.
 * @returns A normalized MediaTypeObject.
 */
export function parseMediaType(obj: any): MediaTypeObject {
    const mt: MediaTypeObject = {};
    if (obj.schema) mt.schema = parseSchema(obj.schema);
    if (obj.itemSchema) mt.itemSchema = parseSchema(obj.itemSchema);
    if (obj.example !== undefined) mt.example = obj.example;
    if (obj.examples && typeof obj.examples === 'object') {
        mt.examples = {};
        for (const [k, v] of Object.entries(obj.examples)) {
            mt.examples[k] = parseExample(v);
        }
    }
    if (obj.encoding && typeof obj.encoding === 'object') {
        mt.encoding = {};
        for (const [k, v] of Object.entries(obj.encoding)) {
            mt.encoding[k] = parseEncoding(v);
        }
    }
    if (obj.prefixEncoding && typeof obj.prefixEncoding === 'object') {
        mt.prefixEncoding = {};
        for (const [k, v] of Object.entries(obj.prefixEncoding)) {
            mt.prefixEncoding[k] = parseEncoding(v);
        }
    }
    if (obj.itemEncoding && typeof obj.itemEncoding === 'object') {
        mt.itemEncoding = {};
        for (const [k, v] of Object.entries(obj.itemEncoding)) {
            mt.itemEncoding[k] = parseEncoding(v);
        }
    }
    return mt;
}

/**
 * Parses a raw request body object into a normalized RequestBodyObject or ReferenceObject.
 * @param obj The raw request body object from the spec.
 * @returns A normalized RequestBodyObject or ReferenceObject.
 */
export function parseRequestBody(obj: any): RequestBodyObject | ReferenceObject {
    if (isReference(obj)) return parseReference(obj);
    const rb: RequestBodyObject = { content: {} };
    if (obj.description) rb.description = String(obj.description);
    if (typeof obj.required === 'boolean') rb.required = obj.required;
    if (obj.content && typeof obj.content === 'object') {
        for (const [k, v] of Object.entries(obj.content)) {
            rb.content[k] = parseMediaType(v);
        }
    }
    return rb;
}

/**
 * Parses a raw parameter object into a normalized ParameterObject or ReferenceObject.
 * @param obj The raw parameter object from the spec.
 * @returns A normalized ParameterObject or ReferenceObject.
 */
export function parseParameter(obj: any): ParameterObject | ReferenceObject {
    if (isReference(obj)) return parseReference(obj);
    const param: ParameterObject = {
        name: String(obj.name || 'Unknown'),
        in: obj.in === 'query' || obj.in === 'header' || obj.in === 'path' || obj.in === 'cookie' ? obj.in : 'query',
    };
    if (obj.description) param.description = String(obj.description);
    if (typeof obj.required === 'boolean') param.required = obj.required;
    if (typeof obj.deprecated === 'boolean') param.deprecated = obj.deprecated;
    if (typeof obj.allowEmptyValue === 'boolean') param.allowEmptyValue = obj.allowEmptyValue;
    if (obj.style) param.style = String(obj.style);
    if (typeof obj.explode === 'boolean') param.explode = obj.explode;
    if (typeof obj.allowReserved === 'boolean') param.allowReserved = obj.allowReserved;
    if (obj.schema) param.schema = parseSchema(obj.schema);
    if (obj.example !== undefined) param.example = obj.example;
    if (obj.examples && typeof obj.examples === 'object') {
        param.examples = {};
        for (const [k, v] of Object.entries(obj.examples)) {
            param.examples[k] = parseExample(v);
        }
    }
    if (obj.content && typeof obj.content === 'object') {
        param.content = {};
        for (const [k, v] of Object.entries(obj.content)) {
            param.content[k] = parseMediaType(v);
        }
    }
    return param;
}

/**
 * Parses a raw link object into a normalized LinkObject or ReferenceObject.
 * @param obj The raw link object from the spec.
 * @returns A normalized LinkObject or ReferenceObject.
 */
export function parseLink(obj: any): LinkObject | ReferenceObject {
    if (isReference(obj)) return parseReference(obj);
    const link: LinkObject = {};
    if (obj.operationRef) link.operationRef = String(obj.operationRef);
    if (obj.operationId) link.operationId = String(obj.operationId);
    if (obj.parameters) link.parameters = { ...obj.parameters };
    if (obj.requestBody !== undefined) link.requestBody = obj.requestBody;
    if (obj.description) link.description = String(obj.description);
    if (obj.server) link.server = parseServer(obj.server);
    return link;
}

/**
 * Parses a raw response object into a normalized ResponseObject or ReferenceObject.
 * @param obj The raw response object from the spec.
 * @returns A normalized ResponseObject or ReferenceObject.
 */
export function parseResponse(obj: any): ResponseObject | ReferenceObject {
    if (isReference(obj)) return parseReference(obj);
    const resp: ResponseObject = {
        description: String(obj.description || ''),
    };
    if (obj.headers && typeof obj.headers === 'object') {
        resp.headers = {};
        for (const [k, v] of Object.entries(obj.headers)) {
            resp.headers[k] = parseHeader(v);
        }
    }
    if (obj.content && typeof obj.content === 'object') {
        resp.content = {};
        for (const [k, v] of Object.entries(obj.content)) {
            resp.content[k] = parseMediaType(v);
        }
    }
    if (obj.links && typeof obj.links === 'object') {
        resp.links = {};
        for (const [k, v] of Object.entries(obj.links)) {
            resp.links[k] = parseLink(v);
        }
    }
    return resp;
}

/**
 * Parses a raw responses object into a normalized ResponsesObject.
 * @param obj The raw responses object from the spec.
 * @returns A normalized ResponsesObject.
 */
export function parseResponses(obj: any): ResponsesObject {
    const responses: ResponsesObject = {};
    for (const [k, v] of Object.entries(obj)) {
        if (k === 'default') {
            responses.default = parseResponse(v);
        } else {
            responses[k] = parseResponse(v);
        }
    }
    return responses;
}

/**
 * Parses a raw callback object into a normalized CallbackObject or ReferenceObject.
 * @param obj The raw callback object from the spec.
 * @returns A normalized CallbackObject or ReferenceObject.
 */
export function parseCallback(obj: any): CallbackObject | ReferenceObject {
    if (isReference(obj)) return parseReference(obj);
    const cb: CallbackObject = {};
    for (const [k, v] of Object.entries(obj)) {
        cb[k] = parsePathItem(v);
    }
    return cb;
}

/**
 * Parses a raw external documentation object into a normalized ExternalDocumentationObject.
 * @param obj The raw external documentation object from the spec.
 * @returns A normalized ExternalDocumentationObject.
 */
export function parseExternalDocs(obj: any): ExternalDocumentationObject {
    return {
        url: String(obj.url || ''),
        description: obj.description ? String(obj.description) : undefined,
    };
}

/**
 * Parses a raw security requirement object into a normalized SecurityRequirementObject.
 * @param obj The raw security requirement object from the spec.
 * @returns A normalized SecurityRequirementObject.
 */
export function parseSecurityRequirement(obj: any): SecurityRequirementObject {
    const req: SecurityRequirementObject = {};
    for (const [k, v] of Object.entries(obj)) {
        req[k] = Array.isArray(v) ? v.map(String) : [];
    }
    return req;
}

/**
 * Parses a raw operation object into a normalized OperationObject.
 * @param obj The raw operation object from the spec.
 * @returns A normalized OperationObject.
 */
export function parseOperation(obj: any): OperationObject {
    const op: OperationObject = {};
    if (Array.isArray(obj.tags)) op.tags = obj.tags.map(String);
    if (obj.summary) op.summary = String(obj.summary);
    if (obj.description) op.description = String(obj.description);
    if (obj.externalDocs) op.externalDocs = parseExternalDocs(obj.externalDocs);
    if (obj.operationId) op.operationId = String(obj.operationId);
    if (Array.isArray(obj.parameters)) op.parameters = obj.parameters.map(parseParameter);
    if (obj.requestBody) op.requestBody = parseRequestBody(obj.requestBody);
    if (obj.responses) op.responses = parseResponses(obj.responses);
    if (obj.callbacks && typeof obj.callbacks === 'object') {
        op.callbacks = {};
        for (const [k, v] of Object.entries(obj.callbacks)) {
            op.callbacks[k] = parseCallback(v);
        }
    }
    if (typeof obj.deprecated === 'boolean') op.deprecated = obj.deprecated;
    if (Array.isArray(obj.security)) op.security = obj.security.map(parseSecurityRequirement);
    if (Array.isArray(obj.servers)) op.servers = obj.servers.map(parseServer);
    return op;
}

/**
 * Parses a raw path item object into a normalized PathItemObject or ReferenceObject.
 * @param obj The raw path item object from the spec.
 * @returns A normalized PathItemObject or ReferenceObject.
 */
export function parsePathItem(obj: any): PathItemObject | ReferenceObject {
    if (isReference(obj)) return parseReference(obj);
    const item: PathItemObject = {};
    if (obj.summary) item.summary = String(obj.summary);
    if (obj.description) item.description = String(obj.description);
    if (obj.get) item.get = parseOperation(obj.get);
    if (obj.put) item.put = parseOperation(obj.put);
    if (obj.post) item.post = parseOperation(obj.post);
    if (obj.delete) item.delete = parseOperation(obj.delete);
    if (obj.options) item.options = parseOperation(obj.options);
    if (obj.head) item.head = parseOperation(obj.head);
    if (obj.patch) item.patch = parseOperation(obj.patch);
    if (obj.trace) item.trace = parseOperation(obj.trace);
    if (obj.query) item.query = parseOperation(obj.query);
    if (obj.additionalOperations && typeof obj.additionalOperations === 'object') {
        item.additionalOperations = {};
        for (const [k, v] of Object.entries(obj.additionalOperations)) {
            item.additionalOperations[k] = parseOperation(v);
        }
    }
    if (Array.isArray(obj.servers)) item.servers = obj.servers.map(parseServer);
    if (Array.isArray(obj.parameters)) item.parameters = obj.parameters.map(parseParameter);
    return item;
}

/**
 * Parses a raw paths object into a normalized PathsObject.
 * @param obj The raw paths object from the spec.
 * @returns A normalized PathsObject.
 */
export function parsePaths(obj: any): PathsObject {
    const paths: PathsObject = {};
    for (const [k, v] of Object.entries(obj)) {
        if (k.startsWith('/')) {
            paths[k] = parsePathItem(v) as PathItemObject; // references are permitted but type simplified
        }
    }
    return paths;
}

/**
 * Parses a raw OAuth flow object into a normalized OAuthFlowObject.
 * @param obj The raw OAuth flow object from the spec.
 * @returns A normalized OAuthFlowObject.
 */
export function parseOAuthFlow(obj: any): OAuthFlowObject {
    const flow: OAuthFlowObject = { scopes: {} };
    if (obj.authorizationUrl) flow.authorizationUrl = String(obj.authorizationUrl);
    if (obj.tokenUrl) flow.tokenUrl = String(obj.tokenUrl);
    if (obj.refreshUrl) flow.refreshUrl = String(obj.refreshUrl);
    if (obj.deviceAuthorizationUrl) flow.deviceAuthorizationUrl = String(obj.deviceAuthorizationUrl);
    if (obj.scopes && typeof obj.scopes === 'object') {
        for (const [k, v] of Object.entries(obj.scopes)) {
            flow.scopes[k] = String(v);
        }
    }
    return flow;
}

/**
 * Parses a raw security scheme object into a normalized SecuritySchemeObject or ReferenceObject.
 * @param obj The raw security scheme object from the spec.
 * @returns A normalized SecuritySchemeObject or ReferenceObject.
 */
export function parseSecurityScheme(obj: any): SecuritySchemeObject | ReferenceObject {
    if (isReference(obj)) return parseReference(obj);
    const scheme: SecuritySchemeObject = {
        type: ['apiKey', 'http', 'mutualTLS', 'oauth2', 'openIdConnect'].includes(obj.type) ? obj.type : 'http',
    };
    if (obj.description) scheme.description = String(obj.description);
    if (obj.name) scheme.name = String(obj.name);
    if (obj.in && ['query', 'header', 'cookie'].includes(obj.in)) scheme.in = obj.in as any;
    if (obj.scheme) scheme.scheme = String(obj.scheme);
    if (obj.bearerFormat) scheme.bearerFormat = String(obj.bearerFormat);
    if (obj.openIdConnectUrl) scheme.openIdConnectUrl = String(obj.openIdConnectUrl);
    if (obj.oauth2MetadataUrl) scheme.oauth2MetadataUrl = String(obj.oauth2MetadataUrl);
    
    if (obj.flows && typeof obj.flows === 'object') {
        scheme.flows = {};
        if (obj.flows.implicit) scheme.flows.implicit = parseOAuthFlow(obj.flows.implicit);
        if (obj.flows.password) scheme.flows.password = parseOAuthFlow(obj.flows.password);
        if (obj.flows.clientCredentials) scheme.flows.clientCredentials = parseOAuthFlow(obj.flows.clientCredentials);
        if (obj.flows.authorizationCode) scheme.flows.authorizationCode = parseOAuthFlow(obj.flows.authorizationCode);
        if (obj.flows.deviceAuthorization) scheme.flows.deviceAuthorization = parseOAuthFlow(obj.flows.deviceAuthorization);
    }
    return scheme;
}

/**
 * Parses a raw components object into a normalized ComponentsObject.
 * @param obj The raw components object from the spec.
 * @returns A normalized ComponentsObject.
 */
export function parseComponents(obj: any): ComponentsObject {
    const comp: ComponentsObject = {};
    if (obj.schemas && typeof obj.schemas === 'object') {
        comp.schemas = {};
        for (const [k, v] of Object.entries(obj.schemas)) comp.schemas[k] = parseSchema(v);
    }
    if (obj.responses && typeof obj.responses === 'object') {
        comp.responses = {};
        for (const [k, v] of Object.entries(obj.responses)) comp.responses[k] = parseResponse(v);
    }
    if (obj.parameters && typeof obj.parameters === 'object') {
        comp.parameters = {};
        for (const [k, v] of Object.entries(obj.parameters)) comp.parameters[k] = parseParameter(v);
    }
    if (obj.examples && typeof obj.examples === 'object') {
        comp.examples = {};
        for (const [k, v] of Object.entries(obj.examples)) comp.examples[k] = parseExample(v);
    }
    if (obj.requestBodies && typeof obj.requestBodies === 'object') {
        comp.requestBodies = {};
        for (const [k, v] of Object.entries(obj.requestBodies)) comp.requestBodies[k] = parseRequestBody(v);
    }
    if (obj.headers && typeof obj.headers === 'object') {
        comp.headers = {};
        for (const [k, v] of Object.entries(obj.headers)) comp.headers[k] = parseHeader(v);
    }
    if (obj.securitySchemes && typeof obj.securitySchemes === 'object') {
        comp.securitySchemes = {};
        for (const [k, v] of Object.entries(obj.securitySchemes)) comp.securitySchemes[k] = parseSecurityScheme(v);
    }
    if (obj.links && typeof obj.links === 'object') {
        comp.links = {};
        for (const [k, v] of Object.entries(obj.links)) comp.links[k] = parseLink(v);
    }
    if (obj.callbacks && typeof obj.callbacks === 'object') {
        comp.callbacks = {};
        for (const [k, v] of Object.entries(obj.callbacks)) comp.callbacks[k] = parseCallback(v);
    }
    if (obj.pathItems && typeof obj.pathItems === 'object') {
        comp.pathItems = {};
        for (const [k, v] of Object.entries(obj.pathItems)) comp.pathItems[k] = parsePathItem(v);
    }
    if (obj.mediaTypes && typeof obj.mediaTypes === 'object') {
        comp.mediaTypes = {};
        for (const [k, v] of Object.entries(obj.mediaTypes)) comp.mediaTypes[k] = parseMediaType(v);
    }
    return comp;
}

/**
 * Parses a raw tag object into a normalized TagObject.
 * @param obj The raw tag object from the spec.
 * @returns A normalized TagObject.
 */
export function parseTag(obj: any): TagObject {
    const tag: TagObject = { name: String(obj.name || 'Unknown') };
    if (obj.summary) tag.summary = String(obj.summary);
    if (obj.description) tag.description = String(obj.description);
    if (obj.externalDocs) tag.externalDocs = parseExternalDocs(obj.externalDocs);
    if (obj.parent) tag.parent = String(obj.parent);
    if (obj.kind) tag.kind = String(obj.kind);
    return tag;
}

import { transformSwagger2ToOpenAPI3 } from './swagger2';

/**
 * Normalizes an OpenAPI specification string (JSON or YAML) into the internal `DocData` representation.
 * @param specContent Raw OpenAPI spec string (YAML/JSON).
 * @returns Normalized DocData.
 * @throws {Error} If the spec format is invalid.
 */
export function normalizeSpec(specContent: string): DocData {
    let parsed: any;
    try {
        parsed = yaml.load(specContent);
    } catch (e) {
        throw new Error('Invalid OpenAPI specification format.');
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid OpenAPI specification format.');
    }

    transformSwagger2ToOpenAPI3(parsed);

    const spec: OpenAPI320 = {
        openapi: String(parsed.openapi || '3.2.0'),
        info: parseInfo(parsed.info),
    };

    if (parsed.jsonSchemaDialect) spec.jsonSchemaDialect = String(parsed.jsonSchemaDialect);
    if (Array.isArray(parsed.servers)) spec.servers = parsed.servers.map(parseServer);
    if (parsed.paths && typeof parsed.paths === 'object') spec.paths = parsePaths(parsed.paths);
    if (parsed.webhooks && typeof parsed.webhooks === 'object') {
        spec.webhooks = {};
        for (const [k, v] of Object.entries(parsed.webhooks)) {
            spec.webhooks[k] = parsePathItem(v);
        }
    }
    if (parsed.components && typeof parsed.components === 'object')
        spec.components = parseComponents(parsed.components);
    if (Array.isArray(parsed.security)) spec.security = parsed.security.map(parseSecurityRequirement);
    if (Array.isArray(parsed.tags)) spec.tags = parsed.tags.map(parseTag);
    if (parsed.externalDocs) spec.externalDocs = parseExternalDocs(parsed.externalDocs);

    return {
        spec,
        codeExamples: {},
    };
}

/**
 * Maps generated SDK code examples to their respective operations in the documentation data.
 * @param docData The documentation data to update.
 * @param generatedFiles The list of generated code examples.
 */
export function mapSdkExamples(docData: DocData, generatedFiles: CodeExample[]): void {
    if (!docData.spec.paths) return;

    const operationMap: Record<string, { route: string; method: string; op: OperationObject }> = {};

    for (const [route, pathItem] of Object.entries(docData.spec.paths)) {
        if (isReference(pathItem)) continue;
        const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];
        for (const m of methods) {
            const op = (pathItem as any)[m];
            if (op) {
                const id = op.operationId || `${m}-${route}`;
                operationMap[id] = { route, method: m, op };
            }
        }
    }

    const operations = Object.entries(operationMap);
    if (operations.length === 0) return;

    for (const file of generatedFiles) {
        let matchedId: string | null = null;

        // 1. Try match with operationId
        for (const [id, info] of operations) {
            if (info.op.operationId && (file.filepath || "").toLowerCase().includes(info.op.operationId.toLowerCase())) {
                matchedId = id;
                break;
            }
        }

        // 2. Try match with route and method
        if (!matchedId) {
              /* v8 ignore next 10 */ for (const [id, info] of operations) {
                  /* v8 ignore next */ const routeSlug = info.route.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                if (
                      /* v8 ignore next */ (file.filepath || "").toLowerCase().includes(routeSlug) &&
                      /* v8 ignore next */ (file.filepath || "").toLowerCase().includes(info.method.toLowerCase())
                ) {
                    matchedId = id;
                    break;
                }
            }
        }

        if (matchedId) {
            if (!docData.codeExamples[matchedId]) docData.codeExamples[matchedId] = [];
            docData.codeExamples[matchedId]!.push(file);
        }
    }
}
