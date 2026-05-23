import { JSDOM } from 'jsdom';
import fs from 'fs';
import vm from 'vm';

const dom = new JSDOM('<!DOCTYPE html><html><body><cdd-api-docs></cdd-api-docs></body></html>', {
  runScripts: "outside-only",
  url: "http://localhost/"
});

const js = fs.readFileSync('bundle-cleaned.js', 'utf-8');
const script = new vm.Script(js);
const domContext = dom.getInternalVMContext();
script.runInContext(domContext);

const component = dom.window.document.querySelector('cdd-api-docs');
component.renderSpec(fs.readFileSync('petstore.json', 'utf-8')).then(() => {
  const p = component.querySelector('header');
  console.log("DESCRIPTION:", p ? p.innerHTML : 'not found');
});
