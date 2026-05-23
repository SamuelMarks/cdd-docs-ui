import { generateAOTHtml } from './src/aot-generator.ts';
import fs from 'fs';

const spec = fs.readFileSync('tests/test-yaml2.yml', 'utf-8');
const html = generateAOTHtml(spec);

console.log(html);
