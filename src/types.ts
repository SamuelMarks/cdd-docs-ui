import { OpenAPI320 } from './openapi-types';

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
    /** 
     * Map of endpoints where the key is the route path.
     * The value is a map of HTTP methods to generated code string snippets.
     */
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

export * from './openapi-types';

/**
 * Interface defining all localizable strings for the CDD API Documentation UI.
 */
export interface DocTranslations {
    /** The HTML lang attribute value (e.g. 'en', 'fr') */
    locale: string;
    /** Placeholder text for the endpoint search input */
    searchPlaceholder: string;
    /** Text for the copy code button */
    copy: string;
    /** Text displayed briefly after copying code */
    copied: string;
    /** Label for the interactive API testing section */
    tryItOut: string;
    /** Button text to submit the API request */
    execute: string;
    /** Heading for the API response section */
    response: string;
    /** Prefix for the HTTP response status */
    status: string;
    /** Text shown while waiting for the API response */
    loading: string;
    /** Text shown when an API request fails completely */
    error: string;
    /** Title for the settings sidebar */
    settings: string;
    /** Label for the dark mode toggle */
    darkMode: string;
    /** Label for the language selection section */
    language: string;
    /** Label for the 'Include Imports' toggle */
    includeImports: string;
    /** Label for the 'Include Wrapping' toggle */
    includeWrapping: string;
    /** Title for the endpoints/paths navigation section */
    paths: string;
    /** Title for the schemas/models navigation section */
    schemas: string;
    /** Title for the operation parameters section */
    parameters: string;
    /** Label for the request body input field */
    requestBody: string;
    /** Message shown when no code example exists for the selected language */
    noExampleFor: string;
    /** Prefix shown for array types in schema definitions */
    arrayOf: string;
    /** Header for the property column in schema tables */
    tableHeaderProperty: string;
    /** Header for the type column in schema tables */
    tableHeaderType: string;
    /** Header for the description column in schema tables */
    tableHeaderDescription: string;
    /** Header for the name column in parameter tables */
    tableHeaderName: string;
    /** Header for the "in" (location) column in parameter tables */
    tableHeaderIn: string;
    /** Label for the terms of service link */
    termsOfService: string;
    /** Prefix for the contact information section */
    contactPrefix: string;
    /** Fallback label for the contact link if no name is provided */
    apiSupport: string;
    /** Heading for the appearance settings section */
    appearanceHeading: string;
    /** Accessible label for the main table of contents navigation */
    tocNavLabel: string;
    /** Label for the cURL code tab */
    tabCurl: string;
    /** Label for the SDK code tab */
    tabSdk: string;
}

/** Default English translations for the UI */
export const defaultTranslations: DocTranslations = {
    locale: 'en',
    searchPlaceholder: 'Search endpoints...',
    copy: 'Copy',
    copied: 'Copied!',
    tryItOut: 'Try It Out',
    execute: 'Execute',
    response: 'Response',
    status: 'Status',
    loading: 'Loading...',
    error: 'Error',
    settings: 'Settings',
    darkMode: 'Dark Mode',
    language: 'Language',
    includeImports: 'Include Imports',
    includeWrapping: 'Include Wrapping',
    paths: 'Paths',
    schemas: 'Schemas',
    parameters: 'Parameters',
    requestBody: 'Request Body (JSON)',
    noExampleFor: 'No example for',
    arrayOf: 'Array of:',
    tableHeaderProperty: 'Property',
    tableHeaderType: 'Type',
    tableHeaderDescription: 'Description',
    tableHeaderName: 'Name',
    tableHeaderIn: 'In',
    termsOfService: 'Terms of Service',
    contactPrefix: 'Contact: ',
    apiSupport: 'API Support',
    appearanceHeading: 'Appearance',
    tocNavLabel: 'Table of Contents',
    tabCurl: 'cURL',
    tabSdk: 'SDK',
};
