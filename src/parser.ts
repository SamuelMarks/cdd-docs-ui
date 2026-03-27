
import { DocData, Operation, Param, CodeExample } from "./types";
import yaml from "js-yaml";

/**
 * Normalizes an OpenAPI specification string (JSON or YAML) into the internal `DocData` representation.
 * @param specContent Raw string of the OpenAPI specification.
 * @returns Normalized API Data ready for rendering.
 */
export function normalizeSpec(specContent: string): DocData {
  let parsed: any;
  try {
    parsed = yaml.load(specContent);
  } catch (e) {
    throw new Error("Invalid OpenAPI specification format.");
  }
  
  if (!parsed || typeof parsed !== "object") {
     throw new Error("Invalid OpenAPI specification format.");
  }

  const data: DocData = {
    title: parsed.info?.title || "API Reference",
    version: parsed.info?.version || "1.0.0",
    description: parsed.info?.description || "",
    groups: {},
    codeExamples: {},
  };

  if (!parsed.paths) {
    return data;
  }

  for (const [routePath, methods] of Object.entries(parsed.paths)) {
    if (!methods || typeof methods !== "object") continue;
    
    for (const [method, details] of Object.entries(methods as Record<string, any>)) {
      if (!["get", "post", "put", "delete", "patch"].includes(method.toLowerCase())) {
        continue;
      }
      
      const methodLower = method.toLowerCase();
      const id = details.operationId || `${methodLower}-${routePath.replace(/[^a-zA-Z0-9]/g, "")}`;
      const tag = (details.tags && details.tags.length > 0) ? details.tags[0] : "Default";
      
      const parameters: Param[] = (details.parameters || []).map((p: any) => ({
        name: p.name || "Unknown",
        in: p.in || "query",
        required: !!p.required,
        description: p.description || "",
        type: p.schema?.type || p.type || "string"
      }));
      
      const responses: Record<string, string> = {};
      if (details.responses) {
        for (const [status, resp] of Object.entries(details.responses as Record<string, any>)) {
           responses[status] = resp.description || "No description";
        }
      }

      const operation: Operation = {
        id,
        path: routePath,
        method: methodLower,
        summary: details.summary || "No Summary",
        description: details.description || "",
        parameters,
        responses,
        tag
      };

      if (!data.groups[tag]) {
        data.groups[tag] = [];
      }
      data.groups[tag].push(operation);
    }
  }

  return data;
}

/**
 * Maps an array of generated SDK code files to the corresponding operations within the DocData.
 * @param docData The normalized documentation data.
 * @param generatedFiles The raw files generated from WASM (usually flattened).
 */
export function mapSdkExamples(docData: DocData, generatedFiles: CodeExample[]): void {
  // A naive implementation: usually SDK generators structure files based on operation IDs or Tags.
  // For the sake of the docs UI expansion, we will map files that match `${operationId}.[ext]` 
  // or default to attaching all examples to the first operation if mapping fails, 
  // to ensure they are at least displayed.
  
  // Real implementation would look at file contents or strictly adhere to CDD CTL conventions.
  const operations = Object.values(docData.groups).flat();
  
  if (operations.length === 0) return;

  for (const file of generatedFiles) {
    let matched = false;
    for (const op of operations) {
      if (file.filepath.includes(op.id)) {
         if (!docData.codeExamples[op.id]) docData.codeExamples[op.id] = [];
         docData.codeExamples[op.id]!.push(file);
         matched = true;
      }
    }
    
    if (!matched) {
       // Attach as a global example to the first operation if it cannot be mapped
       const firstOpId = operations[0].id;
       if (!docData.codeExamples[firstOpId]) docData.codeExamples[firstOpId] = [];
       docData.codeExamples[firstOpId]!.push(file);
    }
  }
}
