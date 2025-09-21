import { Cases } from '../../case';
import type { IntrospectedType } from '../../fetch';
import { safePyName, toPyIdentifier, toPyClassName } from './utils';

export let generateTypeFromIntrospectedType = async (name: string, type: IntrospectedType) => {
  let generatedTypes = new Set<string>();
  let code = type.type === 'object' ? generateClass(name, type, generatedTypes) : generateAlias(name, type);
  
  return code + '\n';
};

let wrapType = (t: IntrospectedType, hint: string): string => {
  if (t.optional || t.nullable) {
    return `Optional[${hint}]`;
  }
  
  return hint;
};

let processType = (type: IntrospectedType, typeName?: string): string => {
  switch (type.type) {
    case 'object':
      // For object types, we need to generate a proper class name
      // If typeName is provided, use it; otherwise fallback to Dict[str, Any]
      if (typeName) {
        return wrapType(type, typeName);
      }
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
      let itemType = type.items![0];
      let itemTypeName = '';
      if (itemType.type === 'object') {
        // For arrays of objects, we need to generate a proper type name
        // This should be handled by the caller with the correct nested type name
        itemTypeName = typeName || 'Dict[str, Any]';
      } else {
        itemTypeName = processType(itemType);
      }
      return wrapType(type, `List[${itemTypeName}]`);
    case 'any':
      return wrapType(type, 'Any');
    case 'record':
      return wrapType(type, `Dict[str, ${processType(type.items![0])}]`);
    case 'union':
      // Handle literal values in unions
      let processedMembers = type.items!.map(item => {
        if (item.type === 'literal') {
          return 'str'; // Convert literals to their base type
        }
        return processType(item);
      });
      
      // Remove duplicates
      let uniqueMembers = [...new Set(processedMembers)];
      
      // If union contains None/null, convert to Optional
      if (type.items!.some(item => item.nullable || item.type === 'null')) {
        let nonNullMembers = uniqueMembers.filter(member => member !== 'None');
        if (nonNullMembers.length > 0) {
          return wrapType(type, `Optional[${nonNullMembers.join(', ')}]`);
        } else {
          return wrapType(type, 'Optional[Any]');
        }
      }
      
      // If only one unique member, return it directly
      if (uniqueMembers.length === 1) {
        return wrapType(type, uniqueMembers[0]);
      }
      
      return wrapType(type, `Union[${uniqueMembers.join(', ')}]`);
    case 'intersection':
      // Python doesn't support intersection hints; fallback to Any
      return wrapType(type, 'Any');
    case 'literal':
      return wrapType(type, 'str');
    default:
      return 'Any';
  }
};


let generateClass = (name: string, type: IntrospectedType, generatedTypes: Set<string> = new Set(), isRoot: boolean = true): string => {
  let className = toPyClassName(name);
  
  // Generate nested types first
  let nestedTypes = generateNestedTypes(type, className, generatedTypes);
  
  // Ensure required fields come before optional fields
  let entries = Object.entries(type.properties || {});
  
  // Sort fields based on actual optional/nullable flags
  let requiredFields = entries.filter(([key, v]) => 
    !(v.optional || v.nullable)
  );
  let optionalFields = entries.filter(([key, v]) => 
    v.optional || v.nullable
  );
  
  // Required fields (no defaults) must come before optional fields (with defaults)
  let ordered = [...requiredFields, ...optionalFields];
  
  let fields = ordered
    .map(([key, value]) => {
      let pyName = safePyName(toPyIdentifier(Cases.toSnakeCase(key)));
      let nestedTypeName = getNestedTypeName(key, value, className);
      let hint = processType(value, nestedTypeName);
      let defaultVal = (value.optional || value.nullable) ? ' = None' : '';
      return `    ${pyName}: ${hint}${defaultVal}`;
    })
    .join('\n');

  let body = fields.trim() === '' ? '    pass' : fields;

  return `${nestedTypes}@dataclass\nclass ${className}:\n${body}\n`;
};

// Generate nested dataclasses for object properties
let generateNestedTypes = (type: IntrospectedType, parentClassName: string, generatedTypes: Set<string>): string => {
  let nestedTypes = '';
  
  if (type.properties) {
    for (let [key, value] of Object.entries(type.properties)) {
      if (value.type === 'object' && value.properties) {
        let nestedTypeName = getNestedTypeName(key, value, parentClassName);
        
        // Avoid generating duplicate types
        if (!generatedTypes.has(nestedTypeName)) {
          generatedTypes.add(nestedTypeName);
          nestedTypes += generateClass(nestedTypeName, value, generatedTypes, false);
        }
      } else if (value.type === 'array' && value.items && value.items[0].type === 'object') {
        let nestedTypeName = getNestedTypeName(key, value.items[0], parentClassName);
        
        if (!generatedTypes.has(nestedTypeName)) {
          generatedTypes.add(nestedTypeName);
          nestedTypes += generateClass(nestedTypeName, value.items[0], generatedTypes, false);
        }
      }
    }
  }
  
  return nestedTypes;
};

// Generate appropriate type name for nested objects
let getNestedTypeName = (key: string, type: IntrospectedType, parentClassName: string): string => {
  if (type.type === 'object') {
    // Create a meaningful name for the nested type
    let baseName = Cases.toPascalCase(key);
    return `${parentClassName}${baseName}`;
  } else if (type.type === 'array' && type.items && type.items[0].type === 'object') {
    let baseName = Cases.toPascalCase(key);
    // For arrays, use the same name as the array items (not "Item" suffix)
    return `${parentClassName}${baseName}`;
  }
  return '';
};

let generateAlias = (name: string, type: IntrospectedType): string => {
  let aliasName = toPyClassName(name);
  return `${aliasName} = ${processType(type)}\n`;
};
