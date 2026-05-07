#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync, watch } from "fs";
import { resolve } from "path";
import { generateAOTHtml } from "./aot-generator";
import { generateAllSnippets } from "./runner";
import { normalizeSpec } from "./parser";
import express from "express";

const args = process.argv.slice(2);
let inputSpec = "";
let outputDir = "./dist";
let theme: "light" | "dark" = "light";
let watchMode = false;
let port = 3000;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "-i" || args[i] === "--input") {
    inputSpec = args[++i];
  } else if (args[i] === "-o" || args[i] === "--output") {
    outputDir = args[++i];
  } else if (args[i] === "-t" || args[i] === "--theme") {
    theme = args[++i] as "light" | "dark";
  } else if (args[i] === "-w" || args[i] === "--watch") {
    watchMode = true;
  } else if (args[i] === "-p" || args[i] === "--port") {
    port = parseInt(args[++i], 10);
  }
}

if (!inputSpec) {
  console.error("Usage: cdd-docs-cli -i <path-to-openapi.yaml> [-o <output-dir>] [-t <theme>] [-w|--watch] [-p|--port <port>]");
  process.exit(1);
}

const specPath = resolve(process.cwd(), inputSpec);
const outPath = resolve(process.cwd(), outputDir);
const outHtmlPath = resolve(outPath, "index.html");

async function generate() {
  try {
    const specContent = readFileSync(specPath, "utf-8");
    const parsedData = normalizeSpec(specContent);
    
    console.log("Generating documentation snippets via cdd-ctl...");
    const examples = await generateAllSnippets(undefined, specPath, parsedData.spec);

    console.log("Compiling static HTML...");
    const html = generateAOTHtml(specContent, examples, theme, watchMode);

    if (!existsSync(outPath)) {
      mkdirSync(outPath, { recursive: true });
    }
    
    writeFileSync(outHtmlPath, html);
    console.log("Successfully generated API documentation at " + outHtmlPath);
    return true;
  } catch (err) {
    console.error("Failed to generate documentation:", err);
    return false;
  }
}

async function run() {
  await generate();

  if (watchMode) {
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

    app.listen(port, () => {
      console.log(`Watching for changes... Server running at http://localhost:${port}`);
    });

    let isGenerating = false;
    watch(specPath, async (eventType) => {
      if (isGenerating) return;
      isGenerating = true;
      console.log(`\nDetected ${eventType} on ${inputSpec}, regenerating...`);
      const success = await generate();
      if (success) {
        clients.forEach(client => client.write('data: reload\n\n'));
      }
      setTimeout(() => { isGenerating = false; }, 500); // Debounce
    });
  }
}

run();
