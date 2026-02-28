# Developing CDD Docs UI

This guide outlines how to set up the development environment, make changes, run tests, and test the generated site locally.

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

The project is written in strictly-typed TypeScript within the `src/` directory. The main CLI entrypoint is in `bin/cli.ts`.

### Project Structure

- `bin/`: Executable entrypoints (`cli.ts`, `serve.ts`).
- `src/`: Core logic (`cli-core.ts`, `generator.ts`, `runner.ts`, `server.ts`, `types.ts`).
- `src/templates/`: EJS HTML layouts (`layout.ejs`).
- `tests/`: Jest test files (`*.test.ts`).
- `example/`: Holds a sample OpenAPI spec (`spec.json`) and the generated output (`public/`).

### Making Changes

When making changes, particularly to the generator (`src/generator.ts`) or the template (`src/templates/layout.ejs`), be aware of the 100% test coverage requirement.

1. **Write your code.**
2. **Update the corresponding `*.test.ts` files** in the `tests/` directory to cover the new branches or logic.
3. Ensure no `any` or `unknown` types are introduced; strictly define interfaces in `src/types.ts`.

### Building and Testing

The `package.json` includes several scripts to streamline development.

- **Build the project:** transpiles TypeScript to `dist/` and copies the `src/templates/` folder.

    ```bash
    npm run build
    ```

- **Run Tests:** Executes Jest and asserts 100% coverage across all metrics.

    ```bash
    npm run test
    ```

- **Generate Example Output:** Uses the internal CLI to parse `example/spec.json` and outputs the static site to `example/public/`. This automatically runs the `build` script first.

    ```bash
    npm start
    ```

- **Preview the Site locally:** Starts an Express server on `http://localhost:8000` to serve the generated `example/public/` folder.
    ```bash
    npm run serve
    ```

## Working with CDD Tools

The `runner.ts` module attempts to execute the following commands on your system:

- `cdd_python_client to_docs_json -i <path>`
- `cdd_go to_docs_json -i <path>`
- `cdd_csharp to_docs_json -i <path>`
- `cdd_c to_docs_json -i <path>`
- `cdd_kotlin to_docs_json -i <path>`
- `cdd_swift to_docs_json -i <path>`
- `cdd_sh to_docs_json -i <path>`
- `cdd_web_ng to_docs_json -i <path>`

For every language, it runs four permutations to support checkboxes in the UI:

1. `(default)`
2. `--no-imports`
3. `--no-wrapping`
4. `--no-imports --no-wrapping`

**If you do not have these tools installed globally**, the runner will catch the `Command failed` errors, log a `[WARN]`, and automatically generate mock text like:
`FAILED CLI COMMAND cdd_python (variant: noImports)`

This graceful degradation ensures you can still test the UI layout, JavaScript interactivity, and templating engine without needing a massive toolchain installed locally.

## Releasing Changes

Before submitting a PR, ensure you have run the following pipeline:

```bash
npm run build
npm run test
npm start
```

If the tests pass with 100% coverage, and the site generates successfully, your changes are ready for review.
