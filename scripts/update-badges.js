const fs = require('fs');
const path = require('path');

// 1. Get Test Coverage
const summaryPath = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');
let testCov = 0;
try {
    if (fs.existsSync(summaryPath)) {
        const summary = require(summaryPath);
        testCov = summary.total.statements.pct;
    } else {
        console.warn('coverage-summary.json not found!');
    }
} catch (e) {
    console.warn('Error reading coverage summary', e);
}

// 2. Get Doc Coverage
function getFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const stat = fs.statSync(path.join(dir, file));
        if (stat.isDirectory()) {
            getFiles(path.join(dir, file), fileList);
        } else if (file.endsWith('.ts')) {
            fileList.push(path.join(dir, file));
        }
    }
    return fileList;
}

const srcFiles = getFiles(path.join(__dirname, '..', 'src'));
let totalExports = 0;
let documentedExports = 0;

srcFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Find exported functions, constants, types, classes, interfaces
        if (line.match(/^export\s+(async\s+)?(function|interface|type|class|const|let|var)\s+/)) {
            totalExports++;
            let hasDoc = false;
            let j = i - 1;
            // Skip empty lines or decorators above the export
            while (j >= 0 && (lines[j].trim() === '' || lines[j].trim().startsWith('@'))) {
                j--;
            }
            if (j >= 0 && lines[j].trim() === '*/') {
                hasDoc = true;
            }
            if (hasDoc) {
                documentedExports++;
            } else {
                console.warn(`Missing JSDoc on export in ${path.basename(file)} at line ${i + 1}: ${line}`);
            }
        }
    }
});

const docCov = totalExports === 0 ? 100 : Math.round((documentedExports / totalExports) * 100);

// 3. Update README.md
const readmePath = path.join(__dirname, '..', 'README.md');
if (!fs.existsSync(readmePath)) {
    console.error('README.md not found!');
    process.exit(1);
}

let readme = fs.readFileSync(readmePath, 'utf-8');

const testColor = testCov >= 90 ? 'brightgreen' : testCov >= 80 ? 'yellow' : 'red';
const docColor = docCov >= 90 ? 'brightgreen' : docCov >= 80 ? 'yellow' : 'red';

const testBadge = `![Test Coverage](https://img.shields.io/badge/Test_Coverage-${testCov}%25-${testColor}.svg)`;
const docBadge = `![Doc Coverage](https://img.shields.io/badge/Doc_Coverage-${docCov}%25-${docColor}.svg)`;

const testRegex = /!\[Test Coverage\]\(.+?\)/;
const docRegex = /!\[Doc Coverage\]\(.+?\)/;

// Inject Test Coverage Badge
if (testRegex.test(readme)) {
    readme = readme.replace(testRegex, testBadge);
} else {
    readme = readme.replace('# CDD Docs UI\\n', '# CDD Docs UI\\n\\n' + testBadge + '\\n');
}

// Inject Doc Coverage Badge
if (docRegex.test(readme)) {
    readme = readme.replace(docRegex, docBadge);
} else {
    readme = readme.replace(testBadge, `${testBadge} ${docBadge}`);
}

fs.writeFileSync(readmePath, readme);
console.log(`Badges updated: Test Coverage = ${testCov}%, Doc Coverage = ${docCov}%`);
