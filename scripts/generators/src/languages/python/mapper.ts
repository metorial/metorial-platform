import { Cases } from '../../case';
import type { IntrospectedType } from '../../fetch';
import { safePyName, toPyIdentifier } from './utils';

export let generateMapper = async (
  name: string,
  typename: string,
  type: IntrospectedType
): Promise<string> => {
  const className = name; // e.g. mapDashboardInstanceSessionsCreateOutput
  
  // Generate nested mappers first (recursively)
  let nestedMappers = generateNestedMappers(type, typename);
  
  return (
    `${nestedMappers}
class ${className}:
    @staticmethod
    def from_dict(data: Dict[str, Any]) -> ${typename}:
${_generateMapper(type, typename, 'data', 2, typename)}

    @staticmethod
    def to_dict(value: Union[${typename}, Dict[str, Any], None]) -> Optional[Dict[str, Any]]:
        if value is None:
            return None
        if isinstance(value, dict):
            return value
        # assume dataclass for generated models
        return dataclasses.asdict(value)
` + '\n'
  );
};

// Generate nested mappers for object properties (recursively)
let generateNestedMappers = (type: IntrospectedType, parentClassName: string, seenMappers: Set<string> = new Set()): string => {
  let nestedMappers = '';
  
  let generateMapperRecursive = (currentType: IntrospectedType, currentParentClassName: string): void => {
    if (currentType.properties) {
      for (let [key, value] of Object.entries(currentType.properties)) {
        if (value.type === 'object' && value.properties) {
          let nestedTypeName = getNestedTypeName(key, value, currentParentClassName);
          let mapperName = `map${nestedTypeName}`;
          
          // Avoid generating duplicate mappers
          if (!seenMappers.has(mapperName)) {
            seenMappers.add(mapperName);
            
            // Generate nested mappers for this nested type first
            let nestedNestedMappers = generateNestedMappers(value, nestedTypeName, seenMappers);
            
            // Generate the nested mapper
            nestedMappers += `${nestedNestedMappers}
class ${mapperName}:
    @staticmethod
    def from_dict(data: Dict[str, Any]) -> ${nestedTypeName}:
${_generateMapper(value, nestedTypeName, 'data', 2, nestedTypeName)}

    @staticmethod
    def to_dict(value: Union[${nestedTypeName}, Dict[str, Any], None]) -> Optional[Dict[str, Any]]:
        if value is None:
            return None
        if isinstance(value, dict):
            return value
        return dataclasses.asdict(value)
`;
            
            // Recursively generate mappers for nested objects
            generateMapperRecursive(value, nestedTypeName);
          }
        } else if (value.type === 'array' && value.items && value.items[0].type === 'object') {
          let nestedTypeName = getNestedTypeName(key, value.items[0], currentParentClassName);
          let mapperName = `map${nestedTypeName}`;
          
          // Avoid generating duplicate mappers
          if (!seenMappers.has(mapperName)) {
            seenMappers.add(mapperName);
            
            // Generate nested mappers for this array item type first
            let nestedNestedMappers = generateNestedMappers(value.items[0], nestedTypeName, seenMappers);
            
            // Generate the nested mapper for array items
            nestedMappers += `${nestedNestedMappers}
class ${mapperName}:
    @staticmethod
    def from_dict(data: Dict[str, Any]) -> ${nestedTypeName}:
${_generateMapper(value.items[0], nestedTypeName, 'data', 2, nestedTypeName)}

    @staticmethod
    def to_dict(value: Union[${nestedTypeName}, Dict[str, Any], None]) -> Optional[Dict[str, Any]]:
        if value is None:
            return None
        if isinstance(value, dict):
            return value
        return dataclasses.asdict(value)
`;
            
            // Recursively generate mappers for nested objects in arrays
            generateMapperRecursive(value.items[0], nestedTypeName);
          }
        }
      }
    }
  };
  
  // Start recursive generation
  generateMapperRecursive(type, parentClassName);
  
  return nestedMappers;
};


let _generateMapper = (
  type: IntrospectedType,
  typename: string | undefined,
  source: string,
  indentLevel: number,
  parentClassName?: string
): string => {
  let indent = '    '.repeat(indentLevel);

  if (type.type === 'object') {
    if (typename) {
      // Generate proper object creation with nested types
      let classProps = Object.entries(type.properties || {})
        .map(([key, value]) => {
          let pyName = safePyName(toPyIdentifier(Cases.toSnakeCase(key)));
          let jsonKey =
            key === 'createdAt' ? 'created_at' : key === 'updatedAt' ? 'updated_at' : key;
          
          if (value.type === 'object' && value.properties) {
            let nestedTypeName = getNestedTypeName(key, value, parentClassName || '');
            return `${indent}${pyName}=map${nestedTypeName}.from_dict(${source}.get('${jsonKey}')) if ${source}.get('${jsonKey}') else None`;
          }
          
          if (value.type === 'array' && value.items && value.items[0].type === 'object') {
            let nestedTypeName = getNestedTypeName(key, value.items[0], parentClassName || '');
            return `${indent}${pyName}=[map${nestedTypeName}.from_dict(item) for item in ${source}.get('${jsonKey}', []) if item]`;
          }
          
          if (value.type === 'array') {
            let itemType = value.items?.[0];
            if (itemType?.type === 'date') {
              return `${indent}${pyName}=[datetime.fromisoformat(item) for item in ${source}.get('${jsonKey}', []) if item]`;
            }
            return `${indent}${pyName}=${source}.get('${jsonKey}', [])`;
          }
          
          if (value.type === 'date') {
            return `${indent}${pyName}=datetime.fromisoformat(${source}.get('${jsonKey}')) if ${source}.get('${jsonKey}') else None`;
          }
          
          return `${indent}${pyName}=${source}.get('${jsonKey}')`;
        })
        .join(',\n');
      return `${indent}return ${typename}(\n${classProps}\n${indent})`;
    } else {
      // For nested objects without typename, create dict (fallback)
      let props = Object.entries(type.properties || {})
        .map(([key, value]) => {
          let pyName = safePyName(toPyIdentifier(Cases.toSnakeCase(key)));
          let jsonKey =
            key === 'createdAt' ? 'created_at' : key === 'updatedAt' ? 'updated_at' : key;

          if (value.type === 'object') {
            return `${indent}"${pyName}": ${source}.get('${jsonKey}') and ${_generateMapper(
              value,
              undefined,
              `${source}.get('${jsonKey}', {})`,
              indentLevel + 1,
              parentClassName
            )}`;
          }

          if (value.type === 'array') {
            return `${indent}"${pyName}": [${_generateMapper(value.items![0], undefined, 'item', indentLevel + 2, parentClassName)} for item in ${source}.get('${jsonKey}', [])]`;
          }
          if (value.type === 'date') {
            return `${indent}"${pyName}": ${source}.get('${jsonKey}') and datetime.fromisoformat(${source}.get('${jsonKey}'))`;
          }
          return `${indent}"${pyName}": ${source}.get('${jsonKey}')`;
        })
        .join(',\n');

      return `{\n${props}\n${'    '.repeat(indentLevel - 1)}}`;
    }
  }

  if (type.type === 'array') {
    let itemType = type.items?.[0];
    if (itemType?.type === 'object' && itemType.properties) {
      let nestedTypeName = getNestedTypeName('item', itemType, parentClassName || '');
      return `${indent}[map${nestedTypeName}.from_dict(item) for item in ${source} or [] if item]`;
    }
    let itemMap = _generateMapper(type.items![0], undefined, 'item', indentLevel + 1, parentClassName);
    return `${indent}[${itemMap} for item in ${source} or []]`;
  }

  if (type.type === 'date') {
    return `${indent}${source} and datetime.fromisoformat(${source})`;
  }

  return `${indent}${source}`;
};

// Helper function to get nested type name (same as in type.ts)
let getNestedTypeName = (key: string, type: IntrospectedType, parentClassName: string): string => {
  if (type.type === 'object') {
    let baseName = Cases.toPascalCase(key);
    return `${parentClassName}${baseName}`;
  } else if (type.type === 'array' && type.items && type.items[0].type === 'object') {
    let baseName = Cases.toPascalCase(key);
    // For arrays, use the same name as the array items (not "Item" suffix)
    return `${parentClassName}${baseName}`;
  }
  return '';
};
