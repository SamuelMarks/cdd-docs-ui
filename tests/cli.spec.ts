/**
 * Unit tests for the CLI entry point, argument parser, generator, and live-reload watch server (`src/cli.ts`).
 * @module cli.spec
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { run, parseArgs, generate, startWatchServer, checkIsMainModule, bootstrapCli, CLI_VERSION } from '../src/cli';
import { normalizeSpec } from '../src/parser';

/**
 * Mock Express request interface used in route tests.
 */
interface MockExpressReq {
    /** Registers an event listener on the request stream. */
    on?: (event: string, listener: () => void) => void;
    /** Checks if the request accepts a given content type. */
    accepts?: (type: string) => boolean;
}

/**
 * Mock Express response interface used in route tests.
 */
interface MockExpressRes {
    /** Sets an HTTP response header. */
    setHeader?: (name: string, value: string) => void;
    /** Flushes HTTP response headers. */
    flushHeaders?: () => void;
    /** Writes a chunk to the response stream. */
    write?: (chunk: string) => void;
    /** Sends a static file in the response. */
    sendFile?: (filePath: string) => void;
}

/**
 * Express route handler callback signature used in tests.
 */
type RouteHandler = (req: MockExpressReq, res: MockExpressRes, next?: () => void) => void;

/** Mock Express `.get()` route registration spy. */
const mockExpressGet = vi.fn<(route: string, handler: RouteHandler) => void>();

/** Mock Express application object used to test server initialization and routes. */
const mockExpressApp = {
    use: vi.fn(),
    get: mockExpressGet,
    listen: vi.fn((_port: number, cb?: () => void) => {
        if (cb) cb();
        return { close: vi.fn() };
    }),
};

vi.mock('fs', () => {
    const fsMock = {
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        mkdirSync: vi.fn(),
        existsSync: vi.fn(),
        watch: vi.fn(),
        unlinkSync: vi.fn(),
    };
    return { default: fsMock, ...fsMock };
});

vi.mock('express', () => {
    const mockExpress = Object.assign(
        vi.fn(() => mockExpressApp),
        { static: vi.fn() },
    );
    return { default: mockExpress, __esModule: true };
});

vi.mock('../src/runner', () => ({
    generateAllSnippets: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/parser', () => ({
    normalizeSpec: vi.fn().mockReturnValue({ spec: {} }),
}));

vi.mock('../src/aot-generator', () => ({
    generateAOTHtml: vi.fn().mockReturnValue('<html></html>'),
}));

/**
 * Mock response payload returned by `fetchMock`.
 */
interface MockFetchResponse {
    /** Whether the HTTP response status was successful (2xx). */
    ok: boolean;
    /** Optional HTTP status code. */
    status?: number;
    /** Optional HTTP status text. */
    statusText?: string;
    /** Optional async body text reader. */
    text?: () => Promise<string>;
}

/** Strongly typed mock for `global.fetch`. */
const fetchMock = vi.fn<(input: string) => Promise<MockFetchResponse>>();
vi.stubGlobal('fetch', fetchMock);

describe('CLI logic', () => {
    const originalProcessExit = process.exit.bind(process);
    const processExitMock = vi.fn<(code?: number) => void>();
    let consoleLogMock: ReturnType<typeof vi.spyOn>;
    let consoleErrorMock: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        Object.defineProperty(process, 'exit', {
            value: processExitMock,
            configurable: true,
            writable: true,
        });
        consoleLogMock = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.clearAllMocks();
    });

    afterEach(() => {
        Object.defineProperty(process, 'exit', {
            value: originalProcessExit,
            configurable: true,
            writable: true,
        });
        vi.restoreAllMocks();
    });

    it('parseArgs should parse all arguments correctly', () => {
        const args = ['-v', '-i', 'spec.yaml', '-a', 'arazzo.yaml', '-o', 'outdir', '-t', 'dark', '-w', '-p', '4000'];
        const config = parseArgs(args);
        expect(config.version).toBe(true);
        expect(config.inputSpec).toBe('spec.yaml');
        expect(config.arazzoSpec).toBe('arazzo.yaml');
        expect(config.outputDir).toBe('outdir');
        expect(config.theme).toBe('dark');
        expect(config.watchMode).toBe(true);
        expect(config.port).toBe(4000);
    });

    it('parseArgs should handle long flags and default values', () => {
        const args = [
            '--version',
            '--input',
            'spec2.yaml',
            '--arazzo',
            '',
            '--output',
            'out2',
            '--theme',
            'light',
            '--watch',
            '--port',
            '5000',
        ];
        const config = parseArgs(args);
        expect(config.version).toBe(true);
        expect(config.inputSpec).toBe('spec2.yaml');
        expect(config.arazzoSpec).toBeUndefined();
        expect(config.outputDir).toBe('out2');
        expect(config.theme).toBe('light');
        expect(config.watchMode).toBe(true);
        expect(config.port).toBe(5000);
    });

    it('parseArgs should fallback to default port 3000 when given non-numeric port', () => {
        const config = parseArgs(['-p', 'not-a-number']);
        expect(config.port).toBe(3000);
    });

    it('run should exit 0 when version flag is passed', async () => {
        await run(['-v']);
        expect(consoleLogMock).toHaveBeenCalledWith(CLI_VERSION);
        expect(processExitMock).toHaveBeenCalledWith(0);
    });

    it('run should exit 1 when no input spec is provided', async () => {
        await run(['-o', 'outdir']);
        expect(consoleErrorMock).toHaveBeenCalled();
        expect(processExitMock).toHaveBeenCalledWith(1);
    });

    it('run should call generate when input spec is provided', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
            `openapi: 3.0.0
info:
  title: Test
  version: 1.0.0
paths: {}`,
        );
        await run(['-i', 'spec.yaml']);
        expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('generate should fetch spec from URL if inputSpec is URL and clean up temp file', async () => {
        const mockResponse = {
            ok: true,
            text: vi.fn().mockResolvedValue(
                `openapi: 3.0.0
info:
  title: Test
  version: 1.0.0
paths: {}`,
            ),
        };
        fetchMock.mockResolvedValue(mockResponse);
        vi.mocked(fs.existsSync).mockReturnValue(true);

        const config = parseArgs(['-i', 'https://example.com/spec.yaml']);
        const result = await generate(config);

        expect(fetchMock).toHaveBeenCalledWith('https://example.com/spec.yaml');
        expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('.temp-spec.yaml'), expect.any(String));
        expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('.temp-spec.yaml'));
        expect(result).toBe(true);
    });

    it('generate should auto-prepend https:// if URL lacks it and no local file exists', async () => {
        const mockResponse = {
            ok: true,
            text: vi.fn().mockResolvedValue(
                `openapi: 3.0.0
info:
  title: Test
  version: 1.0.0
paths: {}`,
            ),
        };
        fetchMock.mockResolvedValue(mockResponse);
        vi.mocked(fs.existsSync).mockReturnValue(false);

        const config = parseArgs(['-i', 'example.com/spec.yaml']);
        const result = await generate(config);

        expect(fetchMock).toHaveBeenCalledWith('https://example.com/spec.yaml');
        expect(result).toBe(true);
    });

    it('generate should return false on failed URL fetch', async () => {
        const mockResponse = {
            ok: false,
            status: 404,
            statusText: 'Not Found',
        };
        fetchMock.mockResolvedValue(mockResponse);

        const config = parseArgs(['-i', 'https://example.com/spec.yaml']);
        const result = await generate(config);

        expect(consoleErrorMock).toHaveBeenCalledWith('Failed to generate documentation:', expect.any(Error));
        expect(result).toBe(false);
    });

    it('generate should fail properly on unparseable local spec', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockImplementation(() => {
            throw new Error('Cannot read file');
        });

        const config = parseArgs(['-i', 'local.yaml']);
        const result = await generate(config);

        expect(consoleErrorMock).toHaveBeenCalledWith('Failed to generate documentation:', expect.any(Error));
        expect(result).toBe(false);
    });

    it('generate should create output directory if it does not exist', async () => {
        vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
            if (p.toString().includes('local.yaml')) return true;
            return false;
        });
        vi.mocked(fs.readFileSync).mockReturnValue(
            `openapi: 3.0.0
info:
  title: Test
  version: 1.0.0
paths: {}`,
        );

        const config = parseArgs(['-i', 'local.yaml', '-o', 'new-dir']);
        const result = await generate(config);

        expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('new-dir'), {
            recursive: true,
        });
        expect(result).toBe(true);
    });

    it('startWatchServer should initialize express and set up livereload', async () => {
        const config = parseArgs(['-i', 'local.yaml', '-w']);
        vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
            if (p.toString().includes('local.yaml')) return true;
            return false;
        });

        const server = await startWatchServer(config);
        expect(server).toBeDefined();
        expect(fs.watch).toHaveBeenCalledWith(expect.stringContaining('local.yaml'), expect.any(Function));
    });

    it('startWatchServer should not set up watch if file does not exist', async () => {
        const config = parseArgs(['-i', 'non-existent.yaml', '-w']);
        vi.mocked(fs.existsSync).mockReturnValue(false);

        await startWatchServer(config);
        expect(fs.watch).not.toHaveBeenCalled();
        expect(consoleLogMock).toHaveBeenCalledWith(
            expect.stringContaining('Cannot watch URL or non-existent local file'),
        );
    });

    it('run should invoke startWatchServer when watchMode is true', async () => {
        const config = ['-i', 'local.yaml', '-w'];
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
            `openapi: 3.0.0
info:
  title: Test
  version: 1.0.0
paths: {}`,
        );

        await run(config);
        expect(fs.watch).toHaveBeenCalled();
    });

    it('livereload route should add and remove clients', async () => {
        const config = parseArgs(['-i', 'local.yaml', '-w']);
        vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
            if (p.toString().includes('local.yaml')) return true;
            return false;
        });

        await startWatchServer(config);

        expect(mockExpressGet).toHaveBeenCalled();
        const routeCall = mockExpressGet.mock.calls.find(call => call[0] === '/__livereload');
        const routeCallback = routeCall?.[1];
        expect(routeCallback).toBeDefined();

        const reqOnMock = vi.fn<(event: string, listener: () => void) => void>();
        const reqMock: MockExpressReq = { on: reqOnMock };
        const resMock: MockExpressRes = {
            setHeader: vi.fn(),
            flushHeaders: vi.fn(),
            write: vi.fn(),
        };

        routeCallback?.(reqMock, resMock);
        expect(resMock.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');

        const closeCall = reqOnMock.mock.calls.find(call => call[0] === 'close');
        const closeCallback = closeCall?.[1];
        closeCallback?.();
        expect(reqOnMock).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('SPA fallback route should serve index.html or call next()', async () => {
        const config = parseArgs(['-i', 'local.yaml', '-o', 'outdir', '-w']);
        vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
            if (p.toString().includes('local.yaml')) return true;
            if (p.toString().includes('index.html')) return true;
            return false;
        });

        await startWatchServer(config);

        const routeCall = mockExpressGet.mock.calls.find(call => call[0] === '*');
        const routeCallback = routeCall?.[1];
        expect(routeCallback).toBeDefined();

        const reqMock1: MockExpressReq = { accepts: vi.fn().mockReturnValue(true) };
        const resMock1: MockExpressRes = { sendFile: vi.fn() };
        const nextMock1 = vi.fn();
        routeCallback?.(reqMock1, resMock1, nextMock1);
        expect(resMock1.sendFile).toHaveBeenCalledWith(expect.stringContaining('index.html'));
        expect(nextMock1).not.toHaveBeenCalled();

        const reqMock2: MockExpressReq = { accepts: vi.fn().mockReturnValue(false) };
        const resMock2: MockExpressRes = { sendFile: vi.fn() };
        const nextMock2 = vi.fn();
        routeCallback?.(reqMock2, resMock2, nextMock2);
        expect(resMock2.sendFile).not.toHaveBeenCalled();
        expect(nextMock2).toHaveBeenCalled();

        vi.mocked(fs.existsSync).mockReturnValue(false);
        const reqMock3: MockExpressReq = { accepts: vi.fn().mockReturnValue(true) };
        const resMock3: MockExpressRes = { sendFile: vi.fn() };
        const nextMock3 = vi.fn();
        routeCallback?.(reqMock3, resMock3, nextMock3);
        expect(resMock3.sendFile).not.toHaveBeenCalled();
        expect(nextMock3).toHaveBeenCalled();
    });

    it('parseArgs should handle missing values for flags and unknown flags', () => {
        const args = ['-i', '', '-o', '', '-t', '', '--port', ''];
        const config = parseArgs(args);
        expect(config.inputSpec).toBe('');
        expect(config.outputDir).toBe('');
        expect(config.theme).toBe('light');
        expect(config.port).toBe(3000);

        expect(parseArgs(['-p']).port).toBe(3000);
        expect(parseArgs(['-unknown']).port).toBe(3000);
    });

    it('watch callback should ignore subsequent changes while generating and notify clients on success', async () => {
        vi.useFakeTimers();
        const watchMock = vi.mocked<(filename: fs.PathLike, listener: (event: string) => Promise<void>) => void>(
            fs.watch,
        );

        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(
            `openapi: 3.0.0
info:
  title: Test
  version: 1.0.0
paths: {}`,
        );

        const config = parseArgs(['-i', 'local.yaml', '-w']);
        await startWatchServer(config);

        const routeCall = mockExpressGet.mock.calls.find(call => call[0] === '/__livereload');
        const routeCallback = routeCall?.[1];
        const reqMock: MockExpressReq = { on: vi.fn() };
        const resMock: MockExpressRes = { setHeader: vi.fn(), flushHeaders: vi.fn(), write: vi.fn() };
        routeCallback?.(reqMock, resMock);

        const watchCallback = watchMock.mock.calls[0]?.[1];
        expect(watchCallback).toBeDefined();

        const firstCall = watchCallback?.('change');
        const secondCall = watchCallback?.('change');
        expect(await secondCall).toBeUndefined();

        await firstCall;
        const nl = String.fromCharCode(10);
        expect(resMock.write).toHaveBeenCalledWith(`data: reload${nl}${nl}`);

        vi.advanceTimersByTime(500);
        vi.useRealTimers();
    });

    it('watch callback should handle generation failure gracefully without notifying clients', async () => {
        vi.useFakeTimers();
        const watchMock = vi.mocked<(filename: fs.PathLike, listener: (event: string) => Promise<void>) => void>(
            fs.watch,
        );

        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockImplementation(() => {
            throw new Error('fail');
        });

        const config = parseArgs(['-i', 'local.yaml', '-w']);
        await startWatchServer(config);

        const routeCall = mockExpressGet.mock.calls.find(call => call[0] === '/__livereload');
        const routeCallback = routeCall?.[1];
        const reqMock: MockExpressReq = { on: vi.fn() };
        const resMock: MockExpressRes = { setHeader: vi.fn(), flushHeaders: vi.fn(), write: vi.fn() };
        routeCallback?.(reqMock, resMock);

        const watchCallback = watchMock.mock.calls[0]?.[1];
        await watchCallback?.('change');

        expect(resMock.write).not.toHaveBeenCalled();

        vi.advanceTimersByTime(500);
        vi.useRealTimers();
    });

    it('checkIsMainModule and bootstrapCli should accurately detect direct CLI execution', () => {
        expect(checkIsMainModule(undefined, 'file:///test.js')).toBe(false);
        expect(checkIsMainModule('/test.js', '')).toBe(false);
        expect(checkIsMainModule('/test.js', 'not-a-file-url')).toBe(false);

        const validFileUrl = 'file:///tmp/cli-entry.js';
        const expectedPath = fileURLToPath(validFileUrl);
        expect(checkIsMainModule(expectedPath, validFileUrl)).toBe(true);
        expect(checkIsMainModule('/other/path.js', validFileUrl)).toBe(false);

        bootstrapCli(['node', expectedPath, '-v'], validFileUrl);
        expect(consoleLogMock).toHaveBeenCalledWith(CLI_VERSION);

        vi.clearAllMocks();
        bootstrapCli(['node', '/other/path.js', '-v'], validFileUrl);
        expect(consoleLogMock).not.toHaveBeenCalled();
    });

    it('generate and startWatchServer should support companion Arazzo local files and URLs', async () => {
        vi.mocked(normalizeSpec).mockReturnValue({
            spec: { openapi: '3.2.0', info: { title: 'T', version: '1' } },
            codeExamples: {},
            arazzoSpec: { arazzo: '1.1.0', info: { title: 'A', version: '1' }, sourceDescriptions: [], workflows: [] },
        });

        // 1. Local companion Arazzo file
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue('arazzo: 1.1.0');
        const localConfig = parseArgs(['-i', 'spec.yaml', '-a', 'arazzo.yaml']);
        expect(await generate(localConfig)).toBe(true);

        // 2. Remote companion Arazzo URL (without https:// prefix)
        vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
            const s = p.toString();
            if (s.includes('spec.yaml') || s.includes('.temp-arazzo.yaml')) return true;
            return false;
        });
        fetchMock.mockResolvedValueOnce({
            ok: true,
            text: vi.fn().mockResolvedValue('arazzo: 1.1.0'),
        });
        const urlConfig = parseArgs(['-i', 'spec.yaml', '-a', 'example.com/arazzo.yaml']);
        expect(await generate(urlConfig)).toBe(true);
        expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('.temp-arazzo.yaml'));

        // 3. Remote companion Arazzo URL failure
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
        });
        const failUrlConfig = parseArgs(['-i', 'spec.yaml', '-a', 'https://example.com/arazzo.yaml']);
        expect(await generate(failUrlConfig)).toBe(false);

        // 4. Watch server watching both inputSpec and arazzoSpec
        vi.mocked(fs.existsSync).mockReturnValue(true);
        await startWatchServer(parseArgs(['-i', 'spec.yaml', '-a', 'arazzo.yaml', '-w']));
        expect(fs.watch).toHaveBeenCalledWith(expect.stringContaining('arazzo.yaml'), expect.any(Function));

        // 5. Watch server when arazzoSpec does not exist locally
        vi.mocked(fs.existsSync).mockReturnValue(false);
        await startWatchServer(parseArgs(['-i', 'spec.yaml', '-a', 'https://example.com/arazzo.yaml', '-w']));
    });
});
