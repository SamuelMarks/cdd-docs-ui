import { generateAOTHtml } from './src/aot-generator.ts';
import fs from 'fs';

const spec = fs.readFileSync('example/spec.json', 'utf-8');
const html = generateAOTHtml(spec);

const snippet = html.substring(html.indexOf('<header>'), html.indexOf('</header>') + 9);
console.log(snippet);
