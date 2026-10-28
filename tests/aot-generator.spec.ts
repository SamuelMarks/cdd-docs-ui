/**
 * Unit tests for AOT HTML and CSS documentation generator (`src/aot-generator.ts`).
 * @module aot-generator.spec
 */
import { describe, it, expect } from 'vitest';
import {
    generateAOTHtml,
    generateAOTBodyAndStyles,
    renderMarkdown,
    escapeHtml,
    sanitizeUrl,
    sanitizeCssIdent,
    interpolateServerVariables,
    resolveParameterRef,
    resolveOperationParameters,
    resolveRequestBodyRef,
    resolveResponseRef,
    generateCurl,
    renderSchema,
    renderArazzoValue,
    formatCriterionType,
    renderWorkflowSection,
    renderArazzoComponents,
} from '../src/aot-generator';
import { CodeExample } from '../src/types';

describe('escapeHtml', () => {
    it('should escape HTML special characters safely', () => {
        expect(escapeHtml(`<script>alert("xss" & 'bad')</script>`)).toBe(
            '&lt;script&gt;alert(&quot;xss&quot; &amp; &#39;bad&#39;)&lt;/script&gt;',
        );
    });
});

describe('renderMarkdown', () => {
    it('should render empty string when text is undefined or empty', () => {
        expect(renderMarkdown(undefined)).toBe('');
        expect(renderMarkdown('')).toBe('');
    });

    it('should render basic markdown features', () => {
        expect(renderMarkdown('**bold**').trim()).toBe('<p><strong>bold</strong></p>');
        expect(renderMarkdown('__bold__').trim()).toBe('<p><strong>bold</strong></p>');
        expect(renderMarkdown('*italic*').trim()).toBe('<p><em>italic</em></p>');
        expect(renderMarkdown('_italic_').trim()).toBe('<p><em>italic</em></p>');
        expect(renderMarkdown('[link](https://example.com)').trim()).toBe(
            '<p><a href="https://example.com">link</a></p>',
        );
        expect(renderMarkdown('line1\n\nline2').trim()).toBe('<p>line1</p>\n<p>line2</p>');
        expect(renderMarkdown('line1\nline2').trim()).toBe('<p>line1\nline2</p>');
        expect(
            renderMarkdown('<script>alert(1)</script><p onclick="bad()">safe</p>[bad](javascript:alert(1))'),
        ).not.toContain('<script>');
        expect(renderMarkdown('<p onclick="bad()">safe</p>')).not.toContain('onclick');
        expect(renderMarkdown('[bad](javascript:alert(1))')).toContain('href="#"');
        expect(renderMarkdown("<a href='javascript:alert(1)'>bad</a>")).toContain("href='#'");
    });

    it('should not break links when using italics', () => {
        const text = `[link](https://example.com) and some _italic_ text`;
        expect(renderMarkdown(text).trim()).toBe(
            '<p><a href="https://example.com">link</a> and some <em>italic</em> text</p>',
        );
    });

    it('should render unordered lists', () => {
        const text = `- item 1
- item 2`;
        const expected = `<ul>
<li>item 1</li>
<li>item 2</li>
</ul>`;
        expect(renderMarkdown(text).trim()).toBe(expected);
    });

    it('should render ordered lists', () => {
        const text = `1. item 1
2. item 2`;
        const expected = `<ol>
<li>item 1</li>
<li>item 2</li>
</ol>`;
        expect(renderMarkdown(text).trim()).toBe(expected);
    });
});

describe('generateCurl & renderSchema', () => {
    it('should normalize baseUrl trailing slash and include custom server URL', () => {
        const cmd = generateCurl('post', '/pets', {}, 'https://custom.api.org/');
        expect(cmd).toBe('curl -X POST "https://custom.api.org/pets"');
    });

    it('should guard against excessive recursion depth in renderSchema', () => {
        const out = renderSchema({ type: 'object' }, 11, 'deep');
        expect(out).toBe('<span class="cdd-prop-type">object</span>');
    });

    it('should handle reference with empty trailing slash and reference property in object schema', () => {
        const refOut = renderSchema({ $ref: '' });
        expect(refOut).toContain('cdd-schema-ref');

        const propWithoutPrefix = renderSchema({
            type: 'object',
            required: ['refProp'],
            properties: {
                refProp: { $ref: '#/components/schemas/SubModel', description: 'Ref desc' },
                emptyRefProp: { $ref: '' },
                arrProp: { type: 'array', items: { type: 'string' } },
            },
        });
        expect(propWithoutPrefix).toContain('id="prop-refProp"');
        expect(propWithoutPrefix).toContain('SubModel');
        expect(propWithoutPrefix).toContain('Ref desc');
        expect(propWithoutPrefix).toContain('Array of:');
    });
});

describe('aot-generator', () => {
    it('should handle termsOfService and contact info in header across all contact variants', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Full Info API
  version: 1.0.0
  termsOfService: https://example.com/terms
  contact:
    name: API Support
    url: https://example.com/support
    email: support@example.com
paths: {}
`;
        const html = generateAOTHtml(yamlStr);
        expect(html).toContain('<a href="https://example.com/terms" target="_blank">Terms of Service</a>');
        expect(html).toContain('Contact: <a href="https://example.com/support" target="_blank">API Support</a>');

        const yamlUrlNoName = `
openapi: 3.0.0
info:
  title: Full Info API
  version: 1.0.0
  contact:
    url: https://example.com/support
paths: {}
`;
        const htmlUrlNoName = generateAOTHtml(yamlUrlNoName);
        expect(htmlUrlNoName).toContain(
            'Contact: <a href="https://example.com/support" target="_blank">API Support</a>',
        );

        const yamlEmailOnly = `
openapi: 3.0.0
info:
  title: Full Info API
  version: 1.0.0
  contact:
    email: just@email.com
paths: {}
`;
        const html2 = generateAOTHtml(yamlEmailOnly);
        expect(html2).toContain('Contact: <a href="mailto:just@email.com">just@email.com</a>');

        const yamlEmailAndName = `
openapi: 3.0.0
info:
  title: Full Info API
  version: 1.0.0
  contact:
    name: NamedEmail
    email: named@email.com
paths: {}
`;
        const htmlEmailNamed = generateAOTHtml(yamlEmailAndName);
        expect(htmlEmailNamed).toContain('Contact: <a href="mailto:named@email.com">NamedEmail</a>');

        const yamlNameOnly = `
openapi: 3.0.0
info:
  title: Full Info API
  version: 1.0.0
  contact:
    name: OnlyName
paths: {}
`;
        const html3 = generateAOTHtml(yamlNameOnly);
        expect(html3).toContain('Contact: OnlyName');

        const yamlEmptyContact = `
openapi: 3.0.0
info:
  title: Full Info API
  version: 1.0.0
  contact: {}
paths: {}
`;
        const htmlEmptyContact = generateAOTHtml(yamlEmptyContact);
        expect(htmlEmptyContact).toContain('Contact: API Support');
    });

    it('should generate HTML correctly from valid spec and examples', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.1
servers:
  - url: https://api.test.io
paths:
  /users:
    get:
      operationId: getUsers
      summary: Get users
      description: Retrieve all users
      parameters:
        - name: limit
          in: query
          required: false
          schema:
            type: integer
      responses:
        "200":
          description: A list of users
`;
        const sdkExamples: CodeExample[] = [
            { language: 'rust', filepath: 'getUsers.rs', content: 'fn get_users() {}' },
        ];

        const html = generateAOTHtml(yamlStr, sdkExamples, 'light');
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('Test API');
        expect(html).toContain('Get users');
        expect(html).toContain('Retrieve all users');
        expect(html).toContain('https://api.test.io/users');
        expect(html).toContain('fn get_users() {}');
        expect(html).toContain('cURL');
        expect(html).toContain('SDK');
        expect(html).toContain('cdd-layout');
        expect(html).toContain('cdd-badge-get cdd-badge-GET');
        expect(html).toContain('--cdd-primary: #005ac1');
    });

    it('should support custom translations across all UI elements', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Translated API
  version: 1.0.0
  termsOfService: https://example.com/tos
paths:
  /items:
    get:
      parameters:
        - name: q
          in: query
          schema:
            type: string
components:
  schemas:
    Item:
      type: object
      properties:
        id:
          type: string
`;
        const html = generateAOTHtml(yamlStr, [], 'light', false, {
            locale: 'fr',
            tableHeaderProperty: 'Propriete',
            tableHeaderName: 'Nom',
            tabCurl: 'Requete cURL',
            tabSdk: 'Code SDK',
            termsOfService: 'Conditions',
            appearanceHeading: 'Apparence',
            tocNavLabel: 'Sommaire',
        });
        expect(html).toContain('<html lang="fr"');
        expect(html).toContain('<th>Propriete</th>');
        expect(html).toContain('<th>Nom</th>');
        expect(html).toContain('Requete cURL');
        expect(html).toContain('Code SDK');
        expect(html).toContain('Conditions');
        expect(html).toContain('Apparence');
        expect(html).toContain('aria-label="Sommaire"');
    });

    it('should escape XSS payloads in code examples, titles, and summaries', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: <script>alert(1)</script>
  version: 1.0.0
paths:
  /xss:
    get:
      operationId: getXss
      summary: <img src=x onerror=alert(1)>
`;
        const examples: CodeExample[] = [
            {
                language: 'javascript',
                filepath: 'getXss.js',
                content: 'const x = "<script>evil()</script>";',
            },
        ];
        const html = generateAOTHtml(yamlStr, examples);
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(html).toContain('&lt;script&gt;evil()&lt;/script&gt;');
    });

    it('should handle dark theme', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
`;
        const html = generateAOTHtml(yamlStr, [], 'dark');
        expect(html).toContain('--cdd-primary: #adc6ff');
        expect(html).toContain('id="opt-dark-mode" class="cdd-visually-hidden" checked');
    });

    it('should render schemas correctly', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Schema API
  version: 1.0.0
components:
  schemas:
    User:
      type: object
      required:
        - id
      properties:
        id:
          type: integer
        name:
          type: string
        untypedProp: {}
`;
        const html = generateAOTHtml(yamlStr);
        expect(html).toContain('User');
        expect(html).toContain('cdd-schema-table');
        expect(html).toContain('id<span class="cdd-required">*</span>');
        expect(html).toContain('name');
        expect(html).toContain('untypedProp');
    });

    it('should handle references in schemas', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Ref API
  version: 1.0.0
components:
  schemas:
    User:
      $ref: "#/components/schemas/Profile"
    Profile:
      type: object
      properties:
        bio:
          type: string
`;
        const html = generateAOTHtml(yamlStr);
        expect(html).toContain('<span class="cdd-schema-ref">Profile</span>');
    });

    it('should handle request body and headers in generateCurl and Try It Out', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Curl API
  version: 1.0.0
paths:
  /test/{id}:
    post:
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
        - name: X-Header
          in: header
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
      responses:
        "200":
          description: OK
`;
        const html = generateAOTHtml(yamlStr);
        expect(html).toContain('-H &quot;X-Header: &lt;value&gt;&quot;');
        expect(html).toContain('-H &quot;Content-Type: application/json&quot;');
        expect(html).toContain('-d &#39;{&quot;key&quot;: &quot;value&quot;}&#39;');
        expect(html).toContain('cdd-try-form');
        expect(html).toContain('method="POST"');
        expect(html).toContain('data-in="path"');
        expect(html).toContain('data-in="header"');
        expect(html).toContain('try-post-/test/{id}-id');
        expect(html).toContain('try-post-/test/{id}-body');
    });

    it('should handle array schemas', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Array API
  version: 1.0.0
components:
  schemas:
    List:
      type: array
      items:
        type: string
`;
        const html = generateAOTHtml(yamlStr);
        expect(html).toContain('Array of:');
    });

    it('should handle nested schemas', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Nested API
  version: 1.0.0
components:
  schemas:
    Company:
      type: object
      properties:
        ceo:
          type: object
          properties:
            name:
              type: string
`;
        const html = generateAOTHtml(yamlStr);
        expect(html).toContain('ceo');
        expect(html).toContain('name');
        expect(html).toContain('id="schema-Company-prop-ceo"');
        expect(html).toContain('id="schema-Company-prop-ceo-prop-name"');
        expect(html).toContain('class="cdd-anchor"');
    });

    it('should generate parameter deep links', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Param API
  version: 1.0.0
paths:
  /test:
    get:
      operationId: getTest
      parameters:
        - name: id
          in: query
          schema:
            type: string
`;
        const html = generateAOTHtml(yamlStr);
        expect(html).toContain('id="getTest-param-id"');
    });

    it('should skip path item references and parameter references', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Ref Skip API
  version: 1.0.0
paths:
  /ref:
    $ref: "#/components/pathItems/Item"
  /params:
    get:
      parameters:
        - $ref: "#/components/parameters/Id"
      responses:
        "200":
          description: OK
`;
        const html = generateAOTHtml(yamlStr);
        expect(html).toContain('/params');
        expect(html).not.toContain('/ref');
    });

    it('should handle path item with no methods', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Empty Path API
  version: 1.0.0
paths:
  /empty:
    summary: No methods here
`;
        const html = generateAOTHtml(yamlStr);
        expect(html).not.toContain('/empty');
    });

    it('should handle schema with no type or unknown type', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Unknown Type API
  version: 1.0.0
components:
  schemas:
    Unknown:
      description: Just a description
`;
        const html = generateAOTHtml(yamlStr);
        expect(html).toContain('any');
        expect(html).toContain('Just a description');
    });

    it('should handle request body with no content in generateCurl', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Empty Curl API
  version: 1.0.0
paths:
  /empty-body:
    post:
      requestBody:
        content: {}
      responses:
        "200":
          description: OK
`;
        const html = generateAOTHtml(yamlStr);
        expect(html).toContain('/empty-body');
        expect(html).not.toContain('-H &quot;Content-Type:');
    });
});

describe('aot-generator-code-variants', () => {
    it('should handle all 4 combinations of includeImports and includeWrapping', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Variant API
  version: 1.0.0
paths:
  /test:
    get:
      operationId: test
`;
        const sdkExamples: CodeExample[] = [
            {
                language: 'ts',
                filepath: 'test.ts',
                content: `import sdk
sdk.test()`,
                includeImports: true,
                includeWrapping: false,
            },
            {
                language: 'ts',
                filepath: 'test.ts',
                content: `import sdk
function run() { sdk.test() }`,
                includeImports: true,
                includeWrapping: true,
            },
            {
                language: 'sh',
                filepath: 'test.sh',
                content: 'curl test',
                includeImports: false,
                includeWrapping: false,
            },
            {
                language: 'python',
                filepath: 'test.py',
                content: 'def run(): pass',
                includeImports: false,
                includeWrapping: true,
            },
        ];

        const html = generateAOTHtml(yamlStr, sdkExamples);
        expect(html).toContain('language-typescript');
        expect(html).toContain('language-bash');
        expect(html).toContain('language-python');
        expect(html).toContain('cdd-show-if-imports cdd-hide-if-wrapping');
        expect(html).toContain('cdd-show-if-imports cdd-show-if-wrapping');
        expect(html).toContain('cdd-hide-if-imports cdd-hide-if-wrapping');
        expect(html).toContain('cdd-hide-if-imports cdd-show-if-wrapping');
    });

    it('should handle parameters without schemas', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: No Schema Param
  version: 1.0.0
paths:
  /test:
    get:
      parameters:
        - name: p1
          in: query
          required: true
`;
        const html = generateAOTHtml(yamlStr);
        expect(html).toContain('p1*');
        expect(html).toContain('<td>any</td>');
    });

    it('should fallback when no language examples are provided or unmatched language exists', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Empty Lang
  version: 1.0.0
paths:
  /test:
    get:
      operationId: op1
`;
        const htmlEmpty = generateAOTHtml(yamlStr, []);
        expect(htmlEmpty).toContain('No example for javascript');

        const htmlUnmatched = generateAOTHtml(yamlStr, [
            { language: 'rust', filepath: 'other_op.rs', content: 'fn other() {}' },
        ]);
        expect(htmlUnmatched).toContain('No example for rust');
    });

    it('should handle empty object schema types', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Empty Obj
  version: 1.0.0
components:
  schemas:
    EmptyType:
      type: object
`;
        const html = generateAOTHtml(yamlStr);
        expect(html).toContain('EmptyType');
        expect(html).toContain('<span class="cdd-prop-type">object</span>');
    });

    it('should handle full arrays and primitive schemas', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Arr API
  version: 1.0.0
components:
  schemas:
    JustString:
      type: string
      description: "A simple string"
    ArrOfArr:
      type: array
      items:
        type: array
        items:
          type: string
`;
        const html = generateAOTHtml(yamlStr);
        expect(html).toContain('A simple string');
        expect(html).toContain('Array of:');
    });

    it('should handle request bodies that are references and parameter references', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Ref Test
  version: 1.0.0
paths:
  /test:
    parameters:
      - name: sharedParam
        in: header
        schema:
          type: string
    post:
      parameters:
        - $ref: "#/components/parameters/Test"
        - $ref: "#/components/parameters/MissingParam"
      requestBody:
        $ref: "#/components/requestBodies/Test"
      responses:
        "200":
          $ref: "#/components/responses/OkResp"
        "404":
          $ref: "#/components/responses/MissingResp"
components:
  parameters:
    Test:
      name: test
      in: query
      schema:
        type: string
  requestBodies:
    Test:
      description: test body
      content:
        application/json:
          schema:
            type: object
            properties:
              fieldA:
                type: string
  responses:
    OkResp:
      description: Resolved OK response
      content:
        application/json:
          schema:
            type: string
`;
        const html = generateAOTHtml(yamlStr);
        expect(html).toContain('post-/test-param-test');
        expect(html).toContain('post-/test-param-sharedParam');
        expect(html).toContain('try-post-/test-body');
        expect(html).toContain('test body');
        expect(html).toContain('fieldA');
        expect(html).toContain('Resolved OK response');
    });

    it('should inject live reload script when requested', () => {
        const yamlStr = `
openapi: 3.0.0
info:
  title: Watch API
  version: 1.0.0
`;
        const htmlWith = generateAOTHtml(yamlStr, [], 'light', true);
        expect(htmlWith).toContain('/__livereload');

        const htmlWithout = generateAOTHtml(yamlStr, [], 'light', false);
        expect(htmlWithout).not.toContain('/__livereload');
    });

    it('should render Arazzo values, criterion types, Arazzo components, webhooks, and full workflow sections', () => {
        expect(renderArazzoValue('plain-str')).toBe('<code>plain-str</code>');
        expect(renderArazzoValue({ a: 1 })).toBe('<code>{&quot;a&quot;:1}</code>');
        expect(renderArazzoValue({ context: '$response.body', selector: '/id' })).toContain('jsonpointer');
        expect(
            renderArazzoValue({
                context: '$response.body',
                selector: '$.id',
                type: { type: 'jsonpath', version: 'RFC9535' },
            }),
        ).toContain('jsonpath (RFC9535)');

        expect(formatCriterionType({ condition: 'true' })).toBe('simple');
        expect(formatCriterionType({ condition: 'true', type: 'regex' })).toBe('regex');
        expect(
            formatCriterionType({
                condition: '$.a',
                type: { type: 'jsonpath', version: 'RFC9535' },
            }),
        ).toBe('jsonpath (RFC9535)');

        expect(renderArazzoComponents(undefined)).toBe('');
        expect(renderArazzoComponents({})).toBe('');
        const compHtml = renderArazzoComponents({
            inputs: { UserIn: { type: 'object', properties: { name: { type: 'string' } } } },
            parameters: {
                Param1: { name: 'p1', in: 'header', value: 'v1' },
                Param2: { name: 'p2', value: 'v2' },
            },
            successActions: { Sa1: { name: 'sa1', type: 'end' } },
            failureActions: { Fa1: { name: 'fa1', type: 'retry' } },
        });
        expect(compHtml).toContain('$components.inputs.UserIn');
        expect(compHtml).toContain('$components.parameters');
        expect(compHtml).toContain('$components.successActions');
        expect(compHtml).toContain('$components.failureActions');

        const openApiYaml = `
openapi: 3.2.0
info:
  title: Combined OpenAPI
  version: 1.0.0
paths:
  /pets:
    get:
      operationId: listPets
      responses:
        '200':
          description: ok
webhooks:
  petWebhook:
    post:
      operationId: onPetWebhook
      summary: Pet Webhook Summary
      description: Webhook description
      responses:
        '200':
          description: ok
    put:
      responses:
        '200':
          description: ok
  refWebhook:
    $ref: '#/components/pathItems/Ref'
`;
        const arazzoJson = JSON.stringify({
            arazzo: '1.1.0',
            info: { title: 'Arazzo Workflows', version: '1.0.0' },
            sourceDescriptions: [
                { name: 'petstore', url: './openapi.yaml', type: 'openapi' },
                { name: 'defaultTypeSd', url: './other.yaml' },
            ],
            components: {
                inputs: { InSchema: { type: 'object' } },
            },
            workflows: [
                {
                    workflowId: 'wfMain',
                    summary: 'Main Workflow',
                    description: 'Workflow markdown',
                    dependsOn: ['$sourceDescriptions.ext.workflows.prereqWf', 'localPrereq'],
                    inputs: {
                        type: 'object',
                        properties: { userId: { type: 'string' } },
                    },
                    outputs: {
                        finalOut: '$steps.s1.outputs.id',
                    },
                    steps: [
                        {
                            stepId: 's1',
                            description: 'Step 1 desc',
                            operationId: 'listPets',
                            timeout: 1500,
                            correlationId: '$message.header#/corr',
                            dependsOn: ['s0'],
                            parameters: [
                                { name: 'q', in: 'query', value: 'dog' },
                                { name: 'wfParam', value: 42 },
                            ],
                            requestBody: {
                                contentType: 'application/json',
                                payload: { hello: 'world' },
                                replacements: [{ target: '/hello', value: 'mars' }],
                            },
                            successCriteria: [
                                { context: '$statusCode', condition: '$statusCode == 200', type: 'simple' },
                                { condition: '$.ok == true' },
                            ],
                            onSuccess: [
                                { name: 'goStep', type: 'goto', stepId: 's2' },
                                { name: 'goWf', type: 'goto', workflowId: 'wfOther' },
                                { name: 'endAct', type: 'end' },
                            ],
                            onFailure: [
                                { name: 'retryStep', type: 'retry', stepId: 's1', retryLimit: 3, retryAfter: 1 },
                                { name: 'retryWf', type: 'goto', workflowId: 'wfErr', retryLimit: 2 },
                                { name: 'retryDelayOnly', type: 'retry', retryAfter: 5 },
                                { name: 'failEnd', type: 'end' },
                            ],
                            outputs: {
                                id: '$response.body#/0/id',
                            },
                        },
                        {
                            stepId: 's2',
                            workflowId: 'subWf',
                            requestBody: {
                                payload: 'raw-string-payload',
                            },
                        },
                        {
                            stepId: 's3',
                            channelPath: '/events/pet',
                            action: 'send',
                            requestBody: {},
                        },
                        {
                            stepId: 's4',
                            operationId: 'unlinkedOp',
                        },
                        {
                            stepId: 's5',
                        },
                    ],
                },
                {
                    workflowId: 'wfMinimal',
                    steps: [{ stepId: 'minStep' }],
                },
            ],
        });

        const examples: CodeExample[] = [
            {
                language: 'ts',
                filepath: 'workflow_wfMain',
                content: 'tsWf()',
                includeImports: true,
                includeWrapping: true,
            },
            {
                language: 'sh',
                filepath: 'workflow_wfMain',
                content: 'shWf()',
                includeImports: false,
                includeWrapping: false,
            },
            {
                language: 'python',
                filepath: 'onPetWebhook',
                content: 'pyWh()',
                includeImports: true,
                includeWrapping: false,
            },
        ];

        const combinedHtml = generateAOTHtml(openApiYaml, examples, 'dark', false, {}, arazzoJson);
        expect(combinedHtml).toContain('id="workflow-wfMain"');
        expect(combinedHtml).toContain('id="step-wfMain-s1"');
        expect(combinedHtml).toContain('WEBHOOK: petWebhook');
        expect(combinedHtml).toContain('language-typescript');
        expect(combinedHtml).toContain('language-bash');

        // Also test renderWorkflowSection directly with custom linkedTarget without anchorId or method and hasCycles
        const customSection = renderWorkflowSection(
            {
                workflow: { workflowId: 'customWf', steps: [{ stepId: 'cs1' }, { stepId: 'cs2' }, { stepId: 'cs3' }] },
                resolvedParameters: [],
                resolvedSuccessActions: [],
                resolvedFailureActions: [],
                normalizedSteps: [
                    {
                        step: { stepId: 'cs1' },
                        mergedParameters: [],
                        resolvedOnSuccess: [],
                        resolvedOnFailure: [],
                        linkedTarget: { kind: 'operation' },
                        upstreamStepIds: [],
                    },
                    {
                        step: { stepId: 'cs2' },
                        mergedParameters: [],
                        resolvedOnSuccess: [],
                        resolvedOnFailure: [],
                        linkedTarget: { kind: 'workflow' },
                        upstreamStepIds: [],
                    },
                    {
                        step: { stepId: 'cs3' },
                        mergedParameters: [],
                        resolvedOnSuccess: [],
                        resolvedOnFailure: [],
                        linkedTarget: { kind: 'channel' },
                        upstreamStepIds: [],
                    },
                ],
                cliPreview: 'curl custom',
                hasCycles: true,
            },
            { spec: { openapi: '3.2.0', info: { title: 'T', version: '1' } }, codeExamples: {} },
            ['javascript'],
        );
        expect(customSection).toContain('customWf');
        expect(customSection).toContain('<span class="cdd-badge cdd-badge-get">OP</span>');
        expect(customSection).toContain('WORKFLOW: ');
        expect(customSection).toContain('SEND ');
        expect(customSection).toContain('DAG CYCLE DETECTED');

        // Test sanitizeUrl, sanitizeCssIdent, interpolateServerVariables, and ref resolvers
        expect(sanitizeUrl('javascript:alert(1)')).toBe('#');
        expect(sanitizeUrl('vbscript:msgbox(1)')).toBe('#');
        expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
        expect(sanitizeUrl('https://safe.example.com/terms')).toBe('https://safe.example.com/terms');
        expect(sanitizeCssIdent('python-3.12; color: red')).toBe('python-312colorred');

        expect(interpolateServerVariables(undefined)).toBe('https://api.example.com');
        expect(
            interpolateServerVariables({
                url: 'https://{env}.example.com:{port}/v1',
                variables: {
                    env: { default: 'staging' },
                    port: { default: '8443' },
                },
            }),
        ).toBe('https://staging.example.com:8443/v1');

        expect(resolveParameterRef({ $ref: 'bareParamRef' }, {})).toBeUndefined();
        expect(resolveRequestBodyRef({ $ref: 'bareRbRef' }, {})).toBeUndefined();
        expect(resolveResponseRef(undefined, {})).toBeUndefined();
        expect(resolveResponseRef({ $ref: 'bareRespRef' }, {})).toBeUndefined();
        expect(resolveOperationParameters(undefined, {})).toEqual([]);

        const serverOverrideYaml = `
openapi: 3.2.0
info:
  title: Server Override API
  version: 1.0.0
  termsOfService: javascript:alert(1)
  contact:
    name: SecTeam
    url: javascript:evil()
paths:
  /path-srv:
    servers:
      - url: https://path.example.com
    get:
      responses:
        "204":
          description: No Content
    post:
      servers:
        - url: https://op.example.com
      requestBody:
        content:
          text/plain: {}
      responses:
        "200":
          description: OK
          content:
            text/plain: {}
    delete:
      responses:
        "404":
          $ref: "#/components/responses/UnresolvedResp"
`;
        const frag = generateAOTBodyAndStyles(serverOverrideYaml);
        expect(frag.bodyHtml).toContain('data-base-url="https://path.example.com"');
        expect(frag.bodyHtml).toContain('data-base-url="https://op.example.com"');
        expect(frag.bodyHtml).toContain('href="#"');
        expect(frag.bodyHtml).not.toContain('javascript:alert(1)');
        expect(frag.bodyHtml).not.toContain('javascript:evil()');
    });
});
