
import { 
  DocData, CodeExample, OpenAPI320, InfoObject, ContactObject, 
  LicenseObject, ServerObject, ServerVariableObject, PathsObject, 
  PathItemObject, OperationObject, ParameterObject, RequestBodyObject,
  MediaTypeObject, ResponsesObject, ResponseObject, HeaderObject, LinkObject,
  CallbackObject, ExampleObject, ReferenceObject, EncodingObject, TagObject,
  ExternalDocumentationObject, SecurityRequirementObject, ComponentsObject,
  SchemaObject, DiscriminatorObject, XMLObject, SecuritySchemeObject,
  OAuthFlowsObject, OAuthFlowObject
} from "./types";
import yaml from "js-yaml";

export function parseInfo(obj: any): InfoObject {
  if (!obj) throw new Error("Missing info object");
  return {
    title: String(obj.title || ""),
    summary: obj.summary ? String(obj.summary) : undefined,
    description: obj.description ? String(obj.description) : undefined,
    termsOfService: obj.termsOfService ? String(obj.termsOfService) : undefined,
    contact: obj.contact ? parseContact(obj.contact) : undefined,
    license: obj.license ? parseLicense(obj.license) : undefined,
    version: String(obj.version || "")
  };
}

export function parseContact(obj: any): ContactObject {
  return {
    name: obj.name ? String(obj.name) : undefined,
    url: obj.url ? String(obj.url) : undefined,
    email: obj.email ? String(obj.email) : undefined
  };
}

export function parseLicense(obj: any): LicenseObject {
  return {
    name: String(obj.name || ""),
    identifier: obj.identifier ? String(obj.identifier) : undefined,
    url: obj.url ? String(obj.url) : undefined
  };
}

export function parseServerVariable(obj: any): ServerVariableObject {
  return {
    enum: Array.isArray(obj.enum) ? obj.enum.map(String) : undefined,
    default: String(obj.default || ""),
    description: obj.description ? String(obj.description) : undefined
  };
}

export function parseServer(obj: any): ServerObject {
  const server: ServerObject = {
    url: String(obj.url || "")
  };
  if (obj.description) server.description = String(obj.description);
  if (obj.variables && typeof obj.variables === "object") {
    server.variables = {};
    for (const [k, v] of Object.entries(obj.variables)) {
      server.variables[k] = parseServerVariable(v);
    }
  }
  return server;
}

export function parseReference(obj: any): ReferenceObject {
  return {
    $ref: String(obj.$ref),
    summary: obj.summary ? String(obj.summary) : undefined,
    description: obj.description ? String(obj.description) : undefined
  };
}

export function isReference(obj: any): obj is ReferenceObject {
  return obj && typeof obj.$ref === "string";
}

export function parseSchema(obj: any): SchemaObject | ReferenceObject {
  if (isReference(obj)) return parseReference(obj);
  
  const schema: SchemaObject = {};
  if (obj.type) schema.type = String(obj.type);
  if (obj.description) schema.description = String(obj.description);
  if (obj.format) schema.format = String(obj.format);
  if (obj.title) schema.title = String(obj.title);
  if (typeof obj.multipleOf === "number") schema.multipleOf = obj.multipleOf;
  if (typeof obj.maximum === "number") schema.maximum = obj.maximum;
  if (typeof obj.exclusiveMaximum === "boolean") schema.exclusiveMaximum = obj.exclusiveMaximum;
  if (typeof obj.minimum === "number") schema.minimum = obj.minimum;
  if (typeof obj.exclusiveMinimum === "boolean") schema.exclusiveMinimum = obj.exclusiveMinimum;
  if (typeof obj.maxLength === "number") schema.maxLength = obj.maxLength;
  if (typeof obj.minLength === "number") schema.minLength = obj.minLength;
  if (obj.pattern) schema.pattern = String(obj.pattern);
  if (typeof obj.maxItems === "number") schema.maxItems = obj.maxItems;
  if (typeof obj.minItems === "number") schema.minItems = obj.minItems;
  if (typeof obj.uniqueItems === "boolean") schema.uniqueItems = obj.uniqueItems;
  if (typeof obj.maxProperties === "number") schema.maxProperties = obj.maxProperties;
  if (typeof obj.minProperties === "number") schema.minProperties = obj.minProperties;
  if (Array.isArray(obj.required)) schema.required = obj.required.map(String);
  if (Array.isArray(obj.enum)) schema.enum = obj.enum;
  if (Array.isArray(obj.allOf)) schema.allOf = obj.allOf.map(parseSchema);
  if (Array.isArray(obj.oneOf)) schema.oneOf = obj.oneOf.map(parseSchema);
  if (Array.isArray(obj.anyOf)) schema.anyOf = obj.anyOf.map(parseSchema);
  if (obj.not) schema.not = parseSchema(obj.not);
  if (obj.items) schema.items = parseSchema(obj.items);
  if (obj.properties && typeof obj.properties === "object") {
    schema.properties = {};
    for (const [k, v] of Object.entries(obj.properties)) {
      schema.properties[k] = parseSchema(v);
    }
  }
  if (obj.additionalProperties !== undefined) {
    schema.additionalProperties = typeof obj.additionalProperties === "boolean" 
      ? obj.additionalProperties 
      : parseSchema(obj.additionalProperties);
  }
  if (obj.default !== undefined) schema.default = obj.default;
  if (typeof obj.nullable === "boolean") schema.nullable = obj.nullable;
  if (typeof obj.readOnly === "boolean") schema.readOnly = obj.readOnly;
  if (typeof obj.writeOnly === "boolean") schema.writeOnly = obj.writeOnly;
  if (obj.example !== undefined) schema.example = obj.example;
  if (typeof obj.deprecated === "boolean") schema.deprecated = obj.deprecated;
  
  if (obj.discriminator) {
    schema.discriminator = {
      propertyName: String(obj.discriminator.propertyName)
    };
    if (obj.discriminator.mapping && typeof obj.discriminator.mapping === "object") {
      schema.discriminator.mapping = {};
      for (const [k, v] of Object.entries(obj.discriminator.mapping)) {
        schema.discriminator.mapping[k] = String(v);
      }
    }
  }
  if (obj.xml) {
    schema.xml = {
      name: obj.xml.name ? String(obj.xml.name) : undefined,
      namespace: obj.xml.namespace ? String(obj.xml.namespace) : undefined,
      prefix: obj.xml.prefix ? String(obj.xml.prefix) : undefined,
      attribute: typeof obj.xml.attribute === "boolean" ? obj.xml.attribute : undefined,
      wrapped: typeof obj.xml.wrapped === "boolean" ? obj.xml.wrapped : undefined
    };
  }
  if (obj.externalDocs) schema.externalDocs = parseExternalDocs(obj.externalDocs);
  
  return schema;
}

export function parseExample(obj: any): ExampleObject | ReferenceObject {
  if (isReference(obj)) return parseReference(obj);
  return {
    summary: obj.summary ? String(obj.summary) : undefined,
    description: obj.description ? String(obj.description) : undefined,
    value: obj.value,
    externalValue: obj.externalValue ? String(obj.externalValue) : undefined
  };
}

export function parseHeader(obj: any): HeaderObject | ReferenceObject {
  if (isReference(obj)) return parseReference(obj);
  const header: HeaderObject = {};
  if (obj.description) header.description = String(obj.description);
  if (typeof obj.required === "boolean") header.required = obj.required;
  if (typeof obj.deprecated === "boolean") header.deprecated = obj.deprecated;
  if (obj.schema) header.schema = parseSchema(obj.schema);
  if (obj.example !== undefined) header.example = obj.example;
  return header;
}

export function parseEncoding(obj: any): EncodingObject {
  const encoding: EncodingObject = {};
  if (obj.contentType) encoding.contentType = String(obj.contentType);
  if (obj.headers && typeof obj.headers === "object") {
    encoding.headers = {};
    for (const [k, v] of Object.entries(obj.headers)) {
      encoding.headers[k] = parseHeader(v);
    }
  }
  if (obj.style) encoding.style = String(obj.style);
  if (typeof obj.explode === "boolean") encoding.explode = obj.explode;
  if (typeof obj.allowReserved === "boolean") encoding.allowReserved = obj.allowReserved;
  return encoding;
}

export function parseMediaType(obj: any): MediaTypeObject {
  const mt: MediaTypeObject = {};
  if (obj.schema) mt.schema = parseSchema(obj.schema);
  if (obj.example !== undefined) mt.example = obj.example;
  if (obj.examples && typeof obj.examples === "object") {
    mt.examples = {};
    for (const [k, v] of Object.entries(obj.examples)) {
      mt.examples[k] = parseExample(v);
    }
  }
  if (obj.encoding && typeof obj.encoding === "object") {
    mt.encoding = {};
    for (const [k, v] of Object.entries(obj.encoding)) {
      mt.encoding[k] = parseEncoding(v);
    }
  }
  return mt;
}

export function parseRequestBody(obj: any): RequestBodyObject | ReferenceObject {
  if (isReference(obj)) return parseReference(obj);
  const rb: RequestBodyObject = { content: {} };
  if (obj.description) rb.description = String(obj.description);
  if (typeof obj.required === "boolean") rb.required = obj.required;
  if (obj.content && typeof obj.content === "object") {
    for (const [k, v] of Object.entries(obj.content)) {
      rb.content[k] = parseMediaType(v);
    }
  }
  return rb;
}

export function parseParameter(obj: any): ParameterObject | ReferenceObject {
  if (isReference(obj)) return parseReference(obj);
  const param: ParameterObject = {
    name: String(obj.name || "Unknown"),
    in: (obj.in === "query" || obj.in === "header" || obj.in === "path" || obj.in === "cookie") ? obj.in : "query"
  };
  if (obj.description) param.description = String(obj.description);
  if (typeof obj.required === "boolean") param.required = obj.required;
  if (typeof obj.deprecated === "boolean") param.deprecated = obj.deprecated;
  if (typeof obj.allowEmptyValue === "boolean") param.allowEmptyValue = obj.allowEmptyValue;
  if (obj.style) param.style = String(obj.style);
  if (typeof obj.explode === "boolean") param.explode = obj.explode;
  if (typeof obj.allowReserved === "boolean") param.allowReserved = obj.allowReserved;
  if (obj.schema) param.schema = parseSchema(obj.schema);
  if (obj.example !== undefined) param.example = obj.example;
  if (obj.examples && typeof obj.examples === "object") {
    param.examples = {};
    for (const [k, v] of Object.entries(obj.examples)) {
      param.examples[k] = parseExample(v);
    }
  }
  if (obj.content && typeof obj.content === "object") {
    param.content = {};
    for (const [k, v] of Object.entries(obj.content)) {
      param.content[k] = parseMediaType(v);
    }
  }
  return param;
}

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

export function parseResponse(obj: any): ResponseObject | ReferenceObject {
  if (isReference(obj)) return parseReference(obj);
  const resp: ResponseObject = {
    description: String(obj.description || "")
  };
  if (obj.headers && typeof obj.headers === "object") {
    resp.headers = {};
    for (const [k, v] of Object.entries(obj.headers)) {
      resp.headers[k] = parseHeader(v);
    }
  }
  if (obj.content && typeof obj.content === "object") {
    resp.content = {};
    for (const [k, v] of Object.entries(obj.content)) {
      resp.content[k] = parseMediaType(v);
    }
  }
  if (obj.links && typeof obj.links === "object") {
    resp.links = {};
    for (const [k, v] of Object.entries(obj.links)) {
      resp.links[k] = parseLink(v);
    }
  }
  return resp;
}

export function parseResponses(obj: any): ResponsesObject {
  const responses: ResponsesObject = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "default") {
      responses.default = parseResponse(v);
    } else {
      responses[k] = parseResponse(v);
    }
  }
  return responses;
}

export function parseCallback(obj: any): CallbackObject | ReferenceObject {
  if (isReference(obj)) return parseReference(obj);
  const cb: CallbackObject = {};
  for (const [k, v] of Object.entries(obj)) {
    cb[k] = parsePathItem(v);
  }
  return cb;
}

export function parseExternalDocs(obj: any): ExternalDocumentationObject {
  return {
    url: String(obj.url || ""),
    description: obj.description ? String(obj.description) : undefined
  };
}

export function parseSecurityRequirement(obj: any): SecurityRequirementObject {
  const req: SecurityRequirementObject = {};
  for (const [k, v] of Object.entries(obj)) {
    req[k] = Array.isArray(v) ? v.map(String) : [];
  }
  return req;
}

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
  if (obj.callbacks && typeof obj.callbacks === "object") {
    op.callbacks = {};
    for (const [k, v] of Object.entries(obj.callbacks)) {
      op.callbacks[k] = parseCallback(v);
    }
  }
  if (typeof obj.deprecated === "boolean") op.deprecated = obj.deprecated;
  if (Array.isArray(obj.security)) op.security = obj.security.map(parseSecurityRequirement);
  if (Array.isArray(obj.servers)) op.servers = obj.servers.map(parseServer);
  return op;
}

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
  if (Array.isArray(obj.servers)) item.servers = obj.servers.map(parseServer);
  if (Array.isArray(obj.parameters)) item.parameters = obj.parameters.map(parseParameter);
  return item;
}

export function parsePaths(obj: any): PathsObject {
  const paths: PathsObject = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith("/")) {
      paths[k] = parsePathItem(v) as PathItemObject; // references are permitted but type simplified
    }
  }
  return paths;
}

export function parseOAuthFlow(obj: any): OAuthFlowObject {
  const flow: OAuthFlowObject = { scopes: {} };
  if (obj.authorizationUrl) flow.authorizationUrl = String(obj.authorizationUrl);
  if (obj.tokenUrl) flow.tokenUrl = String(obj.tokenUrl);
  if (obj.refreshUrl) flow.refreshUrl = String(obj.refreshUrl);
  if (obj.scopes && typeof obj.scopes === "object") {
    for (const [k, v] of Object.entries(obj.scopes)) {
      flow.scopes[k] = String(v);
    }
  }
  return flow;
}

export function parseSecurityScheme(obj: any): SecuritySchemeObject | ReferenceObject {
  if (isReference(obj)) return parseReference(obj);
  const scheme: SecuritySchemeObject = {
    type: (["apiKey", "http", "mutualTLS", "oauth2", "openIdConnect"].includes(obj.type)) ? obj.type : "http"
  };
  if (obj.description) scheme.description = String(obj.description);
  if (obj.name) scheme.name = String(obj.name);
  if (obj.in && ["query", "header", "cookie"].includes(obj.in)) scheme.in = obj.in as any;
  if (obj.scheme) scheme.scheme = String(obj.scheme);
  if (obj.bearerFormat) scheme.bearerFormat = String(obj.bearerFormat);
  if (obj.openIdConnectUrl) scheme.openIdConnectUrl = String(obj.openIdConnectUrl);
  if (obj.flows && typeof obj.flows === "object") {
    scheme.flows = {};
    if (obj.flows.implicit) scheme.flows.implicit = parseOAuthFlow(obj.flows.implicit);
    if (obj.flows.password) scheme.flows.password = parseOAuthFlow(obj.flows.password);
    if (obj.flows.clientCredentials) scheme.flows.clientCredentials = parseOAuthFlow(obj.flows.clientCredentials);
    if (obj.flows.authorizationCode) scheme.flows.authorizationCode = parseOAuthFlow(obj.flows.authorizationCode);
  }
  return scheme;
}

export function parseComponents(obj: any): ComponentsObject {
  const comp: ComponentsObject = {};
  if (obj.schemas && typeof obj.schemas === "object") {
    comp.schemas = {};
    for (const [k, v] of Object.entries(obj.schemas)) comp.schemas[k] = parseSchema(v);
  }
  if (obj.responses && typeof obj.responses === "object") {
    comp.responses = {};
    for (const [k, v] of Object.entries(obj.responses)) comp.responses[k] = parseResponse(v);
  }
  if (obj.parameters && typeof obj.parameters === "object") {
    comp.parameters = {};
    for (const [k, v] of Object.entries(obj.parameters)) comp.parameters[k] = parseParameter(v);
  }
  if (obj.examples && typeof obj.examples === "object") {
    comp.examples = {};
    for (const [k, v] of Object.entries(obj.examples)) comp.examples[k] = parseExample(v);
  }
  if (obj.requestBodies && typeof obj.requestBodies === "object") {
    comp.requestBodies = {};
    for (const [k, v] of Object.entries(obj.requestBodies)) comp.requestBodies[k] = parseRequestBody(v);
  }
  if (obj.headers && typeof obj.headers === "object") {
    comp.headers = {};
    for (const [k, v] of Object.entries(obj.headers)) comp.headers[k] = parseHeader(v);
  }
  if (obj.securitySchemes && typeof obj.securitySchemes === "object") {
    comp.securitySchemes = {};
    for (const [k, v] of Object.entries(obj.securitySchemes)) comp.securitySchemes[k] = parseSecurityScheme(v);
  }
  if (obj.links && typeof obj.links === "object") {
    comp.links = {};
    for (const [k, v] of Object.entries(obj.links)) comp.links[k] = parseLink(v);
  }
  if (obj.callbacks && typeof obj.callbacks === "object") {
    comp.callbacks = {};
    for (const [k, v] of Object.entries(obj.callbacks)) comp.callbacks[k] = parseCallback(v);
  }
  if (obj.pathItems && typeof obj.pathItems === "object") {
    comp.pathItems = {};
    for (const [k, v] of Object.entries(obj.pathItems)) comp.pathItems[k] = parsePathItem(v);
  }
  return comp;
}

export function parseTag(obj: any): TagObject {
  const tag: TagObject = { name: String(obj.name || "Unknown") };
  if (obj.description) tag.description = String(obj.description);
  if (obj.externalDocs) tag.externalDocs = parseExternalDocs(obj.externalDocs);
  return tag;
}

/**
 * Normalizes an OpenAPI specification string (JSON or YAML) into the internal `DocData` representation.
 */
export function normalizeSpec(specContent: string): DocData {
  let parsed: any;
  try {
    parsed = yaml.load(specContent);
  } catch (e) {
    throw new Error("Invalid OpenAPI specification format.");
  }
  
  if (!parsed || typeof parsed !== "object") {
     throw new Error("Invalid OpenAPI specification format.");
  }

  const spec: OpenAPI320 = {
    openapi: String(parsed.openapi || "3.2.0"),
    info: parseInfo(parsed.info)
  };

  if (parsed.jsonSchemaDialect) spec.jsonSchemaDialect = String(parsed.jsonSchemaDialect);
  if (Array.isArray(parsed.servers)) spec.servers = parsed.servers.map(parseServer);
  if (parsed.paths && typeof parsed.paths === "object") spec.paths = parsePaths(parsed.paths);
  if (parsed.webhooks && typeof parsed.webhooks === "object") {
    spec.webhooks = {};
    for (const [k, v] of Object.entries(parsed.webhooks)) {
      spec.webhooks[k] = parsePathItem(v);
    }
  }
  if (parsed.components && typeof parsed.components === "object") spec.components = parseComponents(parsed.components);
  if (Array.isArray(parsed.security)) spec.security = parsed.security.map(parseSecurityRequirement);
  if (Array.isArray(parsed.tags)) spec.tags = parsed.tags.map(parseTag);
  if (parsed.externalDocs) spec.externalDocs = parseExternalDocs(parsed.externalDocs);

  return {
    spec,
    codeExamples: {}
  };
}

export function mapSdkExamples(docData: DocData, generatedFiles: CodeExample[]): void {
  if (!docData.spec.paths) return;
  const operations: OperationObject[] = [];
  
  for (const pathItem of Object.values(docData.spec.paths)) {
    if (isReference(pathItem)) continue;
    if (pathItem.get) operations.push(pathItem.get);
    if (pathItem.put) operations.push(pathItem.put);
    if (pathItem.post) operations.push(pathItem.post);
    if (pathItem.delete) operations.push(pathItem.delete);
    if (pathItem.options) operations.push(pathItem.options);
    if (pathItem.head) operations.push(pathItem.head);
    if (pathItem.patch) operations.push(pathItem.patch);
    if (pathItem.trace) operations.push(pathItem.trace);
  }
  
  if (operations.length === 0) return;

  for (const file of generatedFiles) {
    let matched = false;
    for (const op of operations) {
      if (op.operationId && file.filepath.includes(op.operationId)) {
         if (!docData.codeExamples[op.operationId]) docData.codeExamples[op.operationId] = [];
         docData.codeExamples[op.operationId]!.push(file);
         matched = true;
      }
    }
    
    if (!matched) {
       const firstOpId = operations[0].operationId || "default";
       if (!docData.codeExamples[firstOpId]) docData.codeExamples[firstOpId] = [];
       docData.codeExamples[firstOpId]!.push(file);
    }
  }
}
