import { Cases } from '../../case';
import type { IntrospectedType } from '../../fetch';

export let generateTypeFromIntrospectedType = async (name: string, type: IntrospectedType) => {
  let code = type.type === 'object' ? generateClass(name, type) : generateAlias(name, type);
  return code + '\n';
};

let wrapType = (t: IntrospectedType, hint: string): string => {
  if (t.optional && t.nullable) return `Optional[${hint}]`;
  if (t.optional || t.nullable) return `Optional[${hint}]`;
  return hint;
};

let processType = (type: IntrospectedType): string => {
  switch (type.type) {
    case 'object':
      return wrapType(type, 'Dict[str, Any]');
    case 'enum':
    case 'string':
      return wrapType(type, 'str');
    case 'number':
      return wrapType(type, 'float');
    case 'boolean':
      return wrapType(type, 'bool');
    case 'date':
      return wrapType(type, 'datetime');
    case 'array':
      let item = processType(type.items![0]);
      return wrapType(type, `List[${item}]`);
    case 'any':
      return wrapType(type, 'Any');
    case 'record':
      return wrapType(type, `Dict[str, ${processType(type.items![0])}]`);
    case 'union':
      let members = type.items!.map(processType).join(', ');
      return wrapType(type, `Union[${members}]`);
    case 'intersection':
      // Python doesn’t support intersection hints; fallback to Any
      return wrapType(type, 'Any');
    case 'literal':
      return wrapType(type, 'str');
    default:
      return 'Any';
  }
};

// add safePyName for reserved keyword handling
let reserved = new Set([
  'from',
  'class',
  'def',
  'return',
  'pass',
  'global',
  'lambda',
  'with',
  'as',
  'if',
  'else',
  'elif',
  'try',
  'except',
  'raise',
  'for',
  'while',
  'break',
  'continue',
  'import',
  'in',
  'is',
  'not',
  'or',
  'and',
  'assert',
  'del',
  'yield',
  'finally',
  'nonlocal',
  'True',
  'False',
  'None',
  'async',
  'await',
  'print',
  'exec',
  'self'
]);

let safePyName = (name: string): string => {
  return reserved.has(name) ? `${name}_` : name;
};

// add toPyIdentifier for dash-to-underscore and lowercase conversion
let toPyIdentifier = (name: string): string => {
  return name.replace(/-/g, '_').toLowerCase();
};

// add toPyClassName for proper class name capitalization
let toPyClassName = (name: string): string => {
  // convert snake_case or kebab-case to PascalCase
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/(?:^|\s)(\w)/g, (_, c) => c.toUpperCase())
    .replace(/\s+/g, '');
};

let generateClass = (name: string, type: IntrospectedType): string => {
  // ensure required fields come before optional fields
  let entries = Object.entries(type.properties || {});
  let required = entries.filter(([_, v]) => !(v.optional || v.nullable));
  let optional = entries.filter(([_, v]) => v.optional || v.nullable);
  let ordered = [...required, ...optional];
  let fields = ordered
    .map(([key, value]) => {
      let pyName = safePyName(toPyIdentifier(Cases.toSnakeCase(key)));
      let hint = processType(value);
      let defaultVal = value.optional || value.nullable ? ' = None' : '';
      return `    ${pyName}: ${hint}${defaultVal}`;
    })
    .join('\n');

  let body = fields.trim() === '' ? '    pass' : fields;

  let className = toPyClassName(name);

  return `\nfrom dataclasses import dataclass\nfrom typing import Any, Dict, List, Optional, Union\nfrom datetime import datetime\n\n@dataclass\nclass ${className}:\n${body}\n`;
};

let generateAlias = (name: string, type: IntrospectedType): string => {
  let aliasName = toPyClassName(name);
  return `\nfrom typing import Any, Dict, List, Optional, Union\nfrom datetime import datetime\n\n${aliasName} = ${processType(type)}\n`;
};
