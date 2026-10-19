/**
 * @module eslint.config
 * ESLint v10 Flat Configuration using the TypeScript Compiler API to parse `.ts` files
 * and enforce zero `any`, zero type assertions (`as`), zero coverage ignore comments,
 * and 100% JSDoc coverage across files, modules, classes, interfaces, types, functions, and arguments.
 */
import ts from 'typescript';

/**
 * Custom ESLint parser backed by the TypeScript Compiler API (`typescript`) so ESLint can parse
 * TypeScript syntax without external parser packages and expose the TS AST on `sourceCode.ast.tsSourceFile`.
 */
const tsParser = {
    meta: {
        name: 'typescript-compiler-parser',
        version: '1.0.0',
    },
    parseForESLint(code, options) {
        const filePath = options?.filePath || 'file.ts';
        const tsSourceFile = ts.createSourceFile(
            filePath,
            code,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS,
        );

        const lines = code.split(String.fromCharCode(10));
        const lineStarts = [0];
        for (let i = 0; i < lines.length; i++) {
            lineStarts.push(lineStarts[i] + lines[i].length + 1);
        }

        const getLoc = pos => {
            const lc = tsSourceFile.getLineAndCharacterOfPosition(pos);
            return { line: lc.line + 1, column: lc.character };
        };

        const comments = [];
        const tokens = [];
        const scanner = ts.createScanner(
            ts.ScriptTarget.Latest,
            false,
            ts.LanguageVariant.Standard,
            code,
        );

        let token = scanner.scan();
        while (token !== ts.SyntaxKind.EndOfFileToken) {
            const start = scanner.getTokenStart();
            const end = scanner.getTokenEnd();
            const value = scanner.getTokenText();
            const loc = { start: getLoc(start), end: getLoc(end) };
            if (
                token === ts.SyntaxKind.SingleLineCommentTrivia ||
                token === ts.SyntaxKind.MultiLineCommentTrivia
            ) {
                comments.push({
                    type: token === ts.SyntaxKind.SingleLineCommentTrivia ? 'Line' : 'Block',
                    value:
                        token === ts.SyntaxKind.SingleLineCommentTrivia
                            ? value.slice(2)
                            : value.slice(2, -2),
                    range: [start, end],
                    loc,
                });
            } else if (
                token !== ts.SyntaxKind.WhitespaceTrivia &&
                token !== ts.SyntaxKind.NewLineTrivia
            ) {
                tokens.push({
                    type: ts.SyntaxKind[token] || 'Identifier',
                    value,
                    range: [start, end],
                    loc,
                });
            }
            token = scanner.scan();
        }

        return {
            ast: {
                type: 'Program',
                body: [],
                sourceType: 'module',
                range: [0, code.length],
                loc: {
                    start: { line: 1, column: 0 },
                    end: { line: lines.length, column: (lines[lines.length - 1] || '').length },
                },
                tokens,
                comments,
                tsSourceFile,
            },
            visitorKeys: {
                Program: [],
            },
            scopeManager: null,
        };
    },
};

/**
 * Custom ESLint plugin enforcing TypeScript strictness, zero type casts, and 100% JSDoc coverage.
 */
const strictTsPlugin = {
    rules: {
        'no-explicit-any': {
            meta: {
                type: 'problem',
                docs: { description: 'Disallow explicit any types and as any casts' },
                messages: {
                    noAny: 'Unexpected `any` type. Use strong types or `unknown` with type guards.',
                },
            },
            create(context) {
                return {
                    Program(node) {
                        const sf = node.tsSourceFile;
                        if (!sf) return;
                        const visit = tsNode => {
                            if (tsNode.kind === ts.SyntaxKind.AnyKeyword) {
                                const start = sf.getLineAndCharacterOfPosition(tsNode.getStart(sf));
                                const end = sf.getLineAndCharacterOfPosition(tsNode.getEnd());
                                context.report({
                                    loc: {
                                        start: { line: start.line + 1, column: start.character },
                                        end: { line: end.line + 1, column: end.character },
                                    },
                                    messageId: 'noAny',
                                });
                            }
                            ts.forEachChild(tsNode, visit);
                        };
                        visit(sf);
                    },
                };
            },
        },
        'no-type-assertions': {
            meta: {
                type: 'problem',
                docs: { description: 'Disallow TypeScript `as` type assertions and angle-bracket casts' },
                messages: {
                    noAs: 'Unexpected type assertion (`as`). Use explicit type annotations or type guards instead.',
                },
            },
            create(context) {
                return {
                    Program(node) {
                        const sf = node.tsSourceFile;
                        if (!sf) return;
                        const visit = tsNode => {
                            if (ts.isAsExpression(tsNode) || ts.isTypeAssertionExpression(tsNode)) {
                                const start = sf.getLineAndCharacterOfPosition(tsNode.getStart(sf));
                                const end = sf.getLineAndCharacterOfPosition(tsNode.getEnd());
                                context.report({
                                    loc: {
                                        start: { line: start.line + 1, column: start.character },
                                        end: { line: end.line + 1, column: end.character },
                                    },
                                    messageId: 'noAs',
                                });
                            }
                            ts.forEachChild(tsNode, visit);
                        };
                        visit(sf);
                    },
                };
            },
        },
        'no-coverage-ignore': {
            meta: {
                type: 'problem',
                docs: { description: 'Disallow v8 ignore and istanbul ignore comments' },
                messages: {
                    noIgnore: 'Coverage ignore comments (`v8 ignore` / `istanbul ignore`) are forbidden.',
                },
            },
            create(context) {
                return {
                    Program(node) {
                        for (const comment of node.comments || []) {
                            if (/v8 ignore|istanbul ignore/i.test(comment.value)) {
                                context.report({
                                    loc: comment.loc,
                                    messageId: 'noIgnore',
                                });
                            }
                        }
                    },
                };
            },
        },
        'require-complete-jsdoc': {
            meta: {
                type: 'problem',
                docs: {
                    description:
                        'Require 100% JSDoc coverage on modules, classes, interfaces, types, properties, functions, methods, and parameters',
                },
                messages: {
                    missingModuleDoc: 'File is missing a module-level `@module` or `@packageDocumentation` JSDoc block.',
                    missingJsDoc: 'Declaration `{{name}}` is missing a JSDoc comment.',
                    missingParamDoc: 'Parameter `{{param}}` on `{{name}}` is missing a `@param` JSDoc tag.',
                },
            },
            create(context) {
                return {
                    Program(node) {
                        const sf = node.tsSourceFile;
                        if (!sf) return;
                        const fullText = sf.getFullText();

                        if (!/@module\b|@packageDocumentation\b/.test(fullText)) {
                            context.report({
                                loc: {
                                    start: { line: 1, column: 0 },
                                    end: { line: 1, column: 1 },
                                },
                                messageId: 'missingModuleDoc',
                            });
                        }

                        const reportNode = (tsNode, messageId, data) => {
                            const start = sf.getLineAndCharacterOfPosition(tsNode.getStart(sf));
                            const end = sf.getLineAndCharacterOfPosition(tsNode.getEnd());
                            context.report({
                                loc: {
                                    start: { line: start.line + 1, column: start.character },
                                    end: { line: start.line + 1, column: Math.max(start.character + 1, end.character) },
                                },
                                messageId,
                                data,
                            });
                        };

                        for (const stmt of sf.statements) {
                            if (ts.isVariableStatement(stmt)) {
                                const jsDoc = ts.getJSDocCommentsAndTags(stmt);
                                if (!jsDoc || jsDoc.length === 0) {
                                    for (const decl of stmt.declarationList.declarations) {
                                        reportNode(decl, 'missingJsDoc', {
                                            name: decl.name.getText(sf),
                                        });
                                    }
                                }
                            }
                        }

                        const visit = tsNode => {
                            if (
                                ts.isFunctionDeclaration(tsNode) ||
                                ts.isClassDeclaration(tsNode) ||
                                ts.isMethodDeclaration(tsNode) ||
                                ts.isGetAccessorDeclaration(tsNode) ||
                                ts.isSetAccessorDeclaration(tsNode) ||
                                ts.isConstructorDeclaration(tsNode) ||
                                ts.isInterfaceDeclaration(tsNode) ||
                                ts.isTypeAliasDeclaration(tsNode) ||
                                ts.isPropertySignature(tsNode) ||
                                ts.isPropertyDeclaration(tsNode)
                            ) {
                                const jsDoc = ts.getJSDocCommentsAndTags(tsNode);
                                const name = tsNode.name
                                    ? tsNode.name.getText(sf)
                                    : ts.SyntaxKind[tsNode.kind];
                                if (!jsDoc || jsDoc.length === 0) {
                                    reportNode(tsNode, 'missingJsDoc', { name });
                                } else if (
                                    ts.isFunctionDeclaration(tsNode) ||
                                    ts.isMethodDeclaration(tsNode) ||
                                    ts.isSetAccessorDeclaration(tsNode) ||
                                    ts.isConstructorDeclaration(tsNode)
                                ) {
                                    for (const param of tsNode.parameters) {
                                        const pName = param.name.getText(sf);
                                        const hasParamTag =
                                            ts.getJSDocParameterTags(param).length > 0;
                                        if (!hasParamTag) {
                                            reportNode(param, 'missingParamDoc', {
                                                param: pName,
                                                name,
                                            });
                                        }
                                    }
                                }
                            }
                            ts.forEachChild(tsNode, visit);
                        };
                        visit(sf);
                    },
                };
            },
        },
    },
};

export default [
    {
        files: ['src/**/*.ts', 'tests/**/*.ts'],
        languageOptions: {
            parser: tsParser,
        },
        plugins: {
            'strict-ts': strictTsPlugin,
        },
        rules: {
            'strict-ts/no-explicit-any': 'error',
            'strict-ts/no-type-assertions': 'error',
            'strict-ts/no-coverage-ignore': 'error',
            'strict-ts/require-complete-jsdoc': 'error',
        },
    },
];
