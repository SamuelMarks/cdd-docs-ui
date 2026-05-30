#!/usr/bin/env node
import fs from 'fs';
import { resolve } from 'path';
import { generateAOTHtml } from './aot-generator';
import { generateAllSnippets } from './runner';
import { normalizeSpec } from './parser';
import express from 'express';

/**
 * Runs the CLI application using the provided command-line arguments.
 * @param args The array of command line arguments (typically process.argv.slice(2)).
 */
export async function run(args: string[]) {
    const config = parseArgs(args);
    if (config.version) {
        console.log('0.0.1');
        process.exit(0);
    }
    if (!config.inputSpec) {
        console.error(
            'Usage: cdd-docs-cli -i <path-to-openapi.yaml> [-o <output-dir>] [-t <theme>] [-w|--watch] [-p|--port <port>]',
        );
        process.exit(1);
    }
    await generate(config);

    if (config.watchMode) {
        await startWatchServer(config);
    }
}

/**
 * Parses the CLI arguments into a configuration object.
 * @param args The command line arguments to parse.
 * @returns An object containing the parsed configuration options.
 */
export function parseArgs(args: string[]): {
    /** The input OpenAPI specification path or URL. */
    inputSpec: string;
    /** The output directory path. */
    outputDir: string;
    /** The visual theme (light or dark). */
    theme: 'light' | 'dark';
    /** Whether to enable watch mode with a live-reload server. */
    watchMode: boolean;
    /** The port for the live-reload server. */
    port: number;
    /** Whether the version flag was passed. */
    version: boolean;
} {
    let inputSpec = '';
    let outputDir = './dist';
    let theme: 'light' | 'dark' = 'light';
    let watchMode = false;
    let port = 3000;
    let version = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '-v' || args[i] === '--version') {
            version = true;
        } else if (args[i] === '-i' || args[i] === '--input') {
            inputSpec = args[++i] || '';
        } else if (args[i] === '-o' || args[i] === '--output') {
            outputDir = args[++i] || '';
        } else if (args[i] === '-t' || args[i] === '--theme') {
            theme = (args[++i] as 'light' | 'dark') || 'light';
        } else if (args[i] === '-w' || args[i] === '--watch') {
            watchMode = true;
        } else if (args[i] === '-p' || args[i] === '--port') {
            const portStr = args[++i];
            if (portStr) {
                port = parseInt(portStr, 10);
            }
        }
    }
    return { inputSpec, outputDir, theme, watchMode, port, version };
}

/**
 * Generates the API documentation artifacts based on the configuration.
 * @param config The parsed CLI configuration object.
 * @returns A boolean indicating whether generation was successful.
 */
export async function generate(config: ReturnType<typeof parseArgs>) {
    const { inputSpec, outputDir, theme, watchMode } = config;
    const specPath = resolve(process.cwd(), inputSpec);
    const outPath = resolve(process.cwd(), outputDir);
    const outHtmlPath = resolve(outPath, 'index.html');

    try {
        let specContent = '';
        let effectiveSpecPath = specPath;

        const isUrl =
            /^https?:\/\//i.test(inputSpec) ||
            (!inputSpec.includes('\n') && inputSpec.includes('/') && !fs.existsSync(resolve(process.cwd(), inputSpec)));

        if (isUrl) {
            let url = inputSpec;
            if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
            console.log(`Fetching OpenAPI spec from ${url}...`);
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Failed to fetch spec from URL: ${res.status} ${res.statusText}`);
            specContent = await res.text();
            effectiveSpecPath = resolve(process.cwd(), '.temp-spec.yaml');
            fs.writeFileSync(effectiveSpecPath, specContent);
        } else {
            specContent = fs.readFileSync(specPath, 'utf-8');
        }

        const parsedData = normalizeSpec(specContent);

        console.log('Generating documentation snippets via cdd-ctl...');
        const examples = await generateAllSnippets(undefined, effectiveSpecPath, parsedData.spec);

        console.log('Compiling static HTML...');
        const html = generateAOTHtml(specContent, examples, theme, watchMode);

        if (!fs.existsSync(outPath)) {
            fs.mkdirSync(outPath, { recursive: true });
        }

        fs.writeFileSync(outHtmlPath, html);
        console.log('Successfully generated API documentation at ' + outHtmlPath);
        return true;
    } catch (err) {
        console.error('Failed to generate documentation:', err);
        return false;
    }
}

/**
 * Starts a watch server to regenerate the API docs and notify connected clients on changes.
 * @param config The parsed CLI configuration object.
 * @returns The active Express server instance.
 */
export async function startWatchServer(config: ReturnType<typeof parseArgs>) {
    const { inputSpec, outputDir, port } = config;
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

    const server = app.listen(port, () => {
        console.log(`Watching for changes... Server running at http://localhost:${port}`);
    });

    let isGenerating = false;
    if (fs.existsSync(specPath)) {
        fs.watch(specPath, async eventType => {
            if (isGenerating) return;
            isGenerating = true;
            console.log(`\nDetected ${eventType} on ${inputSpec}, regenerating...`);
            const success = await generate(config);
            if (success) {
                clients.forEach(client => client.write('data: reload\n\n'));
            }
            setTimeout(() => {
                isGenerating = false;
            }, 500); // Debounce
        });
    } else {
        console.log(
            `Cannot watch URL or non-existent local file: ${inputSpec}. Watch server is running but file changes won't be detected.`,
        );
    }
    return server;
}

// Execute if run directly
import { fileURLToPath } from 'url';
const isMainModule = typeof process !== 'undefined' && process.argv && process.argv[1] === fileURLToPath(import.meta.url);
/* istanbul ignore next */
if (isMainModule) {
    run(process.argv.slice(2));
}
