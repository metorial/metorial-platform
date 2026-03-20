/**
 * Shared Go utilities for code generation.
 *
 * Provides helpers for converting names to valid Go identifiers,
 * file names, and package names, along with a set of Go reserved keywords.
 */

import { Cases } from '../../case';

// Go reserved keywords (all lowercase in Go)
export let GO_RESERVED_KEYWORDS = new Set([
  'break',
  'case',
  'chan',
  'const',
  'continue',
  'default',
  'defer',
  'else',
  'fallthrough',
  'for',
  'func',
  'go',
  'goto',
  'if',
  'import',
  'interface',
  'map',
  'package',
  'range',
  'return',
  'select',
  'struct',
  'switch',
  'type',
  'var',
]);

/**
 * Converts a string to a valid exported Go identifier (PascalCase).
 * Go exported identifiers must start with an uppercase letter.
 */
export let toGoIdentifier = (name: string): string => {
  return Cases.toPascalCase(name);
};

/**
 * Makes a Go name safe by appending an underscore if it collides with
 * a reserved keyword. In practice, PascalCase identifiers rarely collide
 * since Go keywords are all lowercase, but this handles edge cases
 * (e.g., when generating unexported names).
 */
export let safeGoName = (name: string): string => {
  return GO_RESERVED_KEYWORDS.has(name) ? `${name}_` : name;
};

/**
 * Converts a name to a Go package name.
 * Go package names should be lowercase single words without underscores
 * or dashes. We strip dashes and underscores and lowercase everything.
 */
export let toGoFolderName = (name: string): string => {
  return name.replace(/[-_]+/g, '').toLowerCase();
};

/**
 * Converts a name to a valid Go file name (snake_case with .go extension).
 */
export let toGoFileName = (name: string): string => {
  return Cases.toSnakeCase(name) + '.go';
};
