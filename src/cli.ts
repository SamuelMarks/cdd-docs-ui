#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import { generateAOTHtml } from "./aot-generator";

const args = process.argv.slice(2);
let inputSpec = "";
let outputDir = "./dist";
let theme: "light" | "dark" = "light";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "-i" || args[i] === "--input") {
    inputSpec = args[++i];
  } else if (args[i] === "-o" || args[i] === "--output") {
    outputDir = args[++i];
  } else if (args[i] === "-t" || args[i] === "--theme") {
    theme = args[++i] as "light" | "dark";
  }
}

if (!inputSpec) {
  console.error("Usage: cdd-docs-cli -i <path-to-openapi.yaml> [-o <output-dir>] [-t <theme>]");
  process.exit(1);
}

try {
  const specContent = readFileSync(resolve(process.cwd(), inputSpec), "utf-8");
  const html = generateAOTHtml(specContent, [], theme);
  
  const outPath = resolve(process.cwd(), outputDir);
  if (!existsSync(outPath)) {
    mkdirSync(outPath, { recursive: true });
  }
  
  writeFileSync(resolve(outPath, "index.html"), html);
  console.log("Successfully generated API documentation at " + resolve(outPath, "index.html"));
} catch (err) {
  console.error("Failed to generate documentation:", err);
  process.exit(1);
}
