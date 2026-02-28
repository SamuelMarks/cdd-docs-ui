/**
 * @fileoverview Type definitions for the CDD Docs UI tool.
 * Provides strict TypeScript interfaces for CLI options and OpenAPI structures.
 */

/**
 * CLI Options passed to the generator.
 */
export interface CLIOptions {
  /** Path to the OpenAPI spec JSON file. */
  inputPath: string;
  /** Output directory path. */
  outputPath: string;
  /** Whether to omit import statements in generated code. */
  noImports?: boolean;
  /** Whether to omit function/class wrapping in generated code. */
  noWrapping?: boolean;
}

/**
 * Information section of an OpenAPI Schema.
 */
export interface OpenAPIInfo {
  /** Title of the API. */
  title?: string;
  /** Version of the API. */
  version?: string;
  /** Description of the API. */
  description?: string;
}

/**
 * Parameter definition in an OpenAPI Schema.
 */
export interface OpenAPIParameter {
  /** Name of the parameter. */
  name: string;
  /** Location of the parameter (e.g., 'query', 'header'). */
  in: string;
  /** Whether the parameter is required. */
  required?: boolean;
  /** Description of the parameter. */
  description?: string;
  /** Schema definition for the parameter. */
  schema?: {
    /** Data type of the schema. */
    type?: string;
  };
  /** Legacy type definition for the parameter. */
  type?: string;
}

/**
 * Endpoint definition in an OpenAPI Schema.
 */
export interface OpenAPIEndpoint {
  /** Summary of the endpoint operation. */
  summary?: string;
  /** Detailed description of the endpoint operation. */
  description?: string;
  /** Tags associated with the endpoint. */
  tags?: string[];
  /** Parameters accepted by the endpoint. */
  parameters?: OpenAPIParameter[];
  /** Request body definition. */
  requestBody?: {
    /** Description of the request body. */
    description?: string;
  };
  /** Responses returned by the endpoint. */
  responses?: Record<string, {
    /** Description of the response. */
    description?: string;
  }>;
}

/**
 * Structure of a full OpenAPI Document.
 */
export interface OpenAPISpec {
  /** Info section containing metadata about the API. */
  info?: OpenAPIInfo;
  /** Paths section mapping URLs to endpoints. */
  paths?: Record<string, Record<string, OpenAPIEndpoint>>;
}

/**
 * Output structure expected from a CDD generation tool.
 */
export interface CDDOutput {
  /** Map of endpoints to methods and generated code strings. */
  endpoints: Record<string, Record<string, string>>;
}

/**
 * Supported variant combinations of code generation.
 */
export type VariantName = 'default' | 'noImports' | 'noWrapping' | 'noImportsNoWrapping';

/**
 * Record of CDDOutputs for a specific language, keyed by variant name.
 */
export type LanguageExamples = Record<VariantName, CDDOutput>;

/**
 * Record of LanguageExamples mapped by language.
 */
export type AllExamples = Record<string, LanguageExamples>;