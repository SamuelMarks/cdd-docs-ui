/**
 * Unit tests for `cdd-ctl` subprocess runner, output parser, and fallback generator (`src/runner.ts`).
 * @module runner.spec
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
    runCddCtl,
    parseCDDOutput,
    generateMockFallback,
    generateVariant,
    generateAllSnippets,
    SUPPORTED_LANGUAGES,
    resolveCddCtlPath,
} from '../src/runner';
import { OpenAPI320 } from '../src/types';

/**
 * Standard stdout/stderr result payload passed to `execFile` callbacks.
 */
interface ExecFileResult {
    /** Standard output string. */
    stdout: string;
    /** Standard error string. */
    stderr: string;
}

/**
 * Callback signature invoked by the mocked `execFile` implementation.
 */
type ExecFileCallback = (error: Error | null, result?: ExecFileResult) => void;

/** Hoisted strongly-typed mock for `node:child_process.execFile`. */
const { execFileMock } = vi.hoisted(() => ({
    execFileMock: vi.fn<(cmd: string, cmdArgs: readonly string[], cb: ExecFileCallback) => void>(),
}));

vi.mock('node:child_process', () => ({
    execFile: execFileMock,
}));

vi.mock('node:fs', () => ({
    default: { existsSync: vi.fn() },
    existsSync: vi.fn(),
}));

/**
 * Helper to mock `execFile` with a strongly-typed implementation.
 * @param handler Function receiving args and invoking the callback.
 * @returns The mocked `execFile` spy.
 */
function mockExecFileWith(handler: (cmd: string, cmdArgs: readonly string[], cb: ExecFileCallback) => void) {
    return execFileMock.mockImplementation(handler);
}

describe('runner.ts', () => {
    afterEach(() => {
        vi.clearAllMocks();
        delete process.env['CDD_CTL_PATH'];
    });

    describe('resolveCddCtlPath', () => {
        it('should expose supported languages list', () => {
            expect(SUPPORTED_LANGUAGES).toContain('rust');
            expect(SUPPORTED_LANGUAGES).toContain('python-all');
        });

        it('should return process.env.CDD_CTL_PATH if it exists', () => {
            process.env['CDD_CTL_PATH'] = '/custom/path/cdd-ctl';
            vi.mocked(fs.existsSync).mockReturnValueOnce(true);

            const resolved = resolveCddCtlPath();
            expect(resolved).toBe(path.resolve('/custom/path/cdd-ctl'));
            expect(fs.existsSync).toHaveBeenCalledWith('/custom/path/cdd-ctl');
        });

        it('should return local path if it exists and env var is not set', () => {
            vi.mocked(fs.existsSync).mockReturnValueOnce(true);

            const resolved = resolveCddCtlPath();
            expect(resolved).toBe(path.resolve(process.cwd(), 'cdd-ctl'));
            expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(process.cwd(), 'cdd-ctl'));
        });

        it("should return default './cdd-ctl' if nothing exists", () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const resolved = resolveCddCtlPath();
            expect(resolved).toBe('./cdd-ctl');
        });
    });

    describe('runCddCtl', () => {
        it('should securely execute cdd-ctl with the correct arguments', async () => {
            let capturedCmd = '';
            let capturedArgs: readonly string[] = [];
            const mockExec = mockExecFileWith((cmd, cmdArgs, cb) => {
                capturedCmd = cmd;
                capturedArgs = cmdArgs;
                cb(null, { stdout: 'mock_stdout', stderr: 'mock_stderr' });
            });

            const stdout = await runCddCtl('typescript', 'spec.json');

            expect(stdout).toBe('mock_stdout');
            expect(mockExec).toHaveBeenCalledTimes(1);
            expect(capturedCmd).toBe('./cdd-ctl');
            expect(capturedArgs).toEqual(['typescript', 'to_docs_json', '-i', 'spec.json']);
        });

        it('should allow overriding the cdd-ctl binary path', async () => {
            let capturedCmd = '';
            let capturedArgs: readonly string[] = [];
            mockExecFileWith((cmd, cmdArgs, cb) => {
                capturedCmd = cmd;
                capturedArgs = cmdArgs;
                cb(null, { stdout: 'success', stderr: '' });
            });

            const stdout = await runCddCtl('python', 'spec.yaml', {
                cddCtlPath: '/usr/local/bin/cdd-ctl',
            });

            expect(stdout).toBe('success');
            expect(capturedCmd).toBe('/usr/local/bin/cdd-ctl');
            expect(capturedArgs).toEqual(['python', 'to_docs_json', '-i', 'spec.yaml']);
        });

        it('should pass --no-imports flag when noImports is true', async () => {
            let capturedArgs: readonly string[] = [];
            mockExecFileWith((_cmd, cmdArgs, cb) => {
                capturedArgs = cmdArgs;
                cb(null, { stdout: 'success', stderr: '' });
            });

            await runCddCtl('go', 'spec.json', { noImports: true });
            expect(capturedArgs).toEqual(['go', 'to_docs_json', '-i', 'spec.json', '--no-imports']);
        });

        it('should pass --no-wrapping flag when noWrapping is true', async () => {
            let capturedArgs: readonly string[] = [];
            mockExecFileWith((_cmd, cmdArgs, cb) => {
                capturedArgs = cmdArgs;
                cb(null, { stdout: 'success', stderr: '' });
            });

            await runCddCtl('rust', 'spec.json', { noWrapping: true });
            expect(capturedArgs).toEqual(['rust', 'to_docs_json', '-i', 'spec.json', '--no-wrapping']);
        });

        it('should pass both flags when both options are true', async () => {
            let capturedArgs: readonly string[] = [];
            mockExecFileWith((_cmd, cmdArgs, cb) => {
                capturedArgs = cmdArgs;
                cb(null, { stdout: 'success', stderr: '' });
            });

            await runCddCtl('java', 'spec.json', { noImports: true, noWrapping: true });
            expect(capturedArgs).toEqual(['java', 'to_docs_json', '-i', 'spec.json', '--no-imports', '--no-wrapping']);
        });

        it('should reject if execFile fails', async () => {
            const mockError = new Error('Command failed');
            mockExecFileWith((_cmd, _cmdArgs, cb) => {
                cb(mockError);
            });

            await expect(runCddCtl('rust', 'spec.json')).rejects.toThrow('Command failed');
        });
    });

    describe('parseCDDOutput', () => {
        it('should correctly parse valid CDDOutput JSON', () => {
            const json = JSON.stringify({
                endpoints: {
                    '/users': { get: "console.log('users');" },
                },
            });
            const result = parseCDDOutput(json);
            expect(result.endpoints['/users']?.['get']).toBe("console.log('users');");
        });

        it('should throw error for invalid JSON', () => {
            expect(() => parseCDDOutput('invalid-json')).toThrow('Failed to parse cdd-ctl output as JSON');
        });

        it('should throw error if endpoints object is missing', () => {
            expect(() => parseCDDOutput('{}')).toThrow('Invalid CDDOutput structure: missing endpoints object');
            expect(() => parseCDDOutput(JSON.stringify({ notEndpoints: {} }))).toThrow(
                'Invalid CDDOutput structure: missing endpoints object',
            );
            expect(() => parseCDDOutput(JSON.stringify({ endpoints: null }))).toThrow(
                'Invalid CDDOutput structure: missing endpoints object',
            );
        });

        it('should throw error if endpoints values are not objects', () => {
            const invalid = JSON.stringify({ endpoints: { '/test': 'not-an-object' } });
            expect(() => parseCDDOutput(invalid)).toThrow(
                "Invalid CDDOutput structure: endpoints['/test'] must be an object",
            );
        });

        it('should throw error if methods are not strings', () => {
            const invalid = JSON.stringify({ endpoints: { '/test': { get: 123 } } });
            expect(() => parseCDDOutput(invalid)).toThrow(
                "Invalid CDDOutput structure: endpoints['/test']['get'] must be a string",
            );
        });
    });

    describe('generateMockFallback', () => {
        const dummySpec: OpenAPI320 = {
            openapi: '3.2.0',
            info: { title: 'Test', version: '1.0.0' },
            paths: {
                '/test': { get: { responses: {} }, post: { responses: {} } },
                '/empty': {},
                '/ref': { $ref: '#/some/ref' },
            },
        };

        it('should generate default variant mocks correctly', () => {
            const mock = generateMockFallback('python', dummySpec);
            expect(mock.endpoints['/test']?.['get']).toBe('FAILED CLI COMMAND ./cdd-ctl python (variant: default)');
            expect(mock.endpoints['/test']?.['post']).toBe('FAILED CLI COMMAND ./cdd-ctl python (variant: default)');
            expect(mock.endpoints['/empty']).toEqual({});
            expect(mock.endpoints['/ref']).toBeUndefined();
        });

        it('should generate variant mocks reflecting options', () => {
            const mock1 = generateMockFallback('go', dummySpec, { noImports: true });
            expect(mock1.endpoints['/test']?.['get']).toContain('(variant: noImports)');

            const mock2 = generateMockFallback('java', dummySpec, { noWrapping: true });
            expect(mock2.endpoints['/test']?.['get']).toContain('(variant: noWrapping)');

            const mock3 = generateMockFallback('rust', dummySpec, {
                noImports: true,
                noWrapping: true,
            });
            expect(mock3.endpoints['/test']?.['get']).toContain('(variant: noImportsNoWrapping)');
        });

        it('should return empty endpoints if spec has no paths', () => {
            const emptySpec: OpenAPI320 = {
                openapi: '3.2.0',
                info: { title: 'Test', version: '1.0.0' },
            };
            const mock = generateMockFallback('ts', emptySpec);
            expect(mock.endpoints).toEqual({});
        });
    });

    describe('generateVariant', () => {
        const dummySpec: OpenAPI320 = { openapi: '3.2.0', info: { title: '', version: '' } };

        it('should return parsed CDDOutput on success', async () => {
            const validOutput = { endpoints: { '/api': { get: 'success code' } } };
            mockExecFileWith((_cmd, _cmdArgs, cb) => {
                cb(null, { stdout: JSON.stringify(validOutput), stderr: '' });
            });

            const result = await generateVariant('c', 'spec.json', dummySpec);
            expect(result).toEqual(validOutput);
        });

        it('should catch errors and return mock fallback on exec failure', async () => {
            mockExecFileWith((_cmd, _cmdArgs, cb) => {
                cb(new Error('Subprocess crashed'));
            });

            const specWithPaths: OpenAPI320 = {
                ...dummySpec,
                paths: { '/path': { get: { responses: {} } } },
            };
            const result = await generateVariant('ruby', 'spec.json', specWithPaths);

            expect(result.endpoints['/path']?.['get']).toBe('FAILED CLI COMMAND ./cdd-ctl ruby (variant: default)');
        });

        it('should catch errors and return mock fallback on parse failure', async () => {
            mockExecFileWith((_cmd, _cmdArgs, cb) => {
                cb(null, { stdout: 'invalid json', stderr: '' });
            });

            const specWithPaths: OpenAPI320 = {
                ...dummySpec,
                paths: { '/path': { get: { responses: {} } } },
            };
            const result = await generateVariant('php', 'spec.json', specWithPaths);

            expect(result.endpoints['/path']?.['get']).toBe('FAILED CLI COMMAND ./cdd-ctl php (variant: default)');
        });
    });

    describe('generateAllSnippets', () => {
        const dummySpec: OpenAPI320 = { openapi: '3.2.0', info: { title: '', version: '' } };

        it('should generate 4 variants for each language provided', async () => {
            const validOutput = { endpoints: { '/api': { get: 'code' } } };
            const mockExec = mockExecFileWith((_cmd, _cmdArgs, cb) => {
                cb(null, { stdout: JSON.stringify(validOutput), stderr: '' });
            });

            const langs = ['go', 'python-all'];
            const results = await generateAllSnippets(langs, 'spec.json', dummySpec);

            expect(results.length).toBe(8);
            expect(mockExec).toHaveBeenCalledTimes(8);

            expect(results).toContainEqual({
                language: 'go',
                filepath: '_api_get',
                content: 'code',
                includeImports: true,
                includeWrapping: true,
            });

            expect(results).toContainEqual(
                expect.objectContaining({
                    language: 'python',
                }),
            );
        });

        it('should parse array operations format, structured code objects, webhooks, and workflows', async () => {
            const arrayOutput = JSON.stringify([
                'not-a-record',
                {
                    language: 'go',
                    operations: [
                        'not-an-op',
                        {
                            method: 'GET',
                            path: '/pets',
                            code: {
                                imports: 'import "fmt"',
                                wrapperStart: 'func main() {',
                                snippet: 'fmt.Println("hi")',
                                wrapperEnd: '}',
                            },
                        },
                        {
                            method: 'POST',
                            path: '/pets',
                            code: 'raw-post-code',
                        },
                        {
                            code: 12345,
                        },
                        {
                            method: 'WORKFLOW',
                            path: '/workflows/adoptWf',
                            operationId: 'adoptWf',
                            code: {
                                default: {
                                    imports: 'use pkg;',
                                    wrapper_start: 'fn run() {',
                                    code: 'step1();',
                                    wrapper_end: '}',
                                },
                            },
                        },
                        {
                            method: 'WORKFLOW',
                            path: '/workflows/pathWf',
                            code: 'path-wf-code',
                        },
                        {
                            method: 'WORKFLOW',
                            path: '',
                            code: 'fallback-wf-code',
                        },
                    ],
                },
            ]);
            const parsedArray = parseCDDOutput(arrayOutput);
            expect(parsedArray.endpoints['/pets']?.['get']).toContain('fmt.Println("hi")');
            expect(parsedArray.endpoints['/pets']?.['post']).toBe('raw-post-code');
            expect(parsedArray.workflows?.['adoptWf']).toContain('step1();');
            expect(parsedArray.workflows?.['pathWf']).toBe('path-wf-code');
            expect(parsedArray.workflows?.['workflow']).toBe('fallback-wf-code');

            expect(() => parseCDDOutput(JSON.stringify([{ invalidBlock: true }]))).toThrow(
                'Invalid CDDOutput structure: missing endpoints object',
            );
            expect(
                parseCDDOutput(JSON.stringify([{ operations: [{ method: 'GET', path: '/only', code: 'c' }] }]))
                    .workflows,
            ).toBeUndefined();

            // Structured object with endpoints (structured snippet), webhooks, and workflows
            const structuredObjOutput = JSON.stringify({
                endpoints: {
                    '/items': {
                        get: { snippet: 'itemsGet()' },
                    },
                },
                webhooks: {
                    orderHook: {
                        post: 'whPost()',
                        put: { snippet: 'whPut()' },
                        bad: 123,
                    },
                    badWh: 'not-record',
                },
                workflows: {
                    wf1: 'wf1Run()',
                    wf2: { snippet: 'wf2Run()' },
                    badWf: 123,
                },
            });
            const parsedObj = parseCDDOutput(structuredObjOutput);
            expect(parsedObj.endpoints['/items']?.['get']).toBe('itemsGet()');
            expect(parsedObj.webhooks?.['orderHook']?.['post']).toBe('whPost()');
            expect(parsedObj.webhooks?.['orderHook']?.['put']).toBe('whPut()');
            expect(parsedObj.workflows?.['wf1']).toBe('wf1Run()');
            expect(parsedObj.workflows?.['wf2']).toBe('wf2Run()');

            const workflowsOnlyObj = parseCDDOutput(JSON.stringify({ workflows: { onlyWf: 'onlyWfCode()' } }));
            expect(workflowsOnlyObj.endpoints).toEqual({});
            expect(workflowsOnlyObj.workflows?.['onlyWf']).toBe('onlyWfCode()');

            // Mock fallback & generateAllSnippets with webhooks and Arazzo workflows
            const specWithWebhooks: OpenAPI320 = {
                openapi: '3.2.0',
                info: { title: 'WH', version: '1.0.0' },
                paths: { '/p': { get: { responses: {} } } },
                webhooks: {
                    hookA: { post: { responses: {} } },
                    hookRef: { $ref: '#/components/pathItems/Ref' },
                },
            };
            const arazzoSpec = {
                arazzo: '1.1.0',
                info: { title: 'Arazzo', version: '1.0.0' },
                sourceDescriptions: [],
                workflows: [{ workflowId: 'checkoutWf', steps: [{ stepId: 's1' }] }],
            };

            mockExecFileWith((_cmd, _args, cb) => {
                cb(new Error('Command failed'));
            });
            const allSnippets = await generateAllSnippets(
                ['ts'],
                'spec.json',
                specWithWebhooks,
                './cdd-ctl',
                arazzoSpec,
            );
            expect(allSnippets.some(s => s.filepath === 'hookA_post')).toBe(true);
            expect(allSnippets.some(s => s.filepath === 'workflow_checkoutWf')).toBe(true);
        });
    });
});
