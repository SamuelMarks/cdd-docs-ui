import { describe, it, expect, vi, afterEach } from "vitest";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { runCddCtl, parseCDDOutput, generateMockFallback, generateVariant, generateAllSnippets, SUPPORTED_LANGUAGES, resolveCddCtlPath } from "../src/runner";
import { OpenAPI320 } from "../src/types";

vi.mock("node:child_process", () => ({
    execFile: vi.fn(),
}));

vi.mock("node:fs", () => ({
    default: { existsSync: vi.fn() },
    existsSync: vi.fn(),
}));

describe("runner.ts", () => {
    afterEach(() => {
        vi.clearAllMocks();
        delete process.env.CDD_CTL_PATH;
    });

    describe("resolveCddCtlPath", () => {
        it("should return process.env.CDD_CTL_PATH if it exists", () => {
            process.env.CDD_CTL_PATH = "/custom/path/cdd-ctl";
            vi.mocked(fs.existsSync).mockReturnValueOnce(true);
            
            const resolved = resolveCddCtlPath();
            expect(resolved).toBe(path.resolve("/custom/path/cdd-ctl"));
            expect(fs.existsSync).toHaveBeenCalledWith("/custom/path/cdd-ctl");
        });

        it("should return local path if it exists and env var is not set", () => {
            vi.mocked(fs.existsSync).mockReturnValueOnce(true);
            
            const resolved = resolveCddCtlPath();
            expect(resolved).toBe(path.resolve(process.cwd(), "cdd-ctl"));
            expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(process.cwd(), "cdd-ctl"));
        });

        it("should return default './cdd-ctl' if nothing exists", () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);
            
            const resolved = resolveCddCtlPath();
            expect(resolved).toBe("./cdd-ctl");
        });
    });

    describe("runCddCtl", () => {
        it("should securely execute cdd-ctl with the correct arguments", async () => {
            const mockExecFile = vi.mocked(execFile).mockImplementation((...args: any[]) => {
                const callback = args[args.length - 1];
                callback(null, { stdout: "mock_stdout", stderr: "mock_stderr" });
                return {} as any;
            });

            const stdout = await runCddCtl("typescript", "spec.json");

            expect(stdout).toBe("mock_stdout");
            expect(mockExecFile).toHaveBeenCalledTimes(1);
            expect(mockExecFile.mock.calls[0][0]).toBe("./cdd-ctl");
            expect(mockExecFile.mock.calls[0][1]).toEqual(["typescript", "to_docs_json", "-i", "spec.json"]);
        });

        it("should allow overriding the cdd-ctl binary path", async () => {
            const mockExecFile = vi.mocked(execFile).mockImplementation((...args: any[]) => {
                const callback = args[args.length - 1];
                callback(null, { stdout: "success", stderr: "" });
                return {} as any;
            });

            const stdout = await runCddCtl("python", "spec.yaml", { cddCtlPath: "/usr/local/bin/cdd-ctl" });

            expect(stdout).toBe("success");
            expect(mockExecFile.mock.calls[0][0]).toBe("/usr/local/bin/cdd-ctl");
            expect(mockExecFile.mock.calls[0][1]).toEqual(["python", "to_docs_json", "-i", "spec.yaml"]);
        });

        it("should pass --no-imports flag when noImports is true", async () => {
            const mockExecFile = vi.mocked(execFile).mockImplementation((...args: any[]) => {
                const callback = args[args.length - 1];
                callback(null, { stdout: "success", stderr: "" });
                return {} as any;
            });

            await runCddCtl("go", "spec.json", { noImports: true });
            expect(mockExecFile.mock.calls[0][1]).toEqual(["go", "to_docs_json", "-i", "spec.json", "--no-imports"]);
        });

        it("should pass --no-wrapping flag when noWrapping is true", async () => {
            const mockExecFile = vi.mocked(execFile).mockImplementation((...args: any[]) => {
                const callback = args[args.length - 1];
                callback(null, { stdout: "success", stderr: "" });
                return {} as any;
            });

            await runCddCtl("rust", "spec.json", { noWrapping: true });
            expect(mockExecFile.mock.calls[0][1]).toEqual(["rust", "to_docs_json", "-i", "spec.json", "--no-wrapping"]);
        });

        it("should pass both flags when both options are true", async () => {
            const mockExecFile = vi.mocked(execFile).mockImplementation((...args: any[]) => {
                const callback = args[args.length - 1];
                callback(null, { stdout: "success", stderr: "" });
                return {} as any;
            });

            await runCddCtl("java", "spec.json", { noImports: true, noWrapping: true });
            expect(mockExecFile.mock.calls[0][1]).toEqual(["java", "to_docs_json", "-i", "spec.json", "--no-imports", "--no-wrapping"]);
        });

        it("should reject if execFile fails", async () => {
            const mockError = new Error("Command failed");
            vi.mocked(execFile).mockImplementation((...args: any[]) => {
                const callback = args[args.length - 1];
                callback(mockError);
                return {} as any;
            });

            await expect(runCddCtl("rust", "spec.json")).rejects.toThrow("Command failed");
        });
    });

    describe("parseCDDOutput", () => {
        it("should correctly parse valid CDDOutput JSON", () => {
            const json = JSON.stringify({
                endpoints: {
                    "/users": { get: "console.log('users');" }
                }
            });
            const result = parseCDDOutput(json);
            expect(result.endpoints["/users"].get).toBe("console.log('users');");
        });

        it("should throw error for invalid JSON", () => {
            expect(() => parseCDDOutput("invalid-json")).toThrow("Failed to parse cdd-ctl output as JSON");
        });

        it("should throw error if endpoints object is missing", () => {
            expect(() => parseCDDOutput("{}")).toThrow("Invalid CDDOutput structure: missing endpoints object");
            expect(() => parseCDDOutput(JSON.stringify({ notEndpoints: {} }))).toThrow("Invalid CDDOutput structure: missing endpoints object");
            expect(() => parseCDDOutput(JSON.stringify({ endpoints: null }))).toThrow("Invalid CDDOutput structure: missing endpoints object");
        });

        it("should throw error if endpoints values are not objects", () => {
            const invalid = JSON.stringify({ endpoints: { "/test": "not-an-object" } });
            expect(() => parseCDDOutput(invalid)).toThrow("Invalid CDDOutput structure: endpoints['/test'] must be an object");
        });

        it("should throw error if methods are not strings", () => {
            const invalid = JSON.stringify({ endpoints: { "/test": { get: 123 } } });
            expect(() => parseCDDOutput(invalid)).toThrow("Invalid CDDOutput structure: endpoints['/test']['get'] must be a string");
        });
    });

    describe("generateMockFallback", () => {
        const dummySpec: OpenAPI320 = {
            openapi: "3.2.0",
            info: { title: "Test", version: "1.0.0" },
            paths: {
                "/test": { get: { responses: {} }, post: { responses: {} } },
                "/empty": {},
                "/ref": { $ref: "#/some/ref" }
            }
        };

        it("should generate default variant mocks correctly", () => {
            const mock = generateMockFallback("python", dummySpec);
            expect(mock.endpoints["/test"].get).toBe("FAILED CLI COMMAND ./cdd-ctl python (variant: default)");
            expect(mock.endpoints["/test"].post).toBe("FAILED CLI COMMAND ./cdd-ctl python (variant: default)");
            expect(mock.endpoints["/empty"]).toEqual({});
            expect(mock.endpoints["/ref"]).toBeUndefined(); // references skipped
        });

        it("should generate variant mocks reflecting options", () => {
            const mock1 = generateMockFallback("go", dummySpec, { noImports: true });
            expect(mock1.endpoints["/test"].get).toContain("(variant: noImports)");

            const mock2 = generateMockFallback("java", dummySpec, { noWrapping: true });
            expect(mock2.endpoints["/test"].get).toContain("(variant: noWrapping)");

            const mock3 = generateMockFallback("rust", dummySpec, { noImports: true, noWrapping: true });
            expect(mock3.endpoints["/test"].get).toContain("(variant: noImportsNoWrapping)");
        });

        it("should return empty endpoints if spec has no paths", () => {
            const emptySpec = { ...dummySpec };
            delete emptySpec.paths;
            const mock = generateMockFallback("ts", emptySpec);
            expect(mock.endpoints).toEqual({});
        });
    });

    describe("generateVariant", () => {
        const dummySpec: OpenAPI320 = { openapi: "3.2.0", info: { title: "", version: "" } };

        it("should return parsed CDDOutput on success", async () => {
            const validOutput = { endpoints: { "/api": { get: "success code" } } };
            vi.mocked(execFile).mockImplementation((...args: any[]) => {
                const callback = args[args.length - 1];
                callback(null, { stdout: JSON.stringify(validOutput), stderr: "" });
                return {} as any;
            });

            const result = await generateVariant("c", "spec.json", dummySpec);
            expect(result).toEqual(validOutput);
        });

        it("should catch errors and return mock fallback on exec failure", async () => {
            vi.mocked(execFile).mockImplementation((...args: any[]) => {
                const callback = args[args.length - 1];
                callback(new Error("Subprocess crashed"));
                return {} as any;
            });

            const specWithPaths: OpenAPI320 = { ...dummySpec, paths: { "/path": { get: { responses: {} } } } };
            const result = await generateVariant("ruby", "spec.json", specWithPaths);
            
            expect(result.endpoints["/path"].get).toBe("FAILED CLI COMMAND ./cdd-ctl ruby (variant: default)");
        });

        it("should catch errors and return mock fallback on parse failure", async () => {
            vi.mocked(execFile).mockImplementation((...args: any[]) => {
                const callback = args[args.length - 1];
                callback(null, { stdout: "invalid json", stderr: "" });
                return {} as any;
            });

            const specWithPaths: OpenAPI320 = { ...dummySpec, paths: { "/path": { get: { responses: {} } } } };
            const result = await generateVariant("php", "spec.json", specWithPaths);
            
            expect(result.endpoints["/path"].get).toBe("FAILED CLI COMMAND ./cdd-ctl php (variant: default)");
        });
    });

    describe("generateAllSnippets", () => {
        const dummySpec: OpenAPI320 = { openapi: "3.2.0", info: { title: "", version: "" } };

        it("should generate 4 variants for each language provided", async () => {
            const validOutput = { endpoints: { "/api": { get: "code" } } };
            const mockExecFile = vi.mocked(execFile).mockImplementation((...args: any[]) => {
                const callback = args[args.length - 1];
                callback(null, { stdout: JSON.stringify(validOutput), stderr: "" });
                return {} as any;
            });

            const langs = ["go", "python-all"];
            const results = await generateAllSnippets(langs, "spec.json", dummySpec);

            // 2 langs * 4 variants * 1 method = 8 CodeExamples
            expect(results.length).toBe(8);
            expect(mockExecFile).toHaveBeenCalledTimes(8);

            // Verify mapping
            expect(results).toContainEqual({
                language: "go",
                filepath: "_api_get",
                content: "code",
                includeImports: true,
                includeWrapping: true
            });

            // Verify python-all mapped to python
            expect(results).toContainEqual(expect.objectContaining({
                language: "python"
            }));
        });
    });
});
