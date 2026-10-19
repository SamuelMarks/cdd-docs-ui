#!/usr/bin/env node
/**
 * Command-Line Interface and Live-Reload Watch Server for `cdd-docs-ui`.
 * @module cli
 */

import fs from 'fs';
import os from 'os';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { generateAOTHtml } from './aot-generator';
import { generateAllSnippets } from './runner';
import { normalizeSpec, isSpecUrl, normalizeSpecUrl } from './parser';
import { CliConfig } from './types';

/**
 * Monotonic counter for generating collision-free temporary specification filenames.
 */
let tempFileCounter = 0;

/**
 * Current CLI version matching `package.json`.
 */
export const CLI_VERSION = '0.0.4';

/**
 * Runs the CLI application using the provided command-line arguments.
 * @param args The array of command line arguments (typically `process.argv.slice(2)`).
 * @returns A promise that resolves when execution completes.
 */
export async function run(args: string[]): Promise<void> {
    const config = parseArgs(args);
    if (config.version) {
        console.log(CLI_VERSION);
        process.exit(0);
    }
    if (!config.inputSpec) {
        console.error(
            'Usage: cdd-docs-cli -i <path-to-openapi-or-arazzo.yaml> [-a|--arazzo <path-to-arazzo.yaml>] [-o <output-dir>] [-t <theme>] [-w|--watch] [-p|--port <port>]',
        );
        process.exit(1);
    }
    await generate(config);

    if (config.watchMode) {
        await startWatchServer(config);
    }
}

/**
 * Parses the CLI arguments into a strongly-typed `CliConfig` object.
 * @param args The command line arguments to parse.
 * @returns A `CliConfig` object containing the parsed configuration options.
 */
export function parseArgs(args: string[]): CliConfig {
    let inputSpec = '';
    let arazzoSpec: string | undefined;
    let outputDir = './dist';
    let theme: 'light' | 'dark' = 'light';
    let watchMode = false;
    let port = 3000;
    let version = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '-v' || arg === '--version') {
            version = true;
        } else if (arg === '-i' || arg === '--input') {
            inputSpec = args[++i] || '';
        } else if (arg === '-a' || arg === '--arazzo') {
            arazzoSpec = args[++i] || undefined;
        } else if (arg === '-o' || arg === '--output') {
            outputDir = args[++i] || '';
        } else if (arg === '-t' || arg === '--theme') {
            const themeArg = args[++i];
            theme = themeArg === 'dark' ? 'dark' : 'light';
        } else if (arg === '-w' || arg === '--watch') {
            watchMode = true;
        } else if (arg === '-p' || arg === '--port') {
            const portStr = args[++i];
            if (portStr) {
                const parsedPort = parseInt(portStr, 10);
                if (!Number.isNaN(parsedPort) && parsedPort > 0) {
                    port = parsedPort;
                }
            }
        }
    }
    const config: CliConfig = { inputSpec, outputDir, theme, watchMode, port, version };
    if (arazzoSpec !== undefined) {
        config.arazzoSpec = arazzoSpec;
    }
    return config;
}

/**
 * Generates the API documentation artifacts based on the configuration.
 * @param config The parsed CLI configuration object.
 * @returns A boolean indicating whether generation was successful.
 */
export async function generate(config: CliConfig): Promise<boolean> {
    const { inputSpec, arazzoSpec, outputDir, theme, watchMode } = config;
    const specPath = resolve(process.cwd(), inputSpec);
    const outPath = resolve(process.cwd(), outputDir);
    const outHtmlPath = resolve(outPath, 'index.html');
    let tempSpecPath: string | null = null;
    let tempArazzoPath: string | null = null;

    try {
        let specContent = '';
        let effectiveSpecPath = specPath;

        const isUrl = isSpecUrl(inputSpec.trim(), () => fs.existsSync(specPath));

        if (isUrl) {
            const url = normalizeSpecUrl(inputSpec);
            console.log(`Fetching OpenAPI spec from ${url}...`);
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`Failed to fetch spec from URL: ${res.status} ${res.statusText}`);
            }
            specContent = await res.text();
            tempSpecPath = resolve(os.tmpdir(), `.temp-spec-${process.pid}-${++tempFileCounter}.yaml`);
            effectiveSpecPath = tempSpecPath;
            fs.writeFileSync(effectiveSpecPath, specContent);
        } else {
            specContent = fs.readFileSync(specPath, 'utf-8');
        }

        let companionArazzoContent: string | undefined;
        let effectiveArazzoPath: string | undefined;
        if (arazzoSpec) {
            const arazzoLocalPath = resolve(process.cwd(), arazzoSpec);
            const isArazzoUrl = isSpecUrl(arazzoSpec.trim(), () => fs.existsSync(arazzoLocalPath));

            if (isArazzoUrl) {
                const arazzoUrl = normalizeSpecUrl(arazzoSpec);
                const arazzoRes = await fetch(arazzoUrl);
                if (!arazzoRes.ok) {
                    throw new Error(
                        `Failed to fetch Arazzo spec from URL: ${arazzoRes.status} ${arazzoRes.statusText}`,
                    );
                }
                companionArazzoContent = await arazzoRes.text();
                tempArazzoPath = resolve(os.tmpdir(), `.temp-arazzo-${process.pid}-${++tempFileCounter}.yaml`);
                effectiveArazzoPath = tempArazzoPath;
                fs.writeFileSync(effectiveArazzoPath, companionArazzoContent);
            } else {
                companionArazzoContent = fs.readFileSync(arazzoLocalPath, 'utf-8');
                effectiveArazzoPath = arazzoLocalPath;
            }
        }

        const parsedData = normalizeSpec(specContent, companionArazzoContent);

        console.log('Generating documentation snippets via cdd-ctl...');
        const examples = await generateAllSnippets(
            undefined,
            effectiveSpecPath,
            parsedData.spec,
            undefined,
            parsedData.arazzoSpec,
        );

        if (effectiveArazzoPath && parsedData.arazzoSpec) {
            const arazzoExamples = await generateAllSnippets(
                undefined,
                effectiveArazzoPath,
                parsedData.spec,
                undefined,
                parsedData.arazzoSpec,
            );
            examples.push(...arazzoExamples);
        }

        console.log('Compiling static HTML...');
        const html = generateAOTHtml(specContent, examples, theme, watchMode, {}, companionArazzoContent);

        if (!fs.existsSync(outPath)) {
            fs.mkdirSync(outPath, { recursive: true });
        }

        fs.writeFileSync(outHtmlPath, html);
        console.log('Successfully generated API documentation at ' + outHtmlPath);
        return true;
    } catch (err) {
        console.error('Failed to generate documentation:', err);
        return false;
    } finally {
        if (tempSpecPath && typeof fs.unlinkSync === 'function' && fs.existsSync(tempSpecPath)) {
            fs.unlinkSync(tempSpecPath);
        }
        if (tempArazzoPath && typeof fs.unlinkSync === 'function' && fs.existsSync(tempArazzoPath)) {
            fs.unlinkSync(tempArazzoPath);
        }
    }
}

/**
 * Starts a watch server to regenerate the API docs and notify connected clients on changes.
 * @param config The parsed CLI configuration object.
 * @returns The active HTTP server instance.
 */
export async function startWatchServer(config: CliConfig): Promise<ReturnType<express.Application['listen']>> {
    const { inputSpec, arazzoSpec, outputDir, port } = config;
    const specPath = resolve(process.cwd(), inputSpec);
    const outPath = resolve(process.cwd(), outputDir);
    const app = express();
    app.use(express.static(outPath));

    let clients: express.Response[] = [];

    app.get('/__livereload', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        clients.push(res);
        req.on('close', () => {
            clients = clients.filter(client => client !== res);
        });
    });

    // SPA fallback route
    app.get('*', (req, res, next) => {
        if (req.accepts('html')) {
            const indexHtml = resolve(outPath, 'index.html');
            if (fs.existsSync(indexHtml)) {
                res.sendFile(indexHtml);
                return;
            }
        }
        next();
    });

    const server = app.listen(port, () => {
        console.log(`Watching for changes... Server running at http://localhost:${port}`);
    });

    let isGenerating = false;
    const handleFileWatch =
        (watchedLabel: string) =>
        async (eventType: string): Promise<void> => {
            if (isGenerating) return;
            isGenerating = true;
            console.log(`
Detected ${eventType} on ${watchedLabel}, regenerating...`);
            const success = await generate(config);
            if (success) {
                clients.forEach(client => client.write('data: reload\n\n'));
            }
            setTimeout(() => {
                isGenerating = false;
            }, 500);
        };

    const watchers: fs.FSWatcher[] = [];
    if (fs.existsSync(specPath)) {
        watchers.push(fs.watch(specPath, handleFileWatch(inputSpec)));
    } else {
        console.log(
            `Cannot watch URL or non-existent local file: ${inputSpec}. Watch server is running but file changes won't be detected.`,
        );
    }

    if (arazzoSpec) {
        const arazzoLocalPath = resolve(process.cwd(), arazzoSpec);
        if (fs.existsSync(arazzoLocalPath)) {
            watchers.push(fs.watch(arazzoLocalPath, handleFileWatch(arazzoSpec)));
        }
    }

    if (server && typeof server.on === 'function') {
        server.on('close', () => {
            for (const w of watchers) {
                if (w && typeof w.close === 'function') {
                    w.close();
                }
            }
        });
    }

    return server;
}

/**
 * Checks whether the current module is being executed directly as the main CLI entry point.
 * @param argv1 The `process.argv[1]` script path.
 * @param metaUrl The `import.meta.url` of the module.
 * @returns True if `argv1` matches the file path resolved from `metaUrl`.
 */
export function checkIsMainModule(argv1: string | undefined, metaUrl: string): boolean {
    if (!argv1 || !metaUrl) return false;
    try {
        return argv1 === fileURLToPath(metaUrl);
    } catch {
        return false;
    }
}

/**
 * Bootstraps CLI execution if invoked directly as the main entry point.
 * @param argv Process arguments array (defaults to `process.argv`).
 * @param metaUrl Module URL (defaults to `import.meta.url`).
 */
export function bootstrapCli(argv: string[] = process.argv, metaUrl: string = import.meta.url): void {
    if (checkIsMainModule(argv[1], metaUrl)) {
        void run(argv.slice(2));
    }
}

bootstrapCli();
