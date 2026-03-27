
export interface Param {
  name: string;
  in: string;
  required: boolean;
  description?: string;
  type: string;
}

export interface Operation {
  id: string;
  path: string;
  method: string;
  summary: string;
  description: string;
  parameters: Param[];
  responses: Record<string, string>;
  tag: string;
}

export interface CodeExample {
  language: string;
  filepath: string;
  content: string;
}

export interface DocData {
  title: string;
  version: string;
  description: string;
  groups: Record<string, Operation[]>;
  codeExamples: Record<string, CodeExample[]>;
}
