
import { OpenAPI320 } from "./openapi-types";

/**
 * Internal Data Model for API Documentation
 * @module types
 */

/** SDK Code Example Payload */
export interface CodeExample {
  language: string;
  filepath: string;
  content: string;
}

/** The Final Normalized Documentation Data */
export interface DocData {
  spec: OpenAPI320;
  codeExamples: Record<string, CodeExample[]>;
}

export * from "./openapi-types";
