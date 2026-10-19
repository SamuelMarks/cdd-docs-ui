/**
 * Arazzo 1.1.0 Parser, Normalizer, Runtime Expression AST, and Cross-Spec Linker.
 * @module arazzo-parser
 */

import yaml from 'js-yaml';
import {
    Arazzo110,
    ArazzoInfoObject,
    SourceDescriptionObject,
    SourceDescriptionType,
    WorkflowObject,
    StepObject,
    StepActionType,
    ArazzoParameterObject,
    ArazzoParameterLocation,
    ReusableObject,
    ArazzoRequestBodyObject,
    PayloadReplacementObject,
    CriterionObject,
    CriterionType,
    CriterionExpressionTypeObject,
    SelectorObject,
    SelectorType,
    SuccessActionObject,
    SuccessActionType,
    FailureActionObject,
    FailureActionType,
    ArazzoComponentsObject,
    RuntimeExpressionRoot,
    RUNTIME_ROOT_PREFIXES,
    ParsedRuntimeExpression,
    LinkedOperationTarget,
    DagEdge,
    WorkflowDag,
    NormalizedStep,
    NormalizedWorkflow,
} from './arazzo-types';
import { JsonValue, SchemaObject, ReferenceObject, OpenAPI320 } from './openapi-types';
import { isRecord, toJsonValue, parseSchema, isReference, getPathOperations } from './parser';

/**
 * Extracts `^x-` specification extension keys from a record into a typed extensions dictionary.
 * @param rec The record to extract extensions from.
 * @returns A map of extension keys to `JsonValue` values, or `undefined` if none are present.
 */
export function extractExtensions(rec: Record<string, unknown>): Record<string, JsonValue> | undefined {
    const ext: Record<string, JsonValue> = {};
    let hasExt = false;
    for (const [k, v] of Object.entries(rec)) {
        if (k.startsWith('x-') && v !== undefined) {
            ext[k] = toJsonValue(v);
            hasExt = true;
        }
    }
    return hasExt ? ext : undefined;
}

/**
 * Represents a raw parsed Arazzo specification record prior to normalization.
 */
export interface RawArazzoRecord extends Record<string, unknown> {
    /** The Arazzo specification version string. */
    arazzo: string;
    /** Raw unparsed workflow entries array. */
    workflows: unknown[];
}

/**
 * Checks whether a parsed object represents an Arazzo 1.0.x or 1.1.x specification.
 * @param parsed The unknown parsed JSON/YAML value.
 * @returns True if the value is an Arazzo specification record.
 */
export function isArazzoSpec(parsed: unknown): parsed is RawArazzoRecord {
    if (!isRecord(parsed)) return false;
    return typeof parsed['arazzo'] === 'string' && Array.isArray(parsed['workflows']);
}

/**
 * Detects the specification kind ('openapi', 'swagger2', 'arazzo', or 'unknown') from a raw YAML/JSON string.
 * @param rawSpec The raw YAML or JSON specification string.
 * @returns The detected specification kind.
 */
export function detectSpecKind(rawSpec: string): 'openapi' | 'swagger2' | 'arazzo' | 'unknown' {
    let parsed: unknown;
    try {
        parsed = yaml.load(rawSpec);
    } catch {
        return 'unknown';
    }
    if (!isRecord(parsed)) return 'unknown';
    if (isArazzoSpec(parsed)) return 'arazzo';
    if (typeof parsed['swagger'] === 'string' && parsed['swagger'].startsWith('2.')) return 'swagger2';
    if (typeof parsed['openapi'] === 'string' || isRecord(parsed['info']) || isRecord(parsed['paths'])) {
        return 'openapi';
    }
    return 'unknown';
}

/**
 * Parses a raw Arazzo info object into a normalized `ArazzoInfoObject`.
 * @param obj The raw info object from the Arazzo document.
 * @returns A normalized `ArazzoInfoObject`.
 * @throws {Error} If the info object is not a valid record.
 */
export function parseArazzoInfo(obj: unknown): ArazzoInfoObject {
    if (!isRecord(obj)) throw new Error('Missing Arazzo info object');
    const info: ArazzoInfoObject = {
        title: String(obj['title'] || ''),
        version: String(obj['version'] || '1.0.0'),
    };
    if (obj['summary']) info.summary = String(obj['summary']);
    if (obj['description']) info.description = String(obj['description']);
    const ext = extractExtensions(obj);
    if (ext) info.extensions = ext;
    return info;
}

/**
 * Type guard checking if a value is a valid `SourceDescriptionType`.
 * @param val The value to check.
 * @returns True if the value is 'openapi', 'asyncapi', or 'arazzo'.
 */
function isSourceDescriptionType(val: unknown): val is SourceDescriptionType {
    return val === 'openapi' || val === 'asyncapi' || val === 'arazzo';
}

/**
 * Parses a raw source description object into a normalized `SourceDescriptionObject`.
 * @param obj The raw source description object.
 * @returns A normalized `SourceDescriptionObject`.
 */
export function parseSourceDescription(obj: unknown): SourceDescriptionObject {
    const rec = isRecord(obj) ? obj : {};
    const sd: SourceDescriptionObject = {
        name: String(rec['name'] || 'default'),
        url: String(rec['url'] || ''),
    };
    if (isSourceDescriptionType(rec['type'])) {
        sd.type = rec['type'];
    }
    const ext = extractExtensions(rec);
    if (ext) sd.extensions = ext;
    return sd;
}

/**
 * Checks whether an unknown object is an Arazzo `ReusableObject` (having a `reference` string).
 * @param obj The object to inspect.
 * @returns True if `obj` is a `ReusableObject`.
 */
export function isReusableObject(obj: unknown): obj is ReusableObject {
    return isRecord(obj) && typeof obj['reference'] === 'string' && typeof obj['name'] !== 'string';
}

/**
 * Parses a raw reusable object into a normalized `ReusableObject`.
 * @param obj The raw reusable object.
 * @returns A normalized `ReusableObject`.
 */
export function parseReusableObject(obj: unknown): ReusableObject {
    const rec = isRecord(obj) ? obj : {};
    const reusable: ReusableObject = {
        reference: String(rec['reference'] || ''),
    };
    if (rec['value'] !== undefined) {
        reusable.value = toJsonValue(rec['value']);
    }
    return reusable;
}

/**
 * Checks whether an unknown object is a `SelectorObject` (having `context` and `selector` strings).
 * @param obj The object to inspect.
 * @returns True if `obj` is a `SelectorObject`.
 */
export function isSelectorObject(obj: unknown): obj is SelectorObject {
    return isRecord(obj) && typeof obj['context'] === 'string' && typeof obj['selector'] === 'string';
}

/**
 * Type guard checking if a value is a valid `SelectorType`.
 * @param val The value to check.
 * @returns True if the value is 'jsonpointer', 'jsonpath', 'xpath', or 'regex'.
 */
function isSelectorType(val: unknown): val is SelectorType {
    return val === 'jsonpointer' || val === 'jsonpath' || val === 'xpath' || val === 'regex';
}

/**
 * Parses a raw criterion expression type object into a normalized `CriterionExpressionTypeObject`.
 * @param obj The raw expression type object.
 * @returns A normalized `CriterionExpressionTypeObject`.
 */
export function parseCriterionExpressionType(obj: Record<string, unknown>): CriterionExpressionTypeObject {
    const exprType: CriterionExpressionTypeObject = {
        type: obj['type'] === 'xpath' ? 'xpath' : 'jsonpath',
        version: String(obj['version'] || 'draft-goessner-dispatch-jsonpath-00'),
    };
    const ext = extractExtensions(obj);
    if (ext) exprType.extensions = ext;
    return exprType;
}

/**
 * Parses a raw selector object into a normalized `SelectorObject`.
 * @param obj The raw selector object.
 * @returns A normalized `SelectorObject`.
 */
export function parseSelector(obj: unknown): SelectorObject {
    const rec = isRecord(obj) ? obj : {};
    const sel: SelectorObject = {
        context: String(rec['context'] || '$response.body'),
        selector: String(rec['selector'] || ''),
    };
    const typeVal = rec['type'];
    if (isSelectorType(typeVal)) {
        sel.type = typeVal;
    } else if (isRecord(typeVal)) {
        sel.type = parseCriterionExpressionType(typeVal);
    }
    if (rec['version']) sel.version = String(rec['version']);
    const ext = extractExtensions(rec);
    if (ext) sel.extensions = ext;
    return sel;
}

/**
 * Type guard checking if a value is a valid `ArazzoParameterLocation`.
 * @param val The value to check.
 * @returns True if the value is 'path', 'query', 'querystring', 'header', or 'cookie'.
 */
function isArazzoParameterIn(val: unknown): val is ArazzoParameterLocation {
    return val === 'path' || val === 'query' || val === 'querystring' || val === 'header' || val === 'cookie';
}

/**
 * Parses a raw Arazzo parameter object into a normalized `ArazzoParameterObject`.
 * @param obj The raw parameter object.
 * @returns A normalized `ArazzoParameterObject`.
 */
export function parseArazzoParameter(obj: unknown): ArazzoParameterObject {
    const rec = isRecord(obj) ? obj : {};
    const rawVal = rec['value'];
    const param: ArazzoParameterObject = {
        name: String(rec['name'] || ''),
        value: isSelectorObject(rawVal) ? parseSelector(rawVal) : toJsonValue(rawVal ?? ''),
    };
    if (isArazzoParameterIn(rec['in'])) {
        param.in = rec['in'];
    }
    const ext = extractExtensions(rec);
    if (ext) param.extensions = ext;
    return param;
}

/**
 * Parses a parameter or reusable object entry.
 * @param obj The raw parameter or reusable object.
 * @returns Either an `ArazzoParameterObject` or a `ReusableObject`.
 */
export function parseArazzoParameterOrReusable(obj: unknown): ArazzoParameterObject | ReusableObject {
    if (isReusableObject(obj)) return parseReusableObject(obj);
    return parseArazzoParameter(obj);
}

/**
 * Parses a raw payload replacement object into a normalized `PayloadReplacementObject`.
 * @param obj The raw payload replacement object.
 * @returns A normalized `PayloadReplacementObject`.
 */
export function parsePayloadReplacement(obj: unknown): PayloadReplacementObject {
    const rec = isRecord(obj) ? obj : {};
    const rawVal = rec['value'];
    const rep: PayloadReplacementObject = {
        target: String(rec['target'] || ''),
        value: isSelectorObject(rawVal) ? parseSelector(rawVal) : toJsonValue(rawVal ?? ''),
    };
    const ext = extractExtensions(rec);
    if (ext) rep.extensions = ext;
    return rep;
}

/**
 * Parses a raw Arazzo request body object into a normalized `ArazzoRequestBodyObject`.
 * @param obj The raw request body object.
 * @returns A normalized `ArazzoRequestBodyObject`.
 */
export function parseArazzoRequestBody(obj: unknown): ArazzoRequestBodyObject {
    const rec = isRecord(obj) ? obj : {};
    const rb: ArazzoRequestBodyObject = {};
    if (rec['contentType']) rb.contentType = String(rec['contentType']);
    if (rec['payload'] !== undefined) rb.payload = toJsonValue(rec['payload']);
    if (Array.isArray(rec['replacements'])) {
        rb.replacements = rec['replacements'].map(parsePayloadReplacement);
    }
    const ext = extractExtensions(rec);
    if (ext) rb.extensions = ext;
    return rb;
}

/**
 * Type guard checking if a value is a valid `CriterionType`.
 * @param val The value to check.
 * @returns True if the value is 'simple', 'regex', 'jsonpath', or 'xpath'.
 */
function isCriterionType(val: unknown): val is CriterionType {
    return val === 'simple' || val === 'regex' || val === 'jsonpath' || val === 'xpath';
}

/**
 * Parses a raw criterion object into a normalized `CriterionObject`.
 * @param obj The raw criterion object.
 * @returns A normalized `CriterionObject`.
 */
export function parseCriterion(obj: unknown): CriterionObject {
    const rec = isRecord(obj) ? obj : {};
    const crit: CriterionObject = {
        condition: String(rec['condition'] || ''),
    };
    if (rec['context']) crit.context = String(rec['context']);
    const typeVal = rec['type'];
    if (isCriterionType(typeVal)) {
        crit.type = typeVal;
    } else if (isRecord(typeVal)) {
        crit.type = parseCriterionExpressionType(typeVal);
    }
    const ext = extractExtensions(rec);
    if (ext) crit.extensions = ext;
    return crit;
}

/**
 * Type guard checking if a value is a valid `SuccessActionType`.
 * @param val The value to check.
 * @returns True if the value is 'end' or 'goto'.
 */
function isSuccessActionType(val: unknown): val is SuccessActionType {
    return val === 'end' || val === 'goto';
}

/**
 * Parses a raw success action object into a normalized `SuccessActionObject`.
 * @param obj The raw success action object.
 * @returns A normalized `SuccessActionObject`.
 */
export function parseSuccessAction(obj: unknown): SuccessActionObject {
    const rec = isRecord(obj) ? obj : {};
    const action: SuccessActionObject = {
        name: String(rec['name'] || 'defaultSuccess'),
        type: isSuccessActionType(rec['type']) ? rec['type'] : 'end',
    };
    if (rec['workflowId']) action.workflowId = String(rec['workflowId']);
    if (rec['stepId']) action.stepId = String(rec['stepId']);
    if (Array.isArray(rec['parameters'])) {
        action.parameters = rec['parameters'].map(parseArazzoParameterOrReusable);
    }
    if (Array.isArray(rec['criteria'])) {
        action.criteria = rec['criteria'].map(parseCriterion);
    }
    const ext = extractExtensions(rec);
    if (ext) action.extensions = ext;
    return action;
}

/**
 * Parses a success action or reusable object entry.
 * @param obj The raw success action or reusable object.
 * @returns Either a `SuccessActionObject` or a `ReusableObject`.
 */
export function parseSuccessActionOrReusable(obj: unknown): SuccessActionObject | ReusableObject {
    if (isReusableObject(obj)) return parseReusableObject(obj);
    return parseSuccessAction(obj);
}

/**
 * Type guard checking if a value is a valid `FailureActionType`.
 * @param val The value to check.
 * @returns True if the value is 'end', 'retry', or 'goto'.
 */
function isFailureActionType(val: unknown): val is FailureActionType {
    return val === 'end' || val === 'retry' || val === 'goto';
}

/**
 * Parses a raw failure action object into a normalized `FailureActionObject`.
 * @param obj The raw failure action object.
 * @returns A normalized `FailureActionObject`.
 */
export function parseFailureAction(obj: unknown): FailureActionObject {
    const rec = isRecord(obj) ? obj : {};
    const action: FailureActionObject = {
        name: String(rec['name'] || 'defaultFailure'),
        type: isFailureActionType(rec['type']) ? rec['type'] : 'end',
    };
    if (rec['workflowId']) action.workflowId = String(rec['workflowId']);
    if (rec['stepId']) action.stepId = String(rec['stepId']);
    if (Array.isArray(rec['parameters'])) {
        action.parameters = rec['parameters'].map(parseArazzoParameterOrReusable);
    }
    if (typeof rec['retryAfter'] === 'number') action.retryAfter = rec['retryAfter'];
    if (typeof rec['retryLimit'] === 'number') action.retryLimit = rec['retryLimit'];
    if (Array.isArray(rec['criteria'])) {
        action.criteria = rec['criteria'].map(parseCriterion);
    }
    const ext = extractExtensions(rec);
    if (ext) action.extensions = ext;
    return action;
}

/**
 * Parses a failure action or reusable object entry.
 * @param obj The raw failure action or reusable object.
 * @returns Either a `FailureActionObject` or a `ReusableObject`.
 */
export function parseFailureActionOrReusable(obj: unknown): FailureActionObject | ReusableObject {
    if (isReusableObject(obj)) return parseReusableObject(obj);
    return parseFailureAction(obj);
}

/**
 * Parses an outputs map (`Record<string, string | SelectorObject>`) from a workflow or step.
 * @param obj The raw outputs record.
 * @returns A normalized map of output names to runtime expression strings or `SelectorObject` instances.
 */
export function parseArazzoOutputs(obj: unknown): Record<string, string | SelectorObject> {
    const rec = isRecord(obj) ? obj : {};
    const out: Record<string, string | SelectorObject> = {};
    for (const [k, v] of Object.entries(rec)) {
        if (isSelectorObject(v)) {
            out[k] = parseSelector(v);
        } else {
            out[k] = String(v ?? '');
        }
    }
    return out;
}

/**
 * Type guard checking if a value is a valid `StepActionType`.
 * @param val The value to check.
 * @returns True if the value is 'send' or 'receive'.
 */
function isStepActionType(val: unknown): val is StepActionType {
    return val === 'send' || val === 'receive';
}

/**
 * Parses a raw step object into a normalized `StepObject`.
 * @param obj The raw step object.
 * @returns A normalized `StepObject`.
 */
export function parseStep(obj: unknown): StepObject {
    const rec = isRecord(obj) ? obj : {};
    const step: StepObject = {
        stepId: String(rec['stepId'] || 'step'),
    };
    if (rec['description']) step.description = String(rec['description']);
    if (rec['operationId']) step.operationId = String(rec['operationId']);
    if (rec['operationPath']) step.operationPath = String(rec['operationPath']);
    if (rec['channelPath']) step.channelPath = String(rec['channelPath']);
    if (rec['workflowId']) step.workflowId = String(rec['workflowId']);
    if (Array.isArray(rec['parameters'])) {
        step.parameters = rec['parameters'].map(parseArazzoParameterOrReusable);
    }
    if (isRecord(rec['requestBody'])) {
        step.requestBody = parseArazzoRequestBody(rec['requestBody']);
    }
    if (Array.isArray(rec['successCriteria'])) {
        step.successCriteria = rec['successCriteria'].map(parseCriterion);
    }
    if (Array.isArray(rec['onSuccess'])) {
        step.onSuccess = rec['onSuccess'].map(parseSuccessActionOrReusable);
    }
    if (Array.isArray(rec['onFailure'])) {
        step.onFailure = rec['onFailure'].map(parseFailureActionOrReusable);
    }
    if (isRecord(rec['outputs'])) {
        step.outputs = parseArazzoOutputs(rec['outputs']);
    }
    if (typeof rec['timeout'] === 'number') step.timeout = rec['timeout'];
    if (rec['correlationId']) step.correlationId = String(rec['correlationId']);
    if (isStepActionType(rec['action'])) step.action = rec['action'];
    if (Array.isArray(rec['dependsOn'])) {
        step.dependsOn = rec['dependsOn'].map(String);
    }
    const ext = extractExtensions(rec);
    if (ext) step.extensions = ext;
    return step;
}

/**
 * Parses a raw workflow object into a normalized `WorkflowObject`.
 * @param obj The raw workflow object.
 * @returns A normalized `WorkflowObject`.
 */
export function parseWorkflow(obj: unknown): WorkflowObject {
    const rec = isRecord(obj) ? obj : {};
    const wf: WorkflowObject = {
        workflowId: String(rec['workflowId'] || 'workflow'),
        steps: Array.isArray(rec['steps']) ? rec['steps'].map(parseStep) : [],
    };
    if (rec['summary']) wf.summary = String(rec['summary']);
    if (rec['description']) wf.description = String(rec['description']);
    if (isRecord(rec['inputs'])) {
        wf.inputs = parseSchema(rec['inputs']);
    }
    if (Array.isArray(rec['dependsOn'])) {
        wf.dependsOn = rec['dependsOn'].map(String);
    }
    if (Array.isArray(rec['successActions'])) {
        wf.successActions = rec['successActions'].map(parseSuccessActionOrReusable);
    }
    if (Array.isArray(rec['failureActions'])) {
        wf.failureActions = rec['failureActions'].map(parseFailureActionOrReusable);
    }
    if (isRecord(rec['outputs'])) {
        wf.outputs = parseArazzoOutputs(rec['outputs']);
    }
    if (Array.isArray(rec['parameters'])) {
        wf.parameters = rec['parameters'].map(parseArazzoParameterOrReusable);
    }
    const ext = extractExtensions(rec);
    if (ext) wf.extensions = ext;
    return wf;
}

/**
 * Parses a raw Arazzo components object into a normalized `ArazzoComponentsObject`.
 * @param obj The raw components object.
 * @returns A normalized `ArazzoComponentsObject`.
 */
export function parseArazzoComponents(obj: unknown): ArazzoComponentsObject {
    const rec = isRecord(obj) ? obj : {};
    const comp: ArazzoComponentsObject = {};
    const inputs = rec['inputs'];
    if (isRecord(inputs)) {
        comp.inputs = {};
        for (const [k, v] of Object.entries(inputs)) {
            comp.inputs[k] = parseSchema(v);
        }
    }
    const parameters = rec['parameters'];
    if (isRecord(parameters)) {
        comp.parameters = {};
        for (const [k, v] of Object.entries(parameters)) {
            comp.parameters[k] = parseArazzoParameter(v);
        }
    }
    const successActions = rec['successActions'];
    if (isRecord(successActions)) {
        comp.successActions = {};
        for (const [k, v] of Object.entries(successActions)) {
            comp.successActions[k] = parseSuccessAction(v);
        }
    }
    const failureActions = rec['failureActions'];
    if (isRecord(failureActions)) {
        comp.failureActions = {};
        for (const [k, v] of Object.entries(failureActions)) {
            comp.failureActions[k] = parseFailureAction(v);
        }
    }
    const ext = extractExtensions(rec);
    if (ext) comp.extensions = ext;
    return comp;
}

/**
 * Parses a raw Arazzo 1.1.0 specification string (JSON or YAML) into a strongly-typed `Arazzo110` object.
 * @param rawSpec The raw Arazzo YAML or JSON string.
 * @returns A normalized `Arazzo110` specification object.
 * @throws {Error} If the input is not a valid Arazzo specification.
 */
export function parseArazzoSpec(rawSpec: string): Arazzo110 {
    let parsed: unknown;
    try {
        parsed = yaml.load(rawSpec);
    } catch {
        throw new Error('Invalid Arazzo specification format.');
    }

    if (!isRecord(parsed) || !isArazzoSpec(parsed)) {
        throw new Error('Invalid Arazzo specification format.');
    }

    const spec: Arazzo110 = {
        arazzo: String(parsed['arazzo'] || '1.1.0'),
        info: parseArazzoInfo(parsed['info']),
        sourceDescriptions: Array.isArray(parsed['sourceDescriptions'])
            ? parsed['sourceDescriptions'].map(parseSourceDescription)
            : [],
        workflows: parsed['workflows'].map(parseWorkflow),
    };

    if (parsed['$self']) {
        spec.$self = String(parsed['$self']);
    }
    if (isRecord(parsed['components'])) {
        spec.components = parseArazzoComponents(parsed['components']);
    }
    const ext = extractExtensions(parsed);
    if (ext) spec.extensions = ext;

    return spec;
}

/**
 * Extracts the component key from an Arazzo `$components.<category>.<key>` reference string.
 * Returns `null` if the reference explicitly targets a different `$components.<otherCategory>` namespace.
 * @param reference The raw reference string (e.g. `'$components.parameters.authHeader'`).
 * @param category The expected component category (`'parameters'`, `'successActions'`, `'failureActions'`).
 * @returns An object with `key` (the leaf name) and `matchesCategory` (whether it is valid for this category).
 */
export function extractComponentKey(
    reference: string,
    category: 'parameters' | 'successActions' | 'failureActions',
): {
    /** The extracted component key name. */
    key: string;
    /** True if the reference matches the expected category or is a bare/unprefixed reference. */
    matchesCategory: boolean;
} {
    const prefix = `$components.${category}.`;
    if (reference.startsWith(prefix)) {
        return { key: reference.slice(prefix.length), matchesCategory: true };
    }
    const lastPart = reference.split('.').pop() || reference;
    if (reference.startsWith('$components.')) {
        return { key: lastPart, matchesCategory: false };
    }
    return { key: lastPart, matchesCategory: true };
}

/**
 * Resolves an `ArazzoParameterObject | ReusableObject` against `components.parameters`, applying any `value` override.
 * @param item The parameter or reusable reference object.
 * @param components Optional Arazzo components dictionary.
 * @returns A resolved `ArazzoParameterObject`.
 */
export function resolveArazzoReusableParameter(
    item: ArazzoParameterObject | ReusableObject,
    components?: ArazzoComponentsObject,
): ArazzoParameterObject {
    if (!isReusableObject(item)) {
        return item;
    }
    const { key, matchesCategory } = extractComponentKey(item.reference, 'parameters');
    const found = matchesCategory ? components?.parameters?.[key] : undefined;
    if (found) {
        return {
            ...found,
            value: item.value !== undefined ? item.value : found.value,
        };
    }
    return {
        name: key,
        value: item.value !== undefined ? item.value : item.reference,
    };
}

/**
 * Resolves a `SuccessActionObject | ReusableObject` against `components.successActions`.
 * @param item The success action or reusable reference object.
 * @param components Optional Arazzo components dictionary.
 * @returns A resolved `SuccessActionObject`.
 */
export function resolveArazzoSuccessAction(
    item: SuccessActionObject | ReusableObject,
    components?: ArazzoComponentsObject,
): SuccessActionObject {
    if (!isReusableObject(item)) {
        return item;
    }
    const { key, matchesCategory } = extractComponentKey(item.reference, 'successActions');
    const found = matchesCategory ? components?.successActions?.[key] : undefined;
    if (found) {
        return { ...found };
    }
    return {
        name: key,
        type: 'end',
    };
}

/**
 * Resolves a `FailureActionObject | ReusableObject` against `components.failureActions`.
 * @param item The failure action or reusable reference object.
 * @param components Optional Arazzo components dictionary.
 * @returns A resolved `FailureActionObject`.
 */
export function resolveArazzoFailureAction(
    item: FailureActionObject | ReusableObject,
    components?: ArazzoComponentsObject,
): FailureActionObject {
    if (!isReusableObject(item)) {
        return item;
    }
    const { key, matchesCategory } = extractComponentKey(item.reference, 'failureActions');
    const found = matchesCategory ? components?.failureActions?.[key] : undefined;
    if (found) {
        return { ...found };
    }
    return {
        name: key,
        type: 'end',
    };
}

/**
 * Resolves a workflow `inputs` schema or reference against `components.inputs`.
 * @param inputs The workflow inputs schema or reference.
 * @param components Optional Arazzo components dictionary.
 * @returns A resolved `SchemaObject`, or `undefined` if not present.
 */
export function resolveWorkflowInputSchema(
    inputs: SchemaObject | ReferenceObject | undefined,
    components?: ArazzoComponentsObject,
): SchemaObject | undefined {
    if (!inputs) return undefined;
    if (isReference(inputs)) {
        const ref = inputs.$ref;
        const key = ref.startsWith('#/components/inputs/')
            ? ref.slice('#/components/inputs/'.length)
            : ref.startsWith('$components.inputs.')
              ? ref.slice('$components.inputs.'.length)
              : ref.split('/').pop() || ref;
        const found = components?.inputs?.[key];
        if (found && !isReference(found)) {
            return found;
        }
        return { type: 'object', title: key, description: inputs.description };
    }
    return inputs;
}

/**
 * Dereferences and merges workflow-level default parameters with step-level parameters.
 * Step-level parameters with the same `(name, in)` pair override workflow-level parameters.
 * @param workflowParams Optional workflow-level parameters.
 * @param stepParams Optional step-level parameters.
 * @param components Optional Arazzo components dictionary.
 * @returns An array of merged `ArazzoParameterObject` items.
 */
export function mergeWorkflowAndStepParameters(
    workflowParams: (ArazzoParameterObject | ReusableObject)[] | undefined,
    stepParams: (ArazzoParameterObject | ReusableObject)[] | undefined,
    components?: ArazzoComponentsObject,
): ArazzoParameterObject[] {
    const resolvedWf = (workflowParams ?? []).map(p => resolveArazzoReusableParameter(p, components));
    const resolvedStep = (stepParams ?? []).map(p => resolveArazzoReusableParameter(p, components));

    const map = new Map<string, ArazzoParameterObject>();
    for (const p of resolvedWf) {
        const key = `${p.in ?? 'workflow'}:${p.name}`;
        map.set(key, p);
    }
    for (const p of resolvedStep) {
        const key = `${p.in ?? 'workflow'}:${p.name}`;
        map.set(key, p);
    }
    return Array.from(map.values());
}

/**
 * Parses an Arazzo 1.1.0 runtime expression or template string and extracts all referenced steps, inputs, workflows, and sources.
 * @param expr The expression string to analyze.
 * @returns A `ParsedRuntimeExpression` containing root classification and dependency references.
 */
export function parseRuntimeExpression(expr: string): ParsedRuntimeExpression {
    const trimmed = expr.trim();
    const isTemplate = !trimmed.startsWith('$') && /\{\$[a-zA-Z0-9_.\-#/~]+\}/.test(trimmed);
    let root: RuntimeExpressionRoot | undefined;

    for (const candidate of RUNTIME_ROOT_PREFIXES) {
        if (trimmed === candidate || trimmed.startsWith(`${candidate}.`) || trimmed.startsWith(`${candidate}#`)) {
            root = candidate;
            break;
        }
    }

    const referencedStepIds = new Set<string>();
    const referencedInputs = new Set<string>();
    const referencedWorkflows = new Set<string>();
    const referencedSources = new Set<string>();

    const stepRegex = /\$steps\.([A-Za-z0-9_-]+)/g;
    for (const m of trimmed.matchAll(stepRegex)) {
        referencedStepIds.add(String(m[1]));
    }

    const inputRegex = /\$inputs\.([A-Za-z0-9_-]+)/g;
    for (const m of trimmed.matchAll(inputRegex)) {
        referencedInputs.add(String(m[1]));
    }

    const wfRegex = /\$workflows\.([A-Za-z0-9_-]+)/g;
    for (const m of trimmed.matchAll(wfRegex)) {
        referencedWorkflows.add(String(m[1]));
    }

    const srcRegex = /\$sourceDescriptions\.([A-Za-z0-9_-]+)/g;
    for (const m of trimmed.matchAll(srcRegex)) {
        referencedSources.add(String(m[1]));
    }

    const hashIdx = trimmed.indexOf('#');
    const jsonPointer = hashIdx !== -1 ? trimmed.slice(hashIdx + 1).replace(/\}.*$/, '') : undefined;

    const isExpression = root !== undefined || isTemplate;

    return {
        raw: expr,
        isExpression,
        isTemplate,
        root,
        referencedStepIds: Array.from(referencedStepIds),
        referencedInputs: Array.from(referencedInputs),
        referencedWorkflows: Array.from(referencedWorkflows),
        referencedSources: Array.from(referencedSources),
        jsonPointer,
    };
}

/**
 * Unescapes RFC 6901 JSON Pointer tokens (`~1` -> `/`, `~0` -> `~`).
 * @param token The escaped JSON Pointer token.
 * @returns The unescaped string.
 */
export function unescapeJsonPointer(token: string): string {
    return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * Collects all step IDs referenced via `$steps.<stepId>` across a step's parameters, requestBody, criteria, actions, and outputs.
 * @param step The step object to inspect.
 * @param mergedParams Already-merged parameters for the step.
 * @returns Deduplicated array of upstream `stepId` strings referenced by this step.
 */
export function extractStepReferencesFromStep(step: StepObject, mergedParams: ArazzoParameterObject[]): string[] {
    const refs = new Set<string>();
    if (step.dependsOn) {
        for (const dep of step.dependsOn) refs.add(dep);
    }

    const inspectString = (s: string): void => {
        const parsed = parseRuntimeExpression(s);
        for (const id of parsed.referencedStepIds) {
            if (id !== step.stepId) refs.add(id);
        }
    };

    const inspectValue = (val: unknown): void => {
        if (typeof val === 'string') {
            inspectString(val);
        } else if (Array.isArray(val)) {
            val.forEach(inspectValue);
        } else if (isSelectorObject(val)) {
            inspectString(val.context);
            inspectString(val.selector);
        } else if (isRecord(val)) {
            for (const v of Object.values(val)) inspectValue(v);
        }
    };

    for (const p of mergedParams) {
        inspectValue(p.value);
    }
    if (step.requestBody) {
        inspectValue(step.requestBody.payload);
        if (step.requestBody.replacements) {
            for (const rep of step.requestBody.replacements) {
                inspectValue(rep.value);
            }
        }
    }
    if (step.successCriteria) {
        for (const crit of step.successCriteria) {
            if (crit.context) inspectString(crit.context);
            inspectString(crit.condition);
        }
    }
    if (step.outputs) {
        for (const outVal of Object.values(step.outputs)) {
            inspectValue(outVal);
        }
    }
    if (step.correlationId) {
        inspectString(step.correlationId);
    }

    return Array.from(refs);
}

/**
 * Builds the workflow-level and step-level dependency graphs (DAGs) and topological execution orders for an Arazzo document.
 * @param workflowsOrSpec The list of workflows or the full `Arazzo110` specification.
 * @param components Optional Arazzo components dictionary for parameter dereferencing.
 * @returns A `WorkflowDag` containing topological orders, directed edges, and cycle detection status.
 */
export function buildWorkflowDag(
    workflowsOrSpec: WorkflowObject[] | Arazzo110,
    components?: ArazzoComponentsObject,
): WorkflowDag {
    const workflows = Array.isArray(workflowsOrSpec) ? workflowsOrSpec : workflowsOrSpec.workflows;
    const resolvedComponents =
        components ?? (!Array.isArray(workflowsOrSpec) ? workflowsOrSpec.components : undefined);
    const workflowEdges: DagEdge[] = [];
    const stepOrderByWorkflow: Record<string, string[]> = {};
    const stepEdgesByWorkflow: Record<string, DagEdge[]> = {};
    let hasCycles = false;

    const wfIds = new Set(workflows.map(w => w.workflowId));
    const wfAdj: Array<{
        /** Source workflow ID. */
        id: string;
        /** Outgoing target workflow IDs. */
        targets: Set<string>;
        /** Incoming dependency count. */
        inDegree: number;
    }> = workflows.map(w => ({ id: w.workflowId, targets: new Set<string>(), inDegree: 0 }));

    const findWfNode = (id: string) => wfAdj.find(n => n.id === id);

    const addWfEdge = (from: string, to: string, kind: DagEdge['kind'], label?: string): void => {
        workflowEdges.push({ from, to, kind, label });
        if (wfIds.has(from) && wfIds.has(to) && from !== to) {
            const fromNode = findWfNode(from);
            const toNode = findWfNode(to);
            if (fromNode && toNode && !fromNode.targets.has(to)) {
                fromNode.targets.add(to);
                toNode.inDegree += 1;
            }
        }
    };

    for (const wf of workflows) {
        if (wf.dependsOn) {
            for (const dep of wf.dependsOn) {
                const parts = dep.split('.workflows.');
                const cleanDep = parts[1] ?? dep;
                addWfEdge(cleanDep, wf.workflowId, 'dependsOn');
            }
        }

        // Build step-level graph for this workflow
        const stepEdges: DagEdge[] = [];
        const stepIds = new Set(wf.steps.map(s => s.stepId));
        const stepNodes: Array<{
            /** Step ID. */
            id: string;
            /** Outgoing target step IDs. */
            targets: Set<string>;
            /** Incoming dependency count. */
            inDegree: number;
        }> = wf.steps.map(s => ({ id: s.stepId, targets: new Set<string>(), inDegree: 0 }));

        const findStepNode = (id: string) => stepNodes.find(n => n.id === id);

        const addStepDep = (from: string, to: string): void => {
            if (stepIds.has(from) && from !== to) {
                const fromNode = findStepNode(from);
                const toNode = findStepNode(to);
                if (fromNode && toNode && !fromNode.targets.has(to)) {
                    fromNode.targets.add(to);
                    toNode.inDegree += 1;
                }
            }
        };

        let prevStepId: string | undefined;
        for (const st of wf.steps) {
            if (prevStepId !== undefined) {
                stepEdges.push({ from: prevStepId, to: st.stepId, kind: 'sequential' });
                addStepDep(prevStepId, st.stepId);
            }
            prevStepId = st.stepId;

            if (st.workflowId) {
                const wfParts = st.workflowId.split('.workflows.');
                const targetWf = wfParts[1] ?? st.workflowId;
                addWfEdge(targetWf, wf.workflowId, 'subWorkflow', st.stepId);
            }

            const mergedParams = mergeWorkflowAndStepParameters(wf.parameters, st.parameters, resolvedComponents);
            const upstream = extractStepReferencesFromStep(st, mergedParams);
            for (const upId of upstream) {
                const kind: DagEdge['kind'] = st.dependsOn?.includes(upId) ? 'dependsOn' : 'dataFlow';
                stepEdges.push({ from: upId, to: st.stepId, kind });
                addStepDep(upId, st.stepId);
            }

            if (st.onSuccess) {
                for (const rawAct of st.onSuccess) {
                    const act = resolveArazzoSuccessAction(rawAct, resolvedComponents);
                    if (act.type === 'goto' && act.stepId) {
                        stepEdges.push({ from: st.stepId, to: act.stepId, kind: 'onSuccess', label: act.name });
                    }
                }
            }

            if (st.onFailure) {
                for (const rawAct of st.onFailure) {
                    const act = resolveArazzoFailureAction(rawAct, resolvedComponents);
                    if ((act.type === 'goto' || act.type === 'retry') && act.stepId) {
                        stepEdges.push({ from: st.stepId, to: act.stepId, kind: 'onFailure', label: act.name });
                    }
                }
            }
        }

        // Kahn's topological sort for steps
        const stepQueue = stepNodes.filter(n => n.inDegree === 0);
        const sortedSteps: string[] = [];
        let currStepNode = stepQueue.shift();
        while (currStepNode !== undefined) {
            sortedSteps.push(currStepNode.id);
            for (const nxtId of currStepNode.targets) {
                for (const candidate of stepNodes) {
                    if (candidate.id === nxtId) {
                        candidate.inDegree -= 1;
                        if (candidate.inDegree === 0) stepQueue.push(candidate);
                    }
                }
            }
            currStepNode = stepQueue.shift();
        }

        if (sortedSteps.length < wf.steps.length) {
            hasCycles = true;
            for (const st of wf.steps) {
                if (!sortedSteps.includes(st.stepId)) {
                    sortedSteps.push(st.stepId);
                }
            }
        }

        stepOrderByWorkflow[wf.workflowId] = sortedSteps;
        stepEdgesByWorkflow[wf.workflowId] = stepEdges;
    }

    // Kahn's topological sort for workflows
    const wfQueue = wfAdj.filter(n => n.inDegree === 0);
    const workflowOrder: string[] = [];
    let currWfNode = wfQueue.shift();
    while (currWfNode !== undefined) {
        workflowOrder.push(currWfNode.id);
        for (const nxtId of currWfNode.targets) {
            for (const candidate of wfAdj) {
                if (candidate.id === nxtId) {
                    candidate.inDegree -= 1;
                    if (candidate.inDegree === 0) wfQueue.push(candidate);
                }
            }
        }
        currWfNode = wfQueue.shift();
    }

    if (workflowOrder.length < workflows.length) {
        hasCycles = true;
        for (const wf of workflows) {
            if (!workflowOrder.includes(wf.workflowId)) {
                workflowOrder.push(wf.workflowId);
            }
        }
    }

    return {
        workflowOrder,
        workflowEdges,
        stepOrderByWorkflow,
        stepEdgesByWorkflow,
        hasCycles,
    };
}

/**
 * Resolves a step's `operationId`, `operationPath`, `channelPath`, or `workflowId` against an optional OpenAPI 3.2.0 specification.
 * @param step The Arazzo `StepObject` to link.
 * @param openApiSpec Optional parsed OpenAPI 3.2.0 specification.
 * @param sourceDescriptions Optional source descriptions list from the Arazzo document.
 * @returns A `LinkedOperationTarget` describing the target operation, channel, or sub-workflow, or `undefined` if none is specified.
 */
export function linkStepToOpenApiOperation(
    step: StepObject,
    openApiSpec?: OpenAPI320,
    sourceDescriptions?: SourceDescriptionObject[],
): LinkedOperationTarget | undefined {
    const defaultSource = sourceDescriptions?.[0]?.name;

    if (step.workflowId) {
        let sourceName = defaultSource;
        let wfId = step.workflowId;
        const match = step.workflowId.match(/^\$sourceDescriptions\.([A-Za-z0-9_-]+)\.workflows\.(.+)$/);
        if (match && match[1] && match[2]) {
            sourceName = match[1];
            wfId = match[2];
        }
        return {
            kind: 'workflow',
            sourceName,
            operationId: wfId,
            anchorId: `workflow-${wfId}`,
        };
    }

    if (step.channelPath) {
        const parsedExpr = parseRuntimeExpression(step.channelPath);
        const sourceName = parsedExpr.referencedSources[0] ?? defaultSource;
        let channelRoute = step.channelPath;
        if (parsedExpr.jsonPointer) {
            const segments = parsedExpr.jsonPointer.split('/').filter(Boolean).map(unescapeJsonPointer);
            if (segments[0] === 'channels' && segments[1]) {
                channelRoute = segments[1];
            } else {
                channelRoute = '/' + segments.join('/');
            }
        }
        return {
            kind: 'channel',
            sourceName,
            method: step.action ?? 'send',
            route: channelRoute,
        };
    }

    if (step.operationPath) {
        const parsedExpr = parseRuntimeExpression(step.operationPath);
        const sourceName = parsedExpr.referencedSources[0] ?? defaultSource;
        let route = step.operationPath;
        let method = 'get';

        if (parsedExpr.jsonPointer) {
            const segments = parsedExpr.jsonPointer.split('/').filter(Boolean).map(unescapeJsonPointer);
            if (
                (segments[0] === 'paths' || segments[0] === 'webhooks') &&
                segments[1] !== undefined &&
                segments[2] !== undefined
            ) {
                route = segments[1];
                method = segments[2].toLowerCase();
            }
        }

        let anchorId = `${method}-${route}`;
        let operationId: string | undefined;

        const pathItem = openApiSpec?.paths?.[route] ?? openApiSpec?.webhooks?.[route];
        if (pathItem && !isReference(pathItem)) {
            for (const [m, op] of getPathOperations(pathItem)) {
                if (m.toLowerCase() === method) {
                    operationId = op.operationId;
                    anchorId = op.operationId || `${m}-${route}`;
                    break;
                }
            }
        }

        return {
            kind: 'operation',
            sourceName,
            method,
            route,
            operationId,
            anchorId,
        };
    }

    if (step.operationId) {
        let sourceName = defaultSource;
        let opId = step.operationId;
        const match = step.operationId.match(/^\$sourceDescriptions\.([A-Za-z0-9_-]+)\.(.+)$/);
        if (match && match[1] && match[2]) {
            sourceName = match[1];
            opId = match[2];
        }

        if (openApiSpec?.paths) {
            for (const [route, pathItem] of Object.entries(openApiSpec.paths)) {
                if (isReference(pathItem)) continue;
                for (const [m, op] of getPathOperations(pathItem)) {
                    if (op.operationId === opId) {
                        return {
                            kind: 'operation',
                            sourceName,
                            method: m,
                            route,
                            operationId: opId,
                            anchorId: opId,
                        };
                    }
                }
            }
        }

        if (openApiSpec?.webhooks) {
            for (const [webhookName, pathItem] of Object.entries(openApiSpec.webhooks)) {
                if (isReference(pathItem)) continue;
                for (const [m, op] of getPathOperations(pathItem)) {
                    if (op.operationId === opId) {
                        return {
                            kind: 'operation',
                            sourceName,
                            method: m,
                            route: webhookName,
                            operationId: opId,
                            anchorId: opId,
                        };
                    }
                }
            }
        }

        return {
            kind: 'operation',
            sourceName,
            operationId: opId,
            anchorId: opId,
        };
    }

    return undefined;
}

/**
 * Generates a multi-step bash / cURL execution preview script for an Arazzo workflow.
 * @param workflow The workflow object.
 * @param normalizedSteps The normalized steps for the workflow.
 * @param baseUrl Base URL for HTTP requests.
 * @returns A formatted shell script string illustrating the workflow execution.
 */
export function generateWorkflowCliPreview(
    workflow: WorkflowObject,
    normalizedSteps: NormalizedStep[],
    baseUrl: string = 'https://api.example.com',
): string {
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const lines: string[] = [`# Workflow: ${workflow.workflowId}`];
    if (workflow.summary) {
        lines.push(`# ${workflow.summary}`);
    }
    if (workflow.dependsOn && workflow.dependsOn.length > 0) {
        lines.push(`# Prerequisites: ${workflow.dependsOn.join(', ')}`);
    }

    for (const [i, ns] of normalizedSteps.entries()) {
        const st = ns.step;
        lines.push('');
        lines.push(`# Step ${i + 1}: ${st.stepId}${st.description ? ` - ${st.description}` : ''}`);

        if (ns.linkedTarget?.kind === 'workflow') {
            lines.push(`cdd-ctl run-workflow --workflow-id "${ns.linkedTarget.operationId}"`);
            continue;
        }

        if (ns.linkedTarget?.kind === 'channel') {
            const action = (st.action ?? 'send').toUpperCase();
            lines.push(`# AsyncAPI ${action} on channel ${ns.linkedTarget.route}`);
            continue;
        }

        const method = (ns.linkedTarget?.method ?? 'get').toUpperCase();
        const route =
            ns.linkedTarget?.route ??
            (ns.linkedTarget?.operationId ? `/${ns.linkedTarget.operationId}` : `/${st.stepId}`);
        const methodFlag = method === 'GET' ? '' : `-X ${method} `;
        let cmd = `curl -s ${methodFlag}"${cleanBase}${route}"`;

        for (const p of ns.mergedParameters) {
            if (p.in === 'header') {
                const valStr = isSelectorObject(p.value) ? p.value.selector : String(p.value);
                cmd += ` -H "${p.name}: ${valStr}"`;
            }
        }

        if (st.requestBody) {
            const ct = st.requestBody.contentType || 'application/json';
            cmd += ` -H "Content-Type: ${ct}"`;
            if (st.requestBody.payload !== undefined) {
                const payloadStr =
                    typeof st.requestBody.payload === 'string'
                        ? st.requestBody.payload
                        : JSON.stringify(st.requestBody.payload);
                cmd += ` -d '${payloadStr}'`;
            }
        }

        lines.push(cmd);
    }

    return lines.join('\n');
}

/**
 * Normalizes all workflows in an `Arazzo110` specification into `NormalizedWorkflow` objects.
 * @param arazzoSpec The parsed `Arazzo110` specification.
 * @param openApiSpec Optional companion `OpenAPI320` specification for operation linking.
 * @returns An array of `NormalizedWorkflow` items.
 */
export function normalizeArazzoWorkflows(arazzoSpec: Arazzo110, openApiSpec?: OpenAPI320): NormalizedWorkflow[] {
    const components = arazzoSpec.components;
    const baseUrl = openApiSpec?.servers?.[0]?.url || 'https://api.example.com';
    const dag = buildWorkflowDag(arazzoSpec.workflows, components);

    return arazzoSpec.workflows.map(wf => {
        const resolvedInputs = resolveWorkflowInputSchema(wf.inputs, components);
        const resolvedParameters = (wf.parameters ?? []).map(p => resolveArazzoReusableParameter(p, components));
        const resolvedSuccessActions = (wf.successActions ?? []).map(a => resolveArazzoSuccessAction(a, components));
        const resolvedFailureActions = (wf.failureActions ?? []).map(a => resolveArazzoFailureAction(a, components));

        const normalizedSteps: NormalizedStep[] = wf.steps.map(st => {
            const mergedParameters = mergeWorkflowAndStepParameters(wf.parameters, st.parameters, components);
            const resolvedOnSuccess = (st.onSuccess ?? []).map(a => resolveArazzoSuccessAction(a, components));
            const resolvedOnFailure = (st.onFailure ?? []).map(a => resolveArazzoFailureAction(a, components));
            const linkedTarget = linkStepToOpenApiOperation(st, openApiSpec, arazzoSpec.sourceDescriptions);
            const upstreamStepIds = extractStepReferencesFromStep(st, mergedParameters);

            return {
                step: st,
                mergedParameters,
                resolvedOnSuccess,
                resolvedOnFailure,
                linkedTarget,
                upstreamStepIds,
            };
        });

        const cliPreview = generateWorkflowCliPreview(wf, normalizedSteps, baseUrl);

        return {
            workflow: wf,
            resolvedInputs,
            resolvedParameters,
            resolvedSuccessActions,
            resolvedFailureActions,
            normalizedSteps,
            cliPreview,
            stepOrder: dag.stepOrderByWorkflow[wf.workflowId],
            stepEdges: dag.stepEdgesByWorkflow[wf.workflowId],
            hasCycles: dag.hasCycles,
        };
    });
}
