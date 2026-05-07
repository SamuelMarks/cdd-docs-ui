
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      all: true,
      include: ["src/**/*.ts"],
      exclude: ["src/cli.ts", "src/types.ts", "src/openapi-types.ts", "**/*.spec.ts"],
      lines: 95,
      functions: 95,
      branches: 85,
      statements: 95
    }
  }
});
