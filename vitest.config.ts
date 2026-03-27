
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
      exclude: ["src/cli.ts", "src/types.ts", "**/*.spec.ts"],
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100
    }
  }
});
