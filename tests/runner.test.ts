import { generateMockExamples, getCodeExamplesForLanguage, collectAllExamples, LANGUAGES } from '../src/runner';
import fs from 'fs-extra';
import * as cp from 'child_process';

jest.mock('fs-extra');
jest.mock('child_process');

describe('runner', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('generateMockExamples', () => {
        it('generates mock examples correctly when paths exist', async () => {
            const mockSpec = {
                paths: {
                    '/test': { get: {}, post: {} },
                },
            };
            (fs.readJson as jest.Mock).mockResolvedValue(mockSpec);

            const result = await generateMockExamples('dummy.json', 'python', 'noImports');
            expect(result.endpoints).toHaveProperty('/test');
            expect(result.endpoints['/test']).toHaveProperty('get');
            expect(result.endpoints['/test']).toHaveProperty('post');
            expect(result.endpoints['/test']!['get']).toEqual('FAILED CLI COMMAND cdd_python (variant: noImports)');
        });

        it('returns empty examples when paths do not exist', async () => {
            (fs.readJson as jest.Mock).mockResolvedValue({});
            const result = await generateMockExamples('dummy.json', 'go', 'default');
            expect(result.endpoints).toEqual({});
        });
    });

    describe('getCodeExamplesForLanguage', () => {
        it('returns parsed stdout when execution is successful', async () => {
            const mockOutput = { endpoints: { '/test': { get: 'hello' } } };
            (cp.exec as unknown as jest.Mock).mockImplementation((_cmd, cb) => {
                cb(null, { stdout: JSON.stringify(mockOutput) });
            });

            const result = await getCodeExamplesForLanguage(
                'python',
                'cdd_python_client',
                'dummy.json',
                { noImports: true, noWrapping: true },
                'noImportsNoWrapping',
            );
            expect(result).toEqual(mockOutput);
            expect(cp.exec).toHaveBeenCalledWith(
                expect.stringContaining('cdd_python_client to_docs_json -i dummy.json --no-imports --no-wrapping'),
                expect.any(Function),
            );
        });

        it('falls back to mock examples when execution fails', async () => {
            (cp.exec as unknown as jest.Mock).mockImplementation((_cmd, cb) => {
                cb(new Error('Command failed'), { stdout: '', stderr: 'error' });
            });
            (fs.readJson as jest.Mock).mockResolvedValue({});

            // Catch console.warn to suppress output
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            const result = await getCodeExamplesForLanguage('python', 'cdd_python_client', 'dummy.json', {}, 'default');
            expect(result.endpoints).toEqual({});
            expect(warnSpy).toHaveBeenCalled();

            warnSpy.mockRestore();
        });

        it('falls back to mock examples when execution fails with string error', async () => {
            (cp.exec as unknown as jest.Mock).mockImplementation((_cmd, cb) => {
                cb('String error', { stdout: '', stderr: 'error' });
            });
            (fs.readJson as jest.Mock).mockResolvedValue({});
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            const result = await getCodeExamplesForLanguage('python', 'cdd_python_client', 'dummy.json', {}, 'default');
            expect(result.endpoints).toEqual({});
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
        });
    });

    describe('collectAllExamples', () => {
        it('collects examples for all registered languages with all 4 variants', async () => {
            const mockOutput = { endpoints: {} };
            (cp.exec as unknown as jest.Mock).mockImplementation((_cmd, cb) => {
                cb(null, { stdout: JSON.stringify(mockOutput) });
            });

            const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

            const result = await collectAllExamples('dummy.json');
            for (const lang of Object.keys(LANGUAGES)) {
                expect(result).toHaveProperty(lang);
                const langData = result[lang];
                expect(langData).toHaveProperty('default');
                expect(langData).toHaveProperty('noImports');
                expect(langData).toHaveProperty('noWrapping');
                expect(langData).toHaveProperty('noImportsNoWrapping');
            }
            expect(logSpy).toHaveBeenCalled();
            logSpy.mockRestore();
        });
    });
});
