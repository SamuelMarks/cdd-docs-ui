import fs from 'fs';
const code = fs.readFileSync('dist/bundle.js', 'utf-8');

// just to execute it and get CDDApiDocs
// It's ESM format. We can just import it.
