/**
 * @module update-badges
 * Script to compute and synchronize 100% Test Coverage and Doc Coverage badges across root Markdown files.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Get Test Coverage (minimum across statements, branches, functions, and lines)
const summaryPath = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');
let testCov = 0;
try {
    if (fs.existsSync(summaryPath)) {
        const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
        const total = summary.total;
        testCov = Math.min(
            total.statements.pct,
            total.branches.pct,
            total.functions.pct,
            total.lines.pct,
        );
    } else {
        console.warn('coverage-summary.json not found!');
    }
} catch (e) {
    console.warn('Error reading coverage summary', e);
}

/**
 * Recursively collects all TypeScript `.ts` files in a given directory.
 * @param dir The directory path to scan.
 * @param fileList Accumulator array of file paths.
 * @returns Array of discovered `.ts` file paths.
 */
function getFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            getFiles(fullPath, fileList);
        } else if (file.endsWith('.ts')) {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

// 2. Get Doc Coverage across files, exports, class methods, and interface properties
const srcFiles = getFiles(path.join(__dirname, '..', 'src'));
let totalItems = 0;
let documentedItems = 0;

srcFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    // Check module-level documentation
    totalItems++;
    if (content.includes('@module') || content.includes('@packageDocumentation')) {
        documentedItems++;
    } else {
        console.warn(`Missing @module JSDoc in ${path.basename(file)}`);
    }

    const nl = String.fromCharCode(10);
    const lines = content.split(nl);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Find exported functions, constants, types, classes, interfaces
        if (line.match(/^export\s+(async\s+)?(function|interface|type|class|const|let|var)\s+/)) {
            totalItems++;
            let hasDoc = false;
            let j = i - 1;
            while (j >= 0 && (lines[j].trim() === '' || lines[j].trim().startsWith('@'))) {
                j--;
            }
            if (j >= 0 && lines[j].trim().endsWith('*/')) {
                hasDoc = true;
            }
            if (hasDoc) {
                documentedItems++;
            } else {
                console.warn(`Missing JSDoc on export in ${path.basename(file)} at line ${i + 1}: ${line}`);
            }
        }
    }
});

const docCov = totalItems === 0 ? 100 : Math.round((documentedItems / totalItems) * 100);

// 3. Update all root markdown files
const rootDir = path.join(__dirname, '..');
const mdFiles = fs
    .readdirSync(rootDir)
    .filter(f => f.endsWith('.md') && f !== 'TODO_PLAN.md' && fs.statSync(path.join(rootDir, f)).isFile());

const testColor = testCov >= 90 ? 'brightgreen' : testCov >= 80 ? 'yellow' : 'red';
const docColor = docCov >= 90 ? 'brightgreen' : docCov >= 80 ? 'yellow' : 'red';

const testBadge = `![Test Coverage](https://img.shields.io/badge/Test_Coverage-${testCov}%25-${testColor}.svg)`;
const docBadge = `![Doc Coverage](https://img.shields.io/badge/Doc_Coverage-${docCov}%25-${docColor}.svg)`;

const testRegex = /!\[Test Coverage\]\(.+?\)/;
const docRegex = /!\[Doc Coverage\]\(.+?\)/;
const titleRegex = new RegExp('^(# .+?(?:' + String.fromCharCode(13) + '?' + String.fromCharCode(10) + '|$))');

mdFiles.forEach(mdFile => {
    const mdPath = path.join(rootDir, mdFile);
    let md = fs.readFileSync(mdPath, 'utf-8');
    const nl = String.fromCharCode(10);

    // Inject Test Coverage Badge
    if (testRegex.test(md)) {
        md = md.replace(testRegex, testBadge);
    } else {
        md = md.replace(titleRegex, `$1${nl}${testBadge}${nl}`);
    }

    // Inject Doc Coverage Badge
    if (docRegex.test(md)) {
        md = md.replace(docRegex, docBadge);
    } else {
        md = md.replace(testBadge, `${testBadge} ${docBadge}`);
    }

    fs.writeFileSync(mdPath, md);
});

console.log(`Badges updated across all root markdown files: Test Coverage = ${testCov}%, Doc Coverage = ${docCov}%`);
