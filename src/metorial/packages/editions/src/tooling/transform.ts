import ts from 'typescript';
import { editions, isEdition, type Edition } from '../edition.ts';

let packageName = '@metorial/editions';
let maxPasses = 25;

let transformableCalls = [
  'checkEdition',
  'assertEdition',
  'perEdition',
  'getEdition'
] as const;

type TransformableCall = (typeof transformableCalls)[number];

type Replacement = { start: number; end: number; text: string };

export type TransformOptions = {
  edition: Edition;
  fileName: string;
};

let scriptKindFor = (fileName: string) => {
  if (/\.tsx$/.test(fileName)) return ts.ScriptKind.TSX;
  if (/\.jsx$/.test(fileName)) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/.test(fileName)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
};

let collectLocalNames = (source: ts.SourceFile) => {
  let names = new Map<string, TransformableCall>();

  for (let statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.moduleSpecifier.text != packageName) continue;

    let bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;

    for (let element of bindings.elements) {
      let imported = (element.propertyName ?? element.name).text;
      if (!(transformableCalls as readonly string[]).includes(imported)) continue;

      names.set(element.name.text, imported as TransformableCall);
    }
  }

  return names;
};

let describeLocation = (source: ts.SourceFile, node: ts.Node) => {
  let { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
  return `${source.fileName}:${line + 1}:${character + 1}`;
};

let readEditionArguments = (source: ts.SourceFile, call: ts.CallExpression, name: string) => {
  if (!call.arguments.length) {
    throw new Error(`${describeLocation(source, call)} ${name}() needs at least one edition`);
  }

  return call.arguments.map(argument => {
    if (!ts.isStringLiteral(argument) && !ts.isNoSubstitutionTemplateLiteral(argument)) {
      throw new Error(
        `${describeLocation(source, argument)} ${name}() only accepts string literal editions so it can be removed at build time`
      );
    }

    if (!isEdition(argument.text)) {
      throw new Error(
        `${describeLocation(source, argument)} Unknown edition "${argument.text}", expected one of: ${editions.join(', ')}`
      );
    }

    return argument.text;
  });
};

let propertyKeyText = (name: ts.PropertyName) => {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return null;
};

let selectEditionValue = (
  source: ts.SourceFile,
  code: string,
  call: ts.CallExpression,
  edition: Edition
) => {
  let [argument] = call.arguments;

  if (call.arguments.length != 1 || !argument || !ts.isObjectLiteralExpression(argument)) {
    throw new Error(
      `${describeLocation(source, call)} perEdition() needs a single object literal so unused editions can be removed at build time`
    );
  }

  for (let property of argument.properties) {
    if (ts.isSpreadAssignment(property) || ts.isMethodDeclaration(property)) {
      throw new Error(
        `${describeLocation(source, property)} perEdition() only supports plain properties`
      );
    }

    if (ts.isGetAccessor(property) || ts.isSetAccessor(property)) {
      throw new Error(
        `${describeLocation(source, property)} perEdition() only supports plain properties`
      );
    }

    if (propertyKeyText(property.name) != edition) continue;

    if (ts.isShorthandPropertyAssignment(property)) return property.name.text;

    return `(${code.slice(property.initializer.getStart(source), property.initializer.getEnd())})`;
  }

  throw new Error(
    `${describeLocation(source, call)} perEdition() has no value for "${edition}"`
  );
};

let collectReplacements = (code: string, options: TransformOptions) => {
  let source = ts.createSourceFile(
    options.fileName,
    code,
    ts.ScriptTarget.ESNext,
    true,
    scriptKindFor(options.fileName)
  );

  let localNames = collectLocalNames(source);
  let replacements: Replacement[] = [];

  if (!localNames.size) return replacements;

  let visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      let kind = localNames.get(node.expression.text);
      let replacement = kind ? replaceCall(source, code, node, kind, options.edition) : null;

      if (replacement) {
        replacements.push({
          start: node.getStart(source),
          end: node.getEnd(),
          text: replacement
        });
        return;
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);

  return replacements;
};

let replaceCall = (
  source: ts.SourceFile,
  code: string,
  call: ts.CallExpression,
  kind: TransformableCall,
  edition: Edition
) => {
  if (kind == 'getEdition') return JSON.stringify(edition);

  if (kind == 'perEdition') return selectEditionValue(source, code, call, edition);

  let allowed = readEditionArguments(source, call, kind);

  if (kind == 'checkEdition') return allowed.includes(edition) ? 'true' : 'false';

  return allowed.includes(edition) ? 'void 0' : null;
};

let applyReplacements = (code: string, replacements: Replacement[]) => {
  let result = code;

  for (let replacement of [...replacements].sort((a, b) => b.start - a.start)) {
    result =
      result.slice(0, replacement.start) + replacement.text + result.slice(replacement.end);
  }

  return result;
};

export let transformEditionSource = (code: string, options: TransformOptions) => {
  if (!code.includes(packageName)) return null;

  let current = code;
  let changed = false;

  for (let pass = 0; pass < maxPasses; pass++) {
    let replacements = collectReplacements(current, options);
    if (!replacements.length) break;

    current = applyReplacements(current, replacements);
    changed = true;
  }

  return changed ? current : null;
};
