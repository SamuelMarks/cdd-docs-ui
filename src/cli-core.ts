/**
 * @fileoverview Encapsulates the core CLI application logic using Commander.
 */
import { Command } from 'commander';
import { generateSite } from './generator';
import type { CLIOptions } from './types';

/**
 * Initializes and executes the CLI application.
 *
 * @param argv - The process arguments array (e.g., process.argv).
 * @returns A promise that resolves to true if generation succeeded, false otherwise.
 */
export async function runCli(argv: string[]): Promise<boolean> {
  const program = new Command();
  let success = false;

  program
    .name('cdd-docs-ui')
    .description('CLI to generate static API documentation from OpenAPI spec')
    .version('1.0.0')
    .option('-i, --input <path>', 'Path to OpenAPI spec (JSON)', 'spec.json')
    .option('-o, --output <path>', 'Output directory for generated site', 'public')
    .option('--no-imports', 'Do not include imports in generated code examples')
    .option('--no-wrapping', 'Do not wrap code examples in class/function definitions')
    .action(async (options: Record<string, unknown>) => {
      try {
        console.log(`Generating API documentation from ${String(options['input'])}...`);
        const runOptions: CLIOptions = {
          inputPath: String(options['input']),
          outputPath: String(options['output']),
          // Commander maps --no-x to x: false
          noImports: options['imports'] === false,
          noWrapping: options['wrapping'] === false
        };
        
        await generateSite(runOptions);
        console.log(`Successfully generated site at ${String(options['output'])}`);
        success = true;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        console.error('Error generating site:', err.message);
        success = false;
      }
    });

  await program.parseAsync(argv);
  return success;
}