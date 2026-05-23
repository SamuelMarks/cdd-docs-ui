import yaml from 'js-yaml';
import fs from 'fs';
const doc = yaml.load(fs.readFileSync('tests/test-yaml2.yml', 'utf8'));
console.log(JSON.stringify(doc.info.description));
