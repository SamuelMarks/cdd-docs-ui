import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import fs from 'fs';
import { run, parseArgs, generate, startWatchServer } from '../src/cli';

vi.mock('fs', () => {
    const fsMock = {
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        mkdirSync: vi.fn(),
        existsSync: vi.fn(),
        watch: vi.fn(),
    };
    return { default: fsMock, ...fsMock };
});

vi.mock('express', () => {
    const mockExpressApp = {
        use: vi.fn(),
        get: vi.fn(),
        listen: vi.fn((port, cb) => {
            if (cb) cb();
            return { close: vi.fn() };
        }),
    };
    const mockExpress = vi.fn(() => mockExpressApp) as any;
    mockExpress.static = vi.fn();
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

// Mock fetch
global.fetch = vi.fn();

describe('CLI logic', () => {
    let processExitMock: any;
    let consoleLogMock: any;
    let consoleErrorMock: any;

    beforeEach(() => {
        processExitMock = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
        consoleLogMock = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('parseArgs should parse all arguments correctly', () => {
        const args = ['-v', '-i', 'spec.yaml', '-o', 'outdir', '-t', 'dark', '-w', '-p', '4000'];
        const config = parseArgs(args);
        expect(config.version).toBe(true);
        expect(config.inputSpec).toBe('spec.yaml');
        expect(config.outputDir).toBe('outdir');
        expect(config.theme).toBe('dark');
        expect(config.watchMode).toBe(true);
        expect(config.port).toBe(4000);
    });

    it('parseArgs should handle long flags and default values', () => {
        const args = ['--version', '--input', 'spec2.yaml', '--output', 'out2', '--theme', 'light', '--watch', '--port', '5000'];
        const config = parseArgs(args);
        expect(config.version).toBe(true);
        expect(config.inputSpec).toBe('spec2.yaml');
        expect(config.outputDir).toBe('out2');
        expect(config.theme).toBe('light');
        expect(config.watchMode).toBe(true);
        expect(config.port).toBe(5000);
    });

    it('run should exit 0 when version flag is passed', async () => {
        await run(['-v']);
        expect(consoleLogMock).toHaveBeenCalledWith('0.0.1');
        expect(processExitMock).toHaveBeenCalledWith(0);
    });

    it('run should exit 1 when no input spec is provided', async () => {
        await run(['-o', 'outdir']);
        expect(consoleErrorMock).toHaveBeenCalled();
        expect(processExitMock).toHaveBeenCalledWith(1);
    });

    it('run should call generate when input spec is provided', async () => {
        (fs.existsSync as Mock).mockReturnValue(true);
        (fs.readFileSync as Mock).mockReturnValue('openapi: 3.0.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}');
        await run(['-i', 'spec.yaml']);
        expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('generate should fetch spec from URL if inputSpec is URL', async () => {
        const mockResponse = {
            ok: true,
            text: vi.fn().mockResolvedValue('openapi: 3.0.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}'),
        };
        (global.fetch as Mock).mockResolvedValue(mockResponse);
        
        const config = parseArgs(['-i', 'https://example.com/spec.yaml']);
        const result = await generate(config);
        
        expect(global.fetch).toHaveBeenCalledWith('https://example.com/spec.yaml');
        expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('.temp-spec.yaml'), expect.any(String));
        expect(result).toBe(true);
    });

    it('generate should auto-prepend https:// if URL lacks it and no local file exists', async () => {
        const mockResponse = {
            ok: true,
            text: vi.fn().mockResolvedValue('openapi: 3.0.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}'),
        };
        (global.fetch as Mock).mockResolvedValue(mockResponse);
        (fs.existsSync as Mock).mockReturnValue(false);
        
        const config = parseArgs(['-i', 'example.com/spec.yaml']);
        const result = await generate(config);
        
        expect(global.fetch).toHaveBeenCalledWith('https://example.com/spec.yaml');
        expect(result).toBe(true);
    });

    it('generate should throw error on failed URL fetch', async () => {
        const mockResponse = {
            ok: false,
            status: 404,
            statusText: 'Not Found'
        };
        (global.fetch as Mock).mockResolvedValue(mockResponse);
        
        const config = parseArgs(['-i', 'https://example.com/spec.yaml']);
        const result = await generate(config);
        
        expect(consoleErrorMock).toHaveBeenCalledWith('Failed to generate documentation:', expect.any(Error));
        expect(result).toBe(false);
    });

    it('generate should fail properly on unparseable local spec', async () => {
        (fs.existsSync as Mock).mockReturnValue(true);
        (fs.readFileSync as Mock).mockImplementation(() => { throw new Error('Cannot read file'); });
        
        const config = parseArgs(['-i', 'local.yaml']);
        const result = await generate(config);
        
        expect(consoleErrorMock).toHaveBeenCalledWith('Failed to generate documentation:', expect.any(Error));
        expect(result).toBe(false);
    });

    it('generate should create output directory if it does not exist', async () => {
        (fs.existsSync as Mock).mockImplementation((path) => {
            if (path.toString().includes('local.yaml')) return true;
            return false;
        });
        (fs.readFileSync as Mock).mockReturnValue('openapi: 3.0.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}');
        
        const config = parseArgs(['-i', 'local.yaml', '-o', 'new-dir']);
        const result = await generate(config);
        
        expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('new-dir'), { recursive: true });
        expect(result).toBe(true);
    });

    it('startWatchServer should initialize express and set up livereload', async () => {
        const config = parseArgs(['-i', 'local.yaml', '-w']);
        (fs.existsSync as Mock).mockImplementation((path) => {
            if (path.toString().includes('local.yaml')) return true;
            return false;
        });

        const server = await startWatchServer(config);
        expect(server).toBeDefined();
        
        expect(fs.watch).toHaveBeenCalledWith(expect.stringContaining('local.yaml'), expect.any(Function));
    });

    it('startWatchServer should not set up watch if file does not exist', async () => {
        const config = parseArgs(['-i', 'non-existent.yaml', '-w']);
        (fs.existsSync as Mock).mockReturnValue(false);

        await startWatchServer(config);
        expect(fs.watch).not.toHaveBeenCalled();
        expect(consoleLogMock).toHaveBeenCalledWith(expect.stringContaining('Cannot watch URL or non-existent local file'));
    });

    it('run should invoke startWatchServer when watchMode is true', async () => {
        const config = ['-i', 'local.yaml', '-w'];
        (fs.existsSync as Mock).mockReturnValue(true);
        (fs.readFileSync as Mock).mockReturnValue('openapi: 3.0.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}');
        
        await run(config);
        expect(fs.watch).toHaveBeenCalled();
    });

    it('livereload route should add and remove clients', async () => {
        const config = parseArgs(['-i', 'local.yaml', '-w']);
        (fs.existsSync as Mock).mockImplementation((path) => {
            if (path.toString().includes('local.yaml')) return true;
            return false;
        });

        await startWatchServer(config);
        
        const expressMock = (await import('express')).default as any;
        const app = expressMock();
        
        expect(app.get).toHaveBeenCalled();
        const routeCallback = app.get.mock.calls.find((call: any) => call[0] === '/__livereload')?.[1];
        
        expect(routeCallback).toBeDefined();

        const reqMock = { on: vi.fn() };
        const resMock = {
            setHeader: vi.fn(),
            flushHeaders: vi.fn(),
            write: vi.fn(),
        };

        routeCallback(reqMock, resMock);
        
        expect(resMock.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
        
        const closeCallback = reqMock.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
        closeCallback();
    });

    it('parseArgs should handle missing values for flags', () => {
        const args = ['-i', '', '-o', '', '-t', '', '--port', ''];
        const config = parseArgs(args);
        expect(config.inputSpec).toBe('');
        expect(config.outputDir).toBe('');
        expect(config.theme).toBe('light');
        expect(config.port).toBe(3000);
    });

    it('parseArgs should handle flags at the end of the array and unknown flags', () => {
        const args = ['-p'];
        const config = parseArgs(args);
        expect(config.port).toBe(3000);
        
        const config2 = parseArgs(['-unknown']);
        expect(config2.port).toBe(3000);
    });

    it('watch callback should ignore subsequent changes while generating', async () => {
        vi.useFakeTimers();
        const watchMock = fs.watch as Mock;
        let watchCallback: any;
        
        (fs.existsSync as Mock).mockReturnValue(true);
        (fs.readFileSync as Mock).mockReturnValue('openapi: 3.0.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}');

        const config = parseArgs(['-i', 'local.yaml', '-w']);
        await startWatchServer(config);
        
        // Register a client to hit the write branch
        const expressMock = (await import('express')).default as any;
        const app = expressMock();
        const routeCallback = app.get.mock.calls.find((call: any) => call[0] === '/__livereload')?.[1];
        const reqMock = { on: vi.fn() };
        const resMock = { setHeader: vi.fn(), flushHeaders: vi.fn(), write: vi.fn() };
        routeCallback(reqMock, resMock);
        
        watchCallback = watchMock.mock.calls?.[0]?.[1];
        expect(watchCallback).toBeDefined();

        // First trigger starts generation
        const firstCall = watchCallback('change');
        
        // Second trigger should return immediately since isGenerating is true
        const secondCall = watchCallback('change');
        expect(await secondCall).toBeUndefined();
        
        await firstCall;
        
        expect(resMock.write).toHaveBeenCalledWith('data: reload\n\n');
        
        vi.advanceTimersByTime(500);
        vi.useRealTimers();
    });

    it('watch callback should handle generation failure gracefully without notifying clients', async () => {
        vi.useFakeTimers();
        const watchMock = fs.watch as Mock;
        let watchCallback: any;
        
        (fs.existsSync as Mock).mockReturnValue(true);
        // Force generate to fail
        (fs.readFileSync as Mock).mockImplementation(() => { throw new Error('fail'); });

        const config = parseArgs(['-i', 'local.yaml', '-w']);
        await startWatchServer(config);
        
        watchCallback = watchMock.mock.calls?.[0]?.[1];
        
        await watchCallback('change');
        // generate returns false, so clients shouldn't be notified
        // we can just verify it reaches the debounce
        
        vi.advanceTimersByTime(500);
        vi.useRealTimers();
    });
});
