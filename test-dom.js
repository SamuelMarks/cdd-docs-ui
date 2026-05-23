import { JSDOM } from 'jsdom';
import fs from 'fs';

const html = fs.readFileSync('test.html', 'utf-8');

const dom = new JSDOM(html, { 
    runScripts: "dangerously",
    resources: "usable" 
});

setTimeout(() => {
  const component = dom.window.document.querySelector('cdd-api-docs');
  component.renderSpec(fs.readFileSync('example/spec.json', 'utf-8')).then(() => {
    const desc = component.querySelector('header');
    console.log("DESCRIPTION:", desc ? desc.innerHTML : 'not found');
  });
}, 1000);
