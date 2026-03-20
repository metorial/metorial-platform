/**
 * Go type generator.
 *
 * Generates Go struct definitions, type aliases, and enum constants
 * from introspected API types. Handles nested objects, unions,
 * intersections, enums, arrays, records, and date fields.
 */

import { Cases } from '../../case';
import type { IntrospectedType } from '../../fetch';
import { toGoIdentifier } from './utils';

/**
 * Generates a complete Go type definition from an introspected type.
 * Returns a string containing one or more Go type declarations
 * (structs, type aliases, const blocks) ready to be written to a .go file.
 *
 * NOTE: This does NOT include the package declaration or import block.
 * Those are added by the main generator when assembling the file.
 */
export let generateTypeFromIntrospectedType = async (
  name: string,
  type: IntrospectedType
): Promise<string> => {
  let generatedTypes = new Set<string>();

  let code = '';

  if (type.type === 'object' || type.type === 'intersection') {
    code = generateStruct(name, type, generatedTypes);
  } else if (type.type === 'enum') {
    code = generateEnum(name, type);
  } else if (type.type === 'union') {
    code = generateUnionStruct(name, type, generatedTypes);
  } else {
    code = generateTypeAlias(name, type);
  }

  return code + '\n';
};

/**
 * Checks if a type tree contains any date fields.
 */
export let typeNeedsTime = (t: IntrospectedType): boolean => {
  if (t.type === 'date') return true;
  if (t.properties) {
    for (let value of Object.values(t.properties)) {
      if (typeNeedsTime(value)) return true;
    }
  }
  if (t.items) {
    for (let item of t.items) {
      if (typeNeedsTime(item)) return true;
    }
  }
  return false;
};

/**
 * Wraps a Go type with a pointer if the field is optional or nullable.
 */
let wrapPointer = (goType: string, t: IntrospectedType): string => {
  if (t.optional || t.nullable) {
    return `*${goType}`;
  }
  return goType;
};

/**
 * Resolves the json struct tag for a field. Adds ",omitempty" for
 * optional or nullable fields.
 */
let jsonTag = (apiFieldName: string, t: IntrospectedType): string => {
  let tag = apiFieldName;
  if (t.optional || t.nullable) {
    tag += ',omitempty';
  }
  return `\`json:"${tag}"\``;
};

/**
 * Maps an IntrospectedType to its Go type string.
 */
let processType = (type: IntrospectedType, typeName?: string): string => {
  switch (type.type) {
    case 'object':
      if (typeName) {
        return wrapPointer(typeName, type);
      }
      return wrapPointer('map[string]any', type);

    case 'enum':
    case 'string':
    case 'literal':
      return wrapPointer('string', type);

    case 'number':
      return wrapPointer('float64', type);

    case 'boolean':
      return wrapPointer('bool', type);

    case 'date':
      return wrapPointer('time.Time', type);

    case 'array': {
      let itemType = type.items![0];
      let itemGoType = '';
      if (itemType.type === 'object') {
        itemGoType = typeName || 'map[string]any';
      } else {
        itemGoType = processType(itemType);
      }
      return wrapPointer(`[]${itemGoType}`, type);
    }

    case 'any':
      return wrapPointer('any', type);

    case 'record': {
      let valueGoType = type.items?.[0] ? processType(type.items[0]) : 'any';
      return wrapPointer(`map[string]${valueGoType}`, type);
    }

    case 'union': {
      let items = type.items || [];
      let hasObjects = items.some(i => i.type === 'object');
      if (hasObjects) {
        if (typeName) {
          return wrapPointer(typeName, type);
        }
        return wrapPointer('any', type);
      }
      let baseTypes = new Set(
        items.map(i => {
          if (i.type === 'literal') return 'string';
          if (i.type === 'string' || i.type === 'enum') return 'string';
          if (i.type === 'number') return 'float64';
          if (i.type === 'boolean') return 'bool';
          return 'any';
        })
      );
      if (baseTypes.size === 1) {
        return wrapPointer(Array.from(baseTypes)[0], type);
      }
      return wrapPointer('any', type);
    }

    case 'intersection':
      if (typeName) {
        return wrapPointer(typeName, type);
      }
      return wrapPointer('map[string]any', type);

    default:
      return 'any';
  }
};

/**
 * Generates a Go struct definition for an object or intersection type.
 */
let generateStruct = (
  name: string,
  type: IntrospectedType,
  generatedTypes: Set<string>,
  isRoot: boolean = true
): string => {
  let structName = toGoIdentifier(name);

  // Merge properties for intersection types
  let mergedProperties: Record<string, IntrospectedType> = {};

  if (type.type === 'intersection' && type.items) {
    for (let item of type.items) {
      if (item.type === 'object' && item.properties) {
        Object.assign(mergedProperties, item.properties);
      } else if (item.type === 'union' && item.items) {
        for (let unionItem of item.items) {
          if (unionItem.type === 'object' && unionItem.properties) {
            for (let [key, prop] of Object.entries(unionItem.properties)) {
              mergedProperties[key] = { ...prop, optional: true };
            }
          }
        }
      }
    }
  } else if (type.properties) {
    mergedProperties = type.properties;
  }

  // Generate nested types first (depth-first)
  let nestedTypes = generateNestedTypes(
    { ...type, properties: mergedProperties },
    structName,
    generatedTypes
  );

  // Build struct fields
  let entries = Object.entries(mergedProperties);

  let fields = entries
    .map(([key, value]) => {
      let goFieldName = toGoIdentifier(key);
      let nestedTypeName = getNestedTypeName(key, value, structName);
      let goType = processType(value, nestedTypeName);
      let tag = jsonTag(key, value);

      let comment = value.description
        ? `\t// ${goFieldName} - ${value.description}\n`
        : '';
      return `${comment}\t${goFieldName} ${goType} ${tag}`;
    })
    .join('\n');

  let description = type.description
    ? `// ${structName} - ${type.description}\n`
    : `// ${structName} represents the ${formatTypeName(name)} type.\n`;

  let body = fields.trim() === '' ? '' : `\n${fields}\n`;

  return `${nestedTypes}${description}type ${structName} struct {${body}}\n`;
};

/**
 * Generates nested struct types for object properties and array items.
 */
let generateNestedTypes = (
  type: IntrospectedType,
  parentStructName: string,
  generatedTypes: Set<string>
): string => {
  let nestedTypes = '';

  if (type.properties) {
    for (let [key, value] of Object.entries(type.properties)) {
      if (value.type === 'object' && value.properties) {
        let nestedTypeName = getNestedTypeName(key, value, parentStructName);

        if (!generatedTypes.has(nestedTypeName)) {
          generatedTypes.add(nestedTypeName);
          nestedTypes += generateStruct(nestedTypeName, value, generatedTypes, false);
        }
      } else if (value.type === 'array' && value.items && value.items[0].type === 'object') {
        let nestedTypeName = getNestedTypeName(key, value.items[0], parentStructName);

        if (!generatedTypes.has(nestedTypeName)) {
          generatedTypes.add(nestedTypeName);
          nestedTypes += generateStruct(nestedTypeName, value.items[0], generatedTypes, false);
        }
      } else if (value.type === 'union' && value.items) {
        let hasObjects = value.items.some(i => i.type === 'object');
        if (hasObjects) {
          let nestedTypeName = getNestedTypeName(key, value, parentStructName);
          if (!generatedTypes.has(nestedTypeName)) {
            generatedTypes.add(nestedTypeName);
            nestedTypes += generateUnionStruct(nestedTypeName, value, generatedTypes);
          }
        }
      }
    }
  }

  return nestedTypes;
};

/**
 * Generates a name for a nested type.
 */
let getNestedTypeName = (
  key: string,
  type: IntrospectedType,
  parentStructName: string
): string => {
  if (type.type === 'object') {
    let baseName = Cases.toPascalCase(key);
    return `${parentStructName}${baseName}`;
  } else if (type.type === 'array' && type.items && type.items[0].type === 'object') {
    let baseName = Cases.toPascalCase(key);
    return `${parentStructName}${baseName}`;
  } else if (type.type === 'union') {
    let baseName = Cases.toPascalCase(key);
    return `${parentStructName}${baseName}`;
  }
  return '';
};

/**
 * Generates a Go union struct by merging all object member properties
 * into a single struct with all fields as pointers.
 */
let generateUnionStruct = (
  name: string,
  type: IntrospectedType,
  generatedTypes: Set<string>
): string => {
  let structName = toGoIdentifier(name);
  let items = type.items || [];

  // Collect all properties from all object members
  let allProperties: Record<string, IntrospectedType> = {};

  for (let item of items) {
    if (item.type === 'object' && item.properties) {
      for (let [key, prop] of Object.entries(item.properties)) {
        allProperties[key] = { ...prop, optional: true };
      }
    }
  }

  if (Object.keys(allProperties).length === 0) {
    return generateTypeAlias(name, type);
  }

  let nestedTypes = generateNestedTypes(
    { ...type, properties: allProperties, type: 'object' } as IntrospectedType,
    structName,
    generatedTypes
  );

  let fields = Object.entries(allProperties)
    .map(([key, value]) => {
      let goFieldName = toGoIdentifier(key);
      let nestedTypeName = getNestedTypeName(key, value, structName);
      let goType = processType(value, nestedTypeName);
      let tag = jsonTag(key, value);

      let comment = value.description
        ? `\t// ${goFieldName} - ${value.description}\n`
        : '';
      return `${comment}\t${goFieldName} ${goType} ${tag}`;
    })
    .join('\n');

  let description =
    `// ${structName} represents one of several possible types.\n` +
    `// This is a union type - only one set of fields will be populated.\n`;

  let body = fields.trim() === '' ? '' : `\n${fields}\n`;

  return `${nestedTypes}${description}type ${structName} struct {${body}}\n`;
};

/**
 * Generates an enum as a Go type alias with a const block.
 */
let generateEnum = (name: string, type: IntrospectedType): string => {
  let enumName = toGoIdentifier(name);
  let items = type.items || [];

  let constValues = items
    .map(item => {
      if (item.type === 'literal' && item.name !== undefined) {
        let constName = `${enumName}${Cases.toPascalCase(String(item.name))}`;
        return `\t${constName} ${enumName} = "${item.name}"`;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');

  let description = type.description
    ? `// ${enumName} - ${type.description}\n`
    : `// ${enumName} represents the ${formatTypeName(name)} enum.\n`;

  let code = `${description}type ${enumName} = string\n`;

  if (constValues) {
    code += `\nconst (\n${constValues}\n)\n`;
  }

  return code;
};

/**
 * Generates a simple Go type alias.
 */
let generateTypeAlias = (name: string, type: IntrospectedType): string => {
  let aliasName = toGoIdentifier(name);
  let goType = processType(type);
  let description = type.description
    ? `// ${aliasName} - ${type.description}\n`
    : `// ${aliasName} is a type alias.\n`;
  return `${description}type ${aliasName} = ${goType}\n`;
};

let lowercaseFirst = (s: string): string => {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
};

let formatTypeName = (name: string): string => {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .toLowerCase();
};
