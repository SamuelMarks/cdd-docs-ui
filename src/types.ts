
import { OpenAPI320 } from "./openapi-types";

/**
 * Internal Data Model for API Documentation
 * @module types
 */

/** 
 * Represents an SDK code example.
 */
export interface CodeExample {
  /** The programming language of the example (e.g., 'typescript', 'python'). */
  language: string;
  /** The path to the file containing the example. */
  filepath: string;
  /** The actual code content. */
  content: string;
  /** Whether to include import statements in the displayed example. */
  includeImports?: boolean;
  /** Whether to include wrapping code (like function definitions) in the displayed example. */
  includeWrapping?: boolean;
}

/**
 * Expected JSON output structure from cdd-ctl
 */
export interface CDDOutput {
  endpoints: {
    [path: string]: {
      [method: string]: string;
    };
  };
}


/** 
 * The Final Normalized Documentation Data structure used by the UI.
 */
export interface DocData {
  /** The parsed and normalized OpenAPI specification. */
  spec: OpenAPI320;
  /** 
   * A map of operation IDs to their corresponding code examples.
   * Key: Operation ID (or generated ID).
   * Value: Array of CodeExample objects.
   */
  codeExamples: Record<string, CodeExample[]>;
}

export * from "./openapi-types";
