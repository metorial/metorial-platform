import { Cases } from '../../case';
import type { IntrospectedType } from '../../fetch';

export let generateMapper = async (
  name: string,
  typename: string,
  type: IntrospectedType
): Promise<string> => {
  let funcName = `map${typename}`;
  let code = `
from typing import Any, Dict
from datetime import datetime

def ${funcName}(data: Dict[str, Any]) -> ${typename}:
${_generateMapper(type, typename, 'data', 1)}
`;

  return code + '\n';
};

let pythonKeywords = new Set([
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
  'yield'
]);

/**
 * Converts a string to a valid Python identifier/module name:
 * - replaces dashes with underscores
 * - lowercases
 */
let toPyIdentifier = (name: string) => {
  return name.replace(/-/g, '_').toLowerCase();
};

let safePyName = (name: string) => {
  return pythonKeywords.has(name) ? `${name}_` : name;
};

let _generateMapper = (
  type: IntrospectedType,
  typename: string | undefined,
  source: string,
  indentLevel: number
): string => {
  let indent = '    '.repeat(indentLevel);

  if (type.type === 'object') {
    let props = Object.entries(type.properties || {})
      .map(([key, value]) => {
        let pyName = safePyName(toPyIdentifier(Cases.toSnakeCase(key)));
        let jsonKey =
          key === 'createdAt' ? 'created_at' : key === 'updatedAt' ? 'updated_at' : key;

        if (value.type === 'object') {
          return `${indent}"${pyName}": ${_generateMapper(value, undefined, `${source}.get('${jsonKey}', {})`, indentLevel + 1)}`;
        }
        if (value.type === 'array') {
          return `${indent}"${pyName}": [${_generateMapper(value.items![0], undefined, 'item', indentLevel + 2)} for item in ${source}.get('${jsonKey}', [])]`;
        }
        if (value.type === 'date') {
          return `${indent}"${pyName}": ${source}.get('${jsonKey}') and datetime.fromisoformat(${source}.get('${jsonKey}'))`;
        }
        return `${indent}"${pyName}": ${source}.get('${jsonKey}')`;
      })
      .join(',\n');

    if (typename) {
      let classProps = Object.entries(type.properties || {})
        .map(([key, value]) => {
          let pyName = safePyName(toPyIdentifier(Cases.toSnakeCase(key)));
          let jsonKey =
            key === 'createdAt' ? 'created_at' : key === 'updatedAt' ? 'updated_at' : key;
          if (value.type === 'object') {
            return `${indent}${pyName}=${_generateMapper(value, undefined, `${source}.get('${jsonKey}', {})`, indentLevel + 1)}`;
          }
          if (value.type === 'array') {
            return `${indent}${pyName}=[${_generateMapper(value.items![0], undefined, 'item', indentLevel + 2)} for item in ${source}.get('${jsonKey}', [])]`;
          }
          if (value.type === 'date') {
            return `${indent}${pyName}=${source}.get('${jsonKey}') and datetime.fromisoformat(${source}.get('${jsonKey}'))`;
          }
          return `${indent}${pyName}=${source}.get('${jsonKey}')`;
        })
        .join(',\n');
      return `${indent}return ${typename}(\n${classProps}\n${indent})`;
    } else {
      return `{\n${props}\n${'    '.repeat(indentLevel - 1)}}`;
    }
  }

  if (type.type === 'array') {
    let itemMap = _generateMapper(type.items![0], undefined, 'item', indentLevel + 1);
    return `${indent}[${itemMap} for item in ${source} or []]`;
  }

  if (type.type === 'date') {
    return `${indent}${source} and datetime.fromisoformat(${source})`;
  }

  return `${indent}${source}`;
};
