import { JSDOM } from 'jsdom';
const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.customElements = dom.window.customElements;

import { CDDApiDocs } from './dist/bundle.js';

const doc = new CDDApiDocs();
doc.renderSpec(`
openapi: 3.0.0
info:
  title: Test
  version: 1.0.0
  description: "Test [link](https://example.com)"
paths: {}
`).then(() => {
  console.log(doc.innerHTML.substring(0, 500));
});
