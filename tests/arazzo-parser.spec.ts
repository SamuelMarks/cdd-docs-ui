/**
 * Unit tests for Arazzo 1.1.0 parser, normalizer, runtime expression evaluator, and DAG linker (`src/arazzo-parser.ts`).
 * @module arazzo-parser.spec
 */
import { describe, it, expect } from 'vitest';
import {
    ArazzoParameterObject,
    SuccessActionObject,
    FailureActionObject,
    SourceDescriptionObject,
} from '../src/arazzo-types';
import {
    extractExtensions,
    isArazzoSpec,
    detectSpecKind,
    parseArazzoInfo,
    parseSourceDescription,
    isReusableObject,
    parseReusableObject,
    isSelectorObject,
    parseCriterionExpressionType,
    parseSelector,
    parseArazzoParameter,
    parseArazzoParameterOrReusable,
    parsePayloadReplacement,
    parseArazzoRequestBody,
    parseCriterion,
    parseSuccessAction,
    parseSuccessActionOrReusable,
    parseFailureAction,
    parseFailureActionOrReusable,
    parseArazzoOutputs,
    parseStep,
    parseWorkflow,
    parseArazzoComponents,
    parseArazzoSpec,
    resolveArazzoReusableParameter,
    resolveArazzoSuccessAction,
    resolveArazzoFailureAction,
    resolveWorkflowInputSchema,
    mergeWorkflowAndStepParameters,
    parseRuntimeExpression,
    unescapeJsonPointer,
    extractStepReferencesFromStep,
    buildWorkflowDag,
    linkStepToOpenApiOperation,
    generateWorkflowCliPreview,
    normalizeArazzoWorkflows,
} from '../src/arazzo-parser';
import { OpenAPI320 } from '../src/types';

describe('arazzo-parser.ts', () => {
    describe('extractExtensions & spec detection', () => {
        it('should extract x- extensions and return undefined when none exist', () => {
            expect(extractExtensions({ normal: 1, 'x-undef': undefined })).toBeUndefined();
            expect(extractExtensions({ 'x-custom': 'val', 'x-num': 42, normal: 'ignore' })).toEqual({
                'x-custom': 'val',
                'x-num': 42,
            });
        });

        it('should detect Arazzo, OpenAPI, Swagger 2.0, and unknown specs accurately', () => {
            expect(isArazzoSpec(null)).toBe(false);
            expect(isArazzoSpec({ arazzo: '1.1.0' })).toBe(false);
            expect(isArazzoSpec({ arazzo: '1.1.0', workflows: [] })).toBe(true);

            expect(detectSpecKind('invalid: [yaml')).toBe('unknown');
            expect(detectSpecKind('just a string')).toBe('unknown');
            expect(detectSpecKind('{"arazzo":"1.1.0","workflows":[]}')).toBe('arazzo');
            expect(detectSpecKind('{"swagger":"2.0","info":{}}')).toBe('swagger2');
            expect(detectSpecKind('{"openapi":"3.2.0","info":{}}')).toBe('openapi');
            expect(detectSpecKind('{"info":{"title":"T"}}')).toBe('openapi');
            expect(detectSpecKind('{"paths":{}}')).toBe('openapi');
            expect(detectSpecKind('{"unrelated":123}')).toBe('unknown');
        });
    });

    describe('granular object parsers', () => {
        it('should parse ArazzoInfoObject and throw on non-record', () => {
            expect(() => parseArazzoInfo(null)).toThrow('Missing Arazzo info object');
            const minimal = parseArazzoInfo({});
            expect(minimal).toEqual({ title: '', version: '1.0.0' });

            const full = parseArazzoInfo({
                title: 'WF Title',
                summary: 'Short',
                description: 'Long desc',
                version: '2.1.0',
                'x-info': true,
            });
            expect(full.title).toBe('WF Title');
            expect(full.summary).toBe('Short');
            expect(full.description).toBe('Long desc');
            expect(full.version).toBe('2.1.0');
            expect(full.extensions).toEqual({ 'x-info': true });
        });

        it('should parse SourceDescriptionObject across all source types and fallbacks', () => {
            expect(parseSourceDescription(null)).toEqual({ name: 'default', url: '' });
            const openapiSd = parseSourceDescription({
                name: 'petstore',
                url: './openapi.yaml',
                type: 'openapi',
                'x-sd': 'ext',
            });
            expect(openapiSd.type).toBe('openapi');
            expect(openapiSd.extensions).toEqual({ 'x-sd': 'ext' });

            expect(parseSourceDescription({ name: 'events', url: './async.yaml', type: 'asyncapi' }).type).toBe(
                'asyncapi',
            );
            expect(parseSourceDescription({ name: 'sub', url: './sub.yaml', type: 'arazzo' }).type).toBe('arazzo');
            expect(parseSourceDescription({ name: 'bad', url: './x', type: 'invalid' }).type).toBeUndefined();
        });

        it('should parse ReusableObject, SelectorObject, and CriterionExpressionTypeObject', () => {
            expect(isReusableObject(null)).toBe(false);
            expect(isReusableObject({ reference: '$components.parameters.p1', name: 'notReusable' })).toBe(false);
            expect(isReusableObject({ reference: '$components.parameters.p1' })).toBe(true);

            expect(parseReusableObject(null)).toEqual({ reference: '' });
            expect(parseReusableObject({ reference: '$components.parameters.p1', value: 'override' })).toEqual({
                reference: '$components.parameters.p1',
                value: 'override',
            });

            expect(isSelectorObject(null)).toBe(false);
            expect(isSelectorObject({ context: '$response.body', selector: '/id' })).toBe(true);

            expect(parseCriterionExpressionType({})).toEqual({
                type: 'jsonpath',
                version: 'draft-goessner-dispatch-jsonpath-00',
            });
            expect(
                parseCriterionExpressionType({
                    type: 'xpath',
                    version: 'xpath-30',
                    'x-expr': 1,
                }),
            ).toEqual({
                type: 'xpath',
                version: 'xpath-30',
                extensions: { 'x-expr': 1 },
            });

            expect(parseSelector(null)).toEqual({ context: '$response.body', selector: '' });
            const sel1 = parseSelector({
                context: '$message.body',
                selector: '$.id',
                type: 'jsonpath',
                version: 'RFC9535',
                'x-sel': 'yes',
            });
            expect(sel1.type).toBe('jsonpath');
            expect(sel1.version).toBe('RFC9535');
            expect(sel1.extensions).toEqual({ 'x-sel': 'yes' });

            const sel2 = parseSelector({
                context: '$response.body',
                selector: '//item',
                type: { type: 'xpath', version: 'xpath-20' },
            });
            expect(sel2.type).toEqual({ type: 'xpath', version: 'xpath-20' });
        });

        it('should parse ArazzoParameterObject, PayloadReplacementObject, RequestBody, and CriterionObject', () => {
            expect(parseArazzoParameter(null)).toEqual({ name: '', value: '' });
            const pWithSelector = parseArazzoParameter({
                name: 'filter',
                in: 'querystring',
                value: { context: '$response.body', selector: '/filter' },
                'x-param': 1,
            });
            expect(pWithSelector.in).toBe('querystring');
            expect(isSelectorObject(pWithSelector.value)).toBe(true);
            expect(pWithSelector.extensions).toEqual({ 'x-param': 1 });

            expect(parseArazzoParameterOrReusable({ reference: '$components.parameters.shared' })).toEqual({
                reference: '$components.parameters.shared',
            });
            expect(parseArazzoParameterOrReusable({ name: 'id', in: 'path', value: 123 })).toEqual({
                name: 'id',
                in: 'path',
                value: 123,
            });

            expect(parsePayloadReplacement(null)).toEqual({ target: '', value: '' });
            const repSel = parsePayloadReplacement({
                target: '/user/id',
                value: { context: '$response.body', selector: '/id', type: 'jsonpointer' },
                'x-rep': true,
            });
            expect(isSelectorObject(repSel.value)).toBe(true);
            expect(repSel.extensions).toEqual({ 'x-rep': true });

            expect(parseArazzoRequestBody(null)).toEqual({});
            const rb = parseArazzoRequestBody({
                contentType: 'application/json',
                payload: { a: 1 },
                replacements: [{ target: '/a', value: 2 }],
                'x-rb': 'ext',
            });
            expect(rb.contentType).toBe('application/json');
            expect(rb.replacements).toHaveLength(1);
            expect(rb.extensions).toEqual({ 'x-rb': 'ext' });

            expect(parseCriterion(null)).toEqual({ condition: '' });
            const critSimple = parseCriterion({
                context: '$statusCode',
                condition: '$statusCode == 200',
                type: 'simple',
                'x-crit': 1,
            });
            expect(critSimple.type).toBe('simple');
            expect(critSimple.extensions).toEqual({ 'x-crit': 1 });

            const critExpr = parseCriterion({
                condition: '$.count > 0',
                type: { type: 'jsonpath', version: 'RFC9535' },
            });
            expect(critExpr.type).toEqual({ type: 'jsonpath', version: 'RFC9535' });
        });

        it('should parse SuccessAction, FailureAction, Outputs, Step, Workflow, Components, and full ArazzoSpec', () => {
            expect(parseSuccessAction(null)).toEqual({ name: 'defaultSuccess', type: 'end' });
            const sa = parseSuccessAction({
                name: 'goNext',
                type: 'goto',
                workflowId: 'wf2',
                stepId: 's2',
                parameters: [{ name: 'p', in: 'header', value: 'v' }],
                criteria: [{ condition: '$statusCode == 200', type: 'regex' }],
                'x-sa': 1,
            });
            expect(sa.type).toBe('goto');
            expect(sa.workflowId).toBe('wf2');
            expect(sa.stepId).toBe('s2');
            expect(sa.parameters).toHaveLength(1);
            expect(sa.criteria).toHaveLength(1);
            expect(sa.extensions).toEqual({ 'x-sa': 1 });

            expect(parseSuccessActionOrReusable({ reference: '$components.successActions.endAct' })).toEqual({
                reference: '$components.successActions.endAct',
            });
            expect(parseSuccessActionOrReusable({ name: 'inlineSa', type: 'end' })).toEqual({
                name: 'inlineSa',
                type: 'end',
            });

            expect(parseFailureAction(null)).toEqual({ name: 'defaultFailure', type: 'end' });
            const fa = parseFailureAction({
                name: 'retryStep',
                type: 'retry',
                workflowId: 'wf1',
                stepId: 's1',
                retryAfter: 2.5,
                retryLimit: 3,
                parameters: [{ reference: '$components.parameters.p1' }],
                criteria: [{ condition: '$statusCode == 503', type: 'xpath' }],
                'x-fa': 2,
            });
            expect(fa.type).toBe('retry');
            expect(fa.retryAfter).toBe(2.5);
            expect(fa.retryLimit).toBe(3);
            expect(fa.extensions).toEqual({ 'x-fa': 2 });

            expect(parseFailureActionOrReusable({ reference: '$components.failureActions.retryAct' })).toEqual({
                reference: '$components.failureActions.retryAct',
            });
            expect(parseFailureActionOrReusable({ name: 'inlineFa', type: 'goto' })).toEqual({
                name: 'inlineFa',
                type: 'goto',
            });

            expect(parseArazzoOutputs(null)).toEqual({});
            const outs = parseArazzoOutputs({
                strOut: '$response.body#/id',
                nullOut: null,
                selOut: { context: '$response.body', selector: '/token', type: 'regex' },
            });
            expect(outs['strOut']).toBe('$response.body#/id');
            expect(outs['nullOut']).toBe('');
            expect(isSelectorObject(outs['selOut'])).toBe(true);

            expect(parseStep(null)).toEqual({ stepId: 'step' });
            const fullStep = parseStep({
                stepId: 's1',
                description: 'Step desc',
                operationId: 'op1',
                operationPath: '{$sourceDescriptions.api.url}#/paths/~1pets/get',
                channelPath: '/user/signedup',
                workflowId: 'subWf',
                parameters: [{ name: 'cookieParam', in: 'cookie', value: 'c' }],
                requestBody: { contentType: 'text/plain', payload: 'hello' },
                successCriteria: [{ condition: '$statusCode == 200' }],
                onSuccess: [{ name: 'ok', type: 'end' }],
                onFailure: [{ name: 'err', type: 'end' }],
                outputs: { token: '$response.body#/token' },
                timeout: 5000,
                correlationId: '$message.header#/corrId',
                action: 'receive',
                dependsOn: ['s0'],
                'x-step': true,
            });
            expect(fullStep.action).toBe('receive');
            expect(fullStep.timeout).toBe(5000);
            expect(fullStep.dependsOn).toEqual(['s0']);
            expect(fullStep.extensions).toEqual({ 'x-step': true });

            expect(parseWorkflow(null)).toEqual({ workflowId: 'workflow', steps: [] });
            const fullWf = parseWorkflow({
                workflowId: 'wf1',
                summary: 'Sum',
                description: 'Desc',
                inputs: { type: 'object', properties: { user: { type: 'string' } } },
                dependsOn: ['prereqWf'],
                steps: [{ stepId: 's1', action: 'send' }],
                successActions: [{ name: 'sa', type: 'end' }],
                failureActions: [{ name: 'fa', type: 'end' }],
                outputs: { res: '$steps.s1.outputs.val' },
                parameters: [{ name: 'p', in: 'query', value: 'v' }],
                'x-wf': 'meta',
            });
            expect(fullWf.workflowId).toBe('wf1');
            expect(fullWf.extensions).toEqual({ 'x-wf': 'meta' });

            expect(parseArazzoComponents(null)).toEqual({});
            const comp = parseArazzoComponents({
                inputs: { UserInput: { type: 'object' } },
                parameters: { SharedParam: { name: 'x', in: 'header', value: '1' } },
                successActions: { SharedSa: { name: 'sa', type: 'end' } },
                failureActions: { SharedFa: { name: 'fa', type: 'end' } },
                'x-comp': 1,
            });
            expect(comp.inputs?.['UserInput']).toBeDefined();
            expect(comp.parameters?.['SharedParam']?.name).toBe('x');
            expect(comp.successActions?.['SharedSa']?.name).toBe('sa');
            expect(comp.failureActions?.['SharedFa']?.name).toBe('fa');
            expect(comp.extensions).toEqual({ 'x-comp': 1 });

            expect(() => parseArazzoSpec('invalid: [')).toThrow('Invalid Arazzo specification format.');
            expect(() => parseArazzoSpec('{"openapi":"3.2.0"}')).toThrow('Invalid Arazzo specification format.');

            const spec = parseArazzoSpec(
                JSON.stringify({
                    arazzo: '1.1.0',
                    $self: 'https://example.com/arazzo.json',
                    info: { title: 'Test', version: '1.0.0' },
                    sourceDescriptions: [{ name: 'api', url: './openapi.json', type: 'openapi' }],
                    workflows: [{ workflowId: 'w1', steps: [{ stepId: 's1' }] }],
                    components: { parameters: { p1: { name: 'p1', in: 'query', value: 'v1' } } },
                    'x-root': 'val',
                }),
            );
            expect(spec.$self).toBe('https://example.com/arazzo.json');
            expect(spec.extensions).toEqual({ 'x-root': 'val' });

            // Test non-array sourceDescriptions and non-array workflows branch
            const specNoSd = parseArazzoSpec(
                JSON.stringify({
                    arazzo: '',
                    info: { title: 'NoSD', version: '1.0.0' },
                    sourceDescriptions: 'not-an-array',
                    workflows: [],
                }),
            );
            expect(specNoSd.arazzo).toBe('1.1.0');
            expect(specNoSd.sourceDescriptions).toEqual([]);
        });
    });

    describe('$components dereferencing and parameter merging', () => {
        const components = parseArazzoComponents({
            inputs: {
                AuthInput: { type: 'object', properties: { apiKey: { type: 'string' } } },
                RefInput: { $ref: '#/components/inputs/Other' },
            },
            parameters: {
                authHeader: { name: 'Authorization', in: 'header', value: 'Bearer default' },
            },
            successActions: {
                logAndEnd: { name: 'logAndEnd', type: 'end' },
            },
            failureActions: {
                retryThrice: { name: 'retryThrice', type: 'retry', retryLimit: 3 },
            },
        });

        it('should resolve reusable parameters, success actions, failure actions, and input schemas', () => {
            // Direct object pass-through
            const directParam: ArazzoParameterObject = { name: 'direct', in: 'query', value: '1' };
            expect(resolveArazzoReusableParameter(directParam, components)).toBe(directParam);

            // Found in components without override
            const resolved1 = resolveArazzoReusableParameter(
                { reference: '$components.parameters.authHeader' },
                components,
            );
            expect(resolved1).toEqual({ name: 'Authorization', in: 'header', value: 'Bearer default' });

            // Found in components with override
            const resolved2 = resolveArazzoReusableParameter(
                { reference: '$components.parameters.authHeader', value: 'Bearer custom' },
                components,
            );
            expect(resolved2.value).toBe('Bearer custom');

            // Unfound fallback with short reference and empty reference
            const missing1 = resolveArazzoReusableParameter({ reference: 'customRef', value: 42 }, components);
            expect(missing1).toEqual({ name: 'customRef', value: 42 });
            const missing2 = resolveArazzoReusableParameter({ reference: '' });
            expect(missing2).toEqual({ name: '', value: '' });

            // Success actions
            const directSa: SuccessActionObject = { name: 'directSa', type: 'end' };
            expect(resolveArazzoSuccessAction(directSa, components)).toBe(directSa);
            expect(
                resolveArazzoSuccessAction({ reference: '$components.successActions.logAndEnd' }, components),
            ).toEqual({ name: 'logAndEnd', type: 'end' });
            expect(resolveArazzoSuccessAction({ reference: 'missingSa' }, components)).toEqual({
                name: 'missingSa',
                type: 'end',
            });
            expect(resolveArazzoSuccessAction({ reference: '' })).toEqual({ name: '', type: 'end' });

            // Failure actions
            const directFa: FailureActionObject = { name: 'directFa', type: 'end' };
            expect(resolveArazzoFailureAction(directFa, components)).toBe(directFa);
            expect(
                resolveArazzoFailureAction({ reference: '$components.failureActions.retryThrice' }, components),
            ).toEqual({ name: 'retryThrice', type: 'retry', retryLimit: 3 });
            expect(resolveArazzoFailureAction({ reference: 'missingFa' }, components)).toEqual({
                name: 'missingFa',
                type: 'end',
            });
            expect(resolveArazzoFailureAction({ reference: '' })).toEqual({ name: '', type: 'end' });

            // Workflow input schemas
            expect(resolveWorkflowInputSchema(undefined, components)).toBeUndefined();
            const inlineSchema = { type: 'object' };
            expect(resolveWorkflowInputSchema(inlineSchema, components)).toBe(inlineSchema);
            expect(resolveWorkflowInputSchema({ $ref: '#/components/inputs/AuthInput' }, components)).toEqual({
                type: 'object',
                properties: { apiKey: { type: 'string' } },
            });
            expect(
                resolveWorkflowInputSchema({ $ref: '$components.inputs.Missing', description: 'Desc' }, components),
            ).toEqual({
                type: 'object',
                title: 'Missing',
                description: 'Desc',
            });
            expect(resolveWorkflowInputSchema({ $ref: 'PlainRef' }, components)).toEqual({
                type: 'object',
                title: 'PlainRef',
                description: undefined,
            });
            expect(resolveWorkflowInputSchema({ $ref: '' }, components)).toEqual({
                type: 'object',
                title: '',
                description: undefined,
            });
        });

        it('should merge workflow and step parameters with override semantics', () => {
            const wfParams = [
                { reference: '$components.parameters.authHeader' },
                { name: 'tenant', value: 'defaultTenant' },
            ];
            const stepParams: ArazzoParameterObject[] = [
                { name: 'Authorization', in: 'header', value: 'Bearer stepToken' },
                { name: 'tenant', value: 'stepTenant' },
                { name: 'extra', in: 'query', value: '1' },
            ];
            const merged = mergeWorkflowAndStepParameters(wfParams, stepParams, components);
            expect(merged).toHaveLength(3);
            expect(merged.find(p => p.name === 'Authorization')?.value).toBe('Bearer stepToken');
            expect(merged.find(p => p.name === 'tenant')?.value).toBe('stepTenant');
            expect(merged.find(p => p.name === 'extra')?.value).toBe('1');
            expect(mergeWorkflowAndStepParameters(undefined, undefined)).toEqual([]);
        });
    });

    describe('runtime expressions, DAG construction, and operation linking', () => {
        it('should parse all 17 runtime expression roots and embedded templates', () => {
            expect(parseRuntimeExpression('$url').root).toBe('$url');
            expect(parseRuntimeExpression('$method').root).toBe('$method');
            expect(parseRuntimeExpression('$statusCode').root).toBe('$statusCode');
            expect(parseRuntimeExpression('$request.header.accept').root).toBe('$request.header');
            expect(parseRuntimeExpression('$request.query.page').root).toBe('$request.query');
            expect(parseRuntimeExpression('$request.path.id').root).toBe('$request.path');
            expect(parseRuntimeExpression('$request.body#/user/id').root).toBe('$request.body');
            expect(parseRuntimeExpression('$response.header.x-rate').root).toBe('$response.header');
            expect(parseRuntimeExpression('$response.query.q').root).toBe('$response.query');
            expect(parseRuntimeExpression('$response.path.id').root).toBe('$response.path');
            expect(parseRuntimeExpression('$response.body#/data/token').jsonPointer).toBe('/data/token');
            expect(parseRuntimeExpression('$message.header#/corr').root).toBe('$message.header');
            expect(parseRuntimeExpression('$message.payload#/item').root).toBe('$message.payload');
            expect(parseRuntimeExpression('$message.body#/event').root).toBe('$message.body');
            expect(parseRuntimeExpression('$outputs.result').root).toBe('$outputs');
            expect(parseRuntimeExpression('$components.parameters.p').root).toBe('$components');

            const complex = parseRuntimeExpression(
                'Bearer {$steps.login.outputs.token} for {$inputs.userId} in {$workflows.setup.outputs.env} via {$sourceDescriptions.petstore.url}#/paths/~1pets/get',
            );
            expect(complex.isExpression).toBe(true);
            expect(complex.isTemplate).toBe(true);
            expect(complex.referencedStepIds).toEqual(['login']);
            expect(complex.referencedInputs).toEqual(['userId']);
            expect(complex.referencedWorkflows).toEqual(['setup']);
            expect(complex.referencedSources).toEqual(['petstore']);
            expect(complex.jsonPointer).toBe('/paths/~1pets/get');

            const literal = parseRuntimeExpression('plain string value');
            expect(literal.isExpression).toBe(false);
            expect(literal.isTemplate).toBe(false);
        });

        it('should extract step references from all step fields and build DAGs with cycle detection', () => {
            expect(unescapeJsonPointer('~1pets~1~0id')).toBe('/pets/~id');

            const step = parseStep({
                stepId: 's2',
                dependsOn: ['s0'],
                parameters: [
                    { name: 'a', in: 'query', value: ['$steps.s1.outputs.x', { nested: '$steps.s2.outputs.self' }] },
                    {
                        name: 'b',
                        in: 'query',
                        value: { context: '$steps.s3.outputs.body', selector: '$steps.s4.outputs.ptr' },
                    },
                ],
                requestBody: {
                    payload: { ref: '$steps.s5.outputs.p' },
                    replacements: [{ target: '/a', value: '$steps.s6.outputs.r' }],
                },
                successCriteria: [
                    { context: '$steps.s7.outputs.status', condition: '$steps.s8.outputs.ok == true' },
                    { condition: '$statusCode == 200' },
                ],
                outputs: {
                    out1: '$steps.s9.outputs.val',
                },
                correlationId: '$steps.s10.outputs.corr',
            });
            const merged = mergeWorkflowAndStepParameters(undefined, step.parameters);
            const refs = extractStepReferencesFromStep(step, merged);
            expect(refs).toEqual(['s0', 's1', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10']);

            // Build DAG with normal dependencies + cycles
            const workflows = [
                parseWorkflow({
                    workflowId: 'wfA',
                    dependsOn: ['$sourceDescriptions.ext.workflows.wfB'],
                    steps: [
                        {
                            stepId: 'step1',
                            dependsOn: ['step2'],
                            onSuccess: [{ name: 'jump', type: 'goto', stepId: 'step2' }],
                            onFailure: [{ name: 'retryJump', type: 'retry', stepId: 'step1' }],
                        },
                        {
                            stepId: 'step2',
                            dependsOn: ['step1'],
                            workflowId: '$sourceDescriptions.ext.workflows.wfB',
                            parameters: [{ name: 'p', value: '$steps.step1.outputs.v' }],
                        },
                    ],
                }),
                parseWorkflow({
                    workflowId: 'wfB',
                    dependsOn: ['wfA'],
                    steps: [{ stepId: 'b1' }, { stepId: 'b2', workflowId: 'wfC' }],
                }),
                parseWorkflow({
                    workflowId: 'wfC',
                    steps: [{ stepId: 'c1' }],
                }),
            ];

            const dag = buildWorkflowDag(workflows);
            expect(dag.hasCycles).toBe(true);
            expect(dag.workflowOrder).toContain('wfA');
            expect(dag.workflowOrder).toContain('wfB');
            expect(dag.workflowOrder).toContain('wfC');
            expect(dag.stepOrderByWorkflow['wfA']).toEqual(['step1', 'step2']);
            expect(dag.stepOrderByWorkflow['wfB']).toEqual(['b1', 'b2']);

            const acyclicDag = buildWorkflowDag([
                parseWorkflow({
                    workflowId: 'acyclic1',
                    dependsOn: ['acyclic1'],
                    steps: [
                        { stepId: 's1' },
                        {
                            stepId: 's2',
                            dependsOn: ['s1', 's2', 'nonExistentStep'],
                            parameters: [{ name: 'p', value: '$steps.s1.outputs.v' }],
                            onSuccess: [{ name: 'endSa', type: 'end' }],
                            onFailure: [{ name: 'endFa', type: 'end' }],
                        },
                    ],
                }),
                parseWorkflow({
                    workflowId: 'acyclic2',
                    dependsOn: ['acyclic1'],
                    steps: [
                        { stepId: 's3', workflowId: 'acyclic1' },
                        { stepId: 's4', dependsOn: ['s5'], parameters: [{ name: 'p', value: '$steps.s3.outputs.v' }] },
                        { stepId: 's5', dependsOn: ['s4'] },
                        { stepId: 's6', parameters: [{ name: 'p', value: '$steps.s3.outputs.v' }] },
                    ],
                }),
            ]);
            expect(acyclicDag.hasCycles).toBe(true);
            expect(acyclicDag.workflowOrder).toEqual(['acyclic1', 'acyclic2']);
        });

        it('should link steps to OpenAPI operations, webhooks, AsyncAPI channels, and sub-workflows', () => {
            const openApiSpec: OpenAPI320 = {
                openapi: '3.2.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {
                    '/pets': {
                        get: { operationId: 'listPets', responses: {} },
                        post: { responses: {} },
                    },
                    '/ref': { $ref: '#/components/pathItems/Ref' },
                },
                webhooks: {
                    petCreated: {
                        post: { operationId: 'onPetCreated', responses: {} },
                    },
                    refWebhook: { $ref: '#/components/pathItems/RefWh' },
                },
            };
            const sds: SourceDescriptionObject[] = [{ name: 'petstore', url: './openapi.json', type: 'openapi' }];

            // 1. Sub-workflow (prefixed and plain)
            const wfLink1 = linkStepToOpenApiOperation(
                { stepId: 's', workflowId: '$sourceDescriptions.auth.workflows.loginWf' },
                openApiSpec,
                sds,
            );
            expect(wfLink1).toEqual({
                kind: 'workflow',
                sourceName: 'auth',
                operationId: 'loginWf',
                anchorId: 'workflow-loginWf',
            });

            const wfLink2 = linkStepToOpenApiOperation({ stepId: 's', workflowId: 'localWf' }, openApiSpec, sds);
            expect(wfLink2?.sourceName).toBe('petstore');
            expect(wfLink2?.operationId).toBe('localWf');

            // 2. AsyncAPI channelPath
            const chLink1 = linkStepToOpenApiOperation(
                {
                    stepId: 's',
                    channelPath: '{$sourceDescriptions.events.url}#/channels/~1users~1signedup',
                    action: 'receive',
                },
                openApiSpec,
                sds,
            );
            expect(chLink1).toEqual({
                kind: 'channel',
                sourceName: 'events',
                method: 'receive',
                route: '/users/signedup',
            });

            const chLink2 = linkStepToOpenApiOperation(
                { stepId: 's', channelPath: '#/messages/userEvent' },
                openApiSpec,
            );
            expect(chLink2?.route).toBe('/messages/userEvent');
            expect(chLink2?.method).toBe('send');

            const chLink3 = linkStepToOpenApiOperation({ stepId: 's', channelPath: 'rawChannel' }, openApiSpec);
            expect(chLink3?.route).toBe('rawChannel');

            // 3. operationPath (paths, webhooks, and unresolvable)
            const opPath1 = linkStepToOpenApiOperation(
                { stepId: 's', operationPath: '{$sourceDescriptions.petstore.url}#/paths/~1pets/get' },
                openApiSpec,
                sds,
            );
            expect(opPath1).toEqual({
                kind: 'operation',
                sourceName: 'petstore',
                method: 'get',
                route: '/pets',
                operationId: 'listPets',
                anchorId: 'listPets',
            });

            const opPathNoOpId = linkStepToOpenApiOperation(
                { stepId: 's', operationPath: '#/paths/~1pets/post' },
                openApiSpec,
                sds,
            );
            expect(opPathNoOpId?.anchorId).toBe('post-/pets');

            const opPathWebhook = linkStepToOpenApiOperation(
                { stepId: 's', operationPath: '#/webhooks/petCreated/post' },
                openApiSpec,
                sds,
            );
            expect(opPathWebhook?.operationId).toBe('onPetCreated');

            const opPathMethodMismatch = linkStepToOpenApiOperation(
                { stepId: 's', operationPath: '#/paths/~1pets/delete' },
                openApiSpec,
                sds,
            );
            expect(opPathMethodMismatch?.operationId).toBeUndefined();

            const opPathOtherPointer = linkStepToOpenApiOperation(
                { stepId: 's', operationPath: '#/components/schemas/Pet' },
                openApiSpec,
                sds,
            );
            expect(opPathOtherPointer?.route).toBe('#/components/schemas/Pet');
            expect(opPathOtherPointer?.method).toBe('get');

            const opPathNoPointer = linkStepToOpenApiOperation(
                { stepId: 's', operationPath: 'plainOperationPath' },
                openApiSpec,
                sds,
            );
            expect(opPathNoPointer?.route).toBe('plainOperationPath');

            // 4. operationId (prefixed, in paths, in webhooks, and unresolved)
            const opId1 = linkStepToOpenApiOperation(
                { stepId: 's', operationId: '$sourceDescriptions.petstore.listPets' },
                openApiSpec,
                sds,
            );
            expect(opId1?.route).toBe('/pets');
            expect(opId1?.method).toBe('get');

            const opIdWh = linkStepToOpenApiOperation({ stepId: 's', operationId: 'onPetCreated' }, openApiSpec, sds);
            expect(opIdWh?.route).toBe('petCreated');

            const opIdUnresolved = linkStepToOpenApiOperation(
                { stepId: 's', operationId: 'unknownOp' },
                openApiSpec,
                sds,
            );
            expect(opIdUnresolved).toEqual({
                kind: 'operation',
                sourceName: 'petstore',
                operationId: 'unknownOp',
                anchorId: 'unknownOp',
            });

            // 5. Empty step
            expect(linkStepToOpenApiOperation({ stepId: 'empty' }, openApiSpec)).toBeUndefined();
        });

        it('should generate workflow CLI previews and normalize workflows end-to-end', () => {
            const arazzo = parseArazzoSpec(
                JSON.stringify({
                    arazzo: '1.1.0',
                    info: { title: 'EndToEnd', version: '1.0.0' },
                    sourceDescriptions: [{ name: 'api', url: 'https://api.example.com/' }],
                    workflows: [
                        {
                            workflowId: 'fullWf',
                            summary: 'Full summary',
                            dependsOn: ['initWf'],
                            parameters: [{ name: 'X-Trace', in: 'header', value: 'trace-1' }],
                            successActions: [{ name: 'wfSa', type: 'end' }],
                            failureActions: [{ name: 'wfFa', type: 'end' }],
                            steps: [
                                {
                                    stepId: 'subWfStep',
                                    description: 'Run sub workflow',
                                    workflowId: 'initWf',
                                    onSuccess: [{ name: 'stepSa', type: 'end' }],
                                    onFailure: [{ name: 'stepFa', type: 'end' }],
                                },
                                {
                                    stepId: 'channelStep',
                                    channelPath: '/events',
                                },
                                {
                                    stepId: 'httpPostStep',
                                    dependsOn: ['httpPostStep', 'nonExistentStep'],
                                    operationPath: '#/paths/~1items/post',
                                    parameters: [
                                        {
                                            name: 'X-Sel',
                                            in: 'header',
                                            value: { context: '$response.body', selector: '/hdr' },
                                        },
                                        {
                                            name: 'limit',
                                            in: 'query',
                                            value: 10,
                                        },
                                    ],
                                    requestBody: {
                                        contentType: 'application/json',
                                        payload: { item: 'book' },
                                    },
                                },
                                {
                                    stepId: 'httpEmptyBodyStep',
                                    operationId: 'emptyBodyOp',
                                    requestBody: {},
                                },
                                {
                                    stepId: 'httpRawBodyStep',
                                    operationId: 'rawOp',
                                    requestBody: {
                                        payload: 'raw-string-payload',
                                    },
                                },
                                {
                                    stepId: 'bareStep',
                                },
                            ],
                        },
                    ],
                }),
            );

            const openApiSpec: OpenAPI320 = {
                openapi: '3.2.0',
                info: { title: 'API', version: '1.0.0' },
                servers: [{ url: 'https://api.example.com/' }],
                paths: {
                    '/items': {
                        post: { operationId: 'createItem', responses: {} },
                    },
                },
            };

            const normalized = normalizeArazzoWorkflows(arazzo, openApiSpec);
            expect(normalized).toHaveLength(1);
            const preview = normalized[0]!.cliPreview;
            expect(preview).toContain('# Workflow: fullWf');
            expect(preview).toContain('# Full summary');
            expect(preview).toContain('# Prerequisites: initWf');
            expect(preview).toContain('cdd-ctl run-workflow --workflow-id "initWf"');
            expect(preview).toContain('# AsyncAPI SEND on channel /events');
            expect(preview).toContain('curl -s -X POST "https://api.example.com/items"');
            expect(preview).toContain('-H "X-Trace: trace-1"');
            expect(preview).toContain('-H "X-Sel: /hdr"');
            expect(preview).toContain(`-d '{"item":"book"}'`);
            expect(preview).toContain(`-d 'raw-string-payload'`);
            expect(preview).toContain('curl -s "https://api.example.com/bareStep"');

            const directPreview = generateWorkflowCliPreview(arazzo.workflows[0]!, normalized[0]!.normalizedSteps);
            expect(directPreview).toContain('https://api.example.com/items');
        });
    });
});
