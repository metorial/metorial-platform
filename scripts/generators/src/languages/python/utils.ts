/**
 * Shared Python utilities for code generation
 */

// Python reserved keywords and built-ins
export const PYTHON_RESERVED_KEYWORDS = new Set([
  'False',
  'None',
  'True',
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'try',
  'while',
  'with',
  'yield',
  'exec',
  'print',
  'self'
]);

/**
 * Converts a string to a valid Python identifier/module name:
 * - replaces dashes with underscores
 * - converts to lowercase
 */
export let toPyIdentifier = (name: string): string => {
  return name.replace(/-/g, '_').toLowerCase();
};

/**
 * Makes a Python name safe by appending underscore if it's a reserved keyword
 */
export let safePyName = (name: string): string => {
  return PYTHON_RESERVED_KEYWORDS.has(name) ? `${name}_` : name;
};

/**
 * Converts a name to PascalCase for Python class names
 */
export let toPyClassName = (name: string): string => {
  // convert snake_case or kebab-case to PascalCase
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/(?:^|\s)(\w)/g, (_, c) => c.toUpperCase())
    .replace(/\s+/g, '');
};

/**
 * Converts a name to a Python folder/module name (dashes to underscores)
 */
export let toPyFolderName = (name: string): string => {
  return name.replace(/-/g, '_');
};
