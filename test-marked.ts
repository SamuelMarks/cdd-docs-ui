import { generateAOTHtml } from './src/aot-generator';
const spec = `
openapi: 3.0.0
info:
  title: Test
  version: 1.0.0
  description: "This is a test [link](https://example.com)"
paths: {}
`;
console.log(generateAOTHtml(spec));