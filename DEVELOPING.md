# Developing CDD Docs UI

![Test Coverage](https://img.shields.io/badge/Test_Coverage-100%25-brightgreen.svg) ![Doc Coverage](https://img.shields.io/badge/Doc_Coverage-100%25-brightgreen.svg)

This guide outlines how to set up the development environment, make changes, run tests, and test the generated outputs locally.

## Prerequisites

- **Node.js**: v18 or later.
- **npm**: v9 or later.

## Setup

1. **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd cdd-docs-ui
    ```

2. **Install dependencies:**

    ```bash
    npm install
    ```

3. **Link the CLI tool globally (optional):**
   This allows you to test the command from anywhere in your filesystem.
    ```bash
    npm link
    ```

## Workflow

The project is written in strictly-typed TypeScript within the `src/` directory. It is a dual-mode tool outputting both a CLI (`dist/cli.js`) and a client-side bundle (`dist/bundle.js`).

### Project Structure

- `src/cli.ts`: Executable entrypoint for the AOT static generator.
- `src/web-component.ts`: Entrypoint for the client-side SPA `<cdd-api-docs>`.
- `src/aot-generator.ts`: Core HTML generation logic for CLI mode (uses TypeScript string literals and `marked`).
- `src/parser.ts`: OpenAPI specification parsing logic.
- `src/runner.ts`: Core logic for executing external `cdd-ctl` processes.
- `src/types.ts` & `src/openapi-types.ts`: Strict typings for the project.
- `tests/`: Vitest test files (`*.spec.ts`).
- `example/`: Holds sample OpenAPI specs (`spec.json`) and the generated output (`public/`).
- `test-public/`: Used for integration testing of the Web Component.

### Making Changes

When making changes, particularly to the generator (`src/aot-generator.ts`) or the web component (`src/web-component.ts`), be aware of the 100% test coverage requirement.

1. **Write your code.**
2. **Update the corresponding `*.spec.ts` files** in the `tests/` directory to cover the new branches or logic.
3. Ensure no `any` or `unknown` types are introduced; strictly define interfaces.

### Building and Testing

The `package.json` includes several scripts to streamline development.

- **Build the project:** uses `esbuild` to transpile TypeScript to `dist/bundle.js` and `dist/cli.js`.

    ```bash
    npm run build
    ```

- **Run Tests:** Executes Vitest and asserts 100% coverage across all metrics.

    ```bash
    npm run test
    ```

- **Generate Example Output (AOT Mode):** Uses the internal CLI to parse `example/spec.json` and outputs the static site to `example/public/`. This automatically runs the `build` script first.

    ```bash
    npm start
    ```

- **Preview the Site locally:** Uses `serve` to run a local server on the generated `example/public/` folder.
    ```bash
    npm run serve
    ```

## Working with CDD Tools

The `runner.ts` module attempts to execute the `to_docs_json` command on your system for 13 different languages via the unified `cdd-ctl` binary.

For example:

- `cdd-ctl python-all to_docs_json -i <path>`
- `cdd-ctl go to_docs_json -i <path>`
- etc.

For every language, it runs four permutations to support formatting checkboxes:

1. `(default)`
2. `--no-imports`
3. `--no-wrapping`
4. `--no-imports --no-wrapping`

**If you do not have this tool installed globally**, the runner will catch the errors, log a `[WARN]`, and automatically generate mock text like:
`FAILED CLI COMMAND cdd-ctl python-all (variant: noImports)`

This graceful degradation ensures you can still test the UI layout and interactivity without needing a massive toolchain installed locally.

## Releasing Changes

Before submitting a PR, ensure you have run the following pipeline:

```bash
npm run build
npm run test
npm start
```

If the tests pass with 100% coverage, and the site generates successfully, your changes are ready for review.
