import dedent from 'dedent';
import { Cases } from '../../case';
import type { Controller, Endpoint } from '../../fetch';

// Helper function to convert introspected type to Python type hint
let getPythonTypeHint = (type: any): string => {
  let wrapOptional = (
    hint: string,
    optional: boolean = false,
    nullable: boolean = false
  ): string => {
    if (optional || nullable) {
      return `Optional[${hint}]`;
    }
    return hint;
  };

  switch (type.type) {
    case 'string':
    case 'enum':
      return wrapOptional('str', type.optional, type.nullable);
    case 'number':
      return wrapOptional('float', type.optional, type.nullable);
    case 'boolean':
      return wrapOptional('bool', type.optional, type.nullable);
    case 'date':
      return wrapOptional('datetime', type.optional, type.nullable);
    case 'array':
      let itemType = type.items?.[0];
      let itemHint = itemType ? getPythonTypeHint(itemType) : 'Any';
      return wrapOptional(`List[${itemHint}]`, type.optional, type.nullable);
    case 'object':
      return wrapOptional('Dict[str, Any]', type.optional, type.nullable);
    case 'record':
      let valueType = type.items?.[0];
      let valueHint = valueType ? getPythonTypeHint(valueType) : 'Any';
      return wrapOptional(`Dict[str, ${valueHint}]`, type.optional, type.nullable);
    case 'union':
      if (type.items) {
        let unionTypes = type.items
          .map((item: any) => getPythonTypeHint(item))
          .filter(Boolean);
        if (unionTypes.length > 1) {
          return wrapOptional(`Union[${unionTypes.join(', ')}]`, type.optional, type.nullable);
        } else if (unionTypes.length === 1) {
          return wrapOptional(unionTypes[0], type.optional, type.nullable);
        }
      }
      return wrapOptional('Any', type.optional, type.nullable);
    case 'intersection':
      // For intersection types in endpoint hint generation, use Dict[str, Any] as fallback
      return wrapOptional('Dict[str, Any]', type.optional, type.nullable);
    case 'any':
    default:
      return wrapOptional('Any', type.optional, type.nullable);
  }
};

export let createController = async (i: {
  endpoints: (Endpoint & { path: { path: string; sdkPath: string } })[];
  controller: Controller;
  path: string[];
  typeIdToName: Map<string, { typeName: string; mapperName: string }>;
  types?: { id: string; type: any }[];
}): Promise<string> => {
  let endpoints = i.endpoints.map(e =>
    createEndpoint({ ...i, endpoint: e, types: i.types || [] })
  );
  let endpointCode = endpoints.map(e => e.source).join('\n\n');

  // collect unique imports
  let importsSet = new Set<string>();
  endpoints.forEach(e => e.imports.forEach(imp => importsSet.add(imp)));
  let resourcesImports = Array.from(importsSet)
    .map(imp => imp.replace(/^type /, '')) // remove 'type' keyword for Python
    .join(', ');

  let className = `Metorial${i.path.map(Cases.toPascalCase).join('')}Endpoint`;

  // Check if we need typing imports (if any endpoint uses keyword arguments)
  let needsTypingImports = i.endpoints.some(e => {
    let hasBody = e.bodyId && i.typeIdToName.get(e.bodyId);
    let hasQuery = e.queryId && i.typeIdToName.get(e.queryId);
    return (hasBody || hasQuery) && i.types;
  });

  // Check if we need datetime imports (if any endpoint uses datetime type hints)
  let needsDatetimeImports = i.endpoints.some(e => {
    // Check body fields for datetime
    if (e.bodyId) {
      let bodyType = i.types?.find(t => t.id === e.bodyId)?.type;
      if (bodyType && bodyType.type === 'object' && bodyType.properties) {
        if (
          Object.values(bodyType.properties).some(
            (prop: any) =>
              prop.type === 'date' ||
              (prop.type === 'array' && prop.items?.[0]?.type === 'date')
          )
        ) {
          return true;
        }
      }
    }

    // Check query fields for datetime
    if (e.queryId) {
      let queryType = i.types?.find(t => t.id === e.queryId)?.type;
      if (queryType && queryType.type === 'object' && queryType.properties) {
        if (
          Object.values(queryType.properties).some(
            (prop: any) =>
              prop.type === 'date' ||
              (prop.type === 'array' && prop.items?.[0]?.type === 'date')
          )
        ) {
          return true;
        }
      }
    }

    return false;
  });

  let typingImports = needsTypingImports
    ? 'from typing import Any, Dict, List, Optional, Union\n'
    : '';

  let datetimeImports = needsDatetimeImports ? 'from datetime import datetime\n' : '';

  let source = dedent`
    ${typingImports}${datetimeImports}from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
    from ..resources import ${resourcesImports}

    class ${className}(BaseMetorialEndpoint):
        """${i.controller.description}"""

        def __init__(self, config: MetorialEndpointManager):
            super().__init__(config)

${endpointCode
  .split('\n')
  .map(line => (line ? '        ' + line : ''))
  .join('\n')}
  `;

  return source;
};

let generateKeywordArguments = (
  typeDef: IntrospectedType
): { params: string[]; bodyConstruction: string } => {
  if (typeDef.type !== 'object' || !typeDef.properties) {
    return { params: [], bodyConstruction: '{}' };
  }

  let params: string[] = [];
  let paramMappings: string[] = [];

  for (let [apiFieldName, value] of Object.entries(typeDef.properties)) {
    let paramName = safePyName(toPyIdentifier(Cases.toSnakeCase(apiFieldName)));
    let pythonType = mapTypeToPython(value);

    // All body parameters should be optional for partial updates
    params.push(`${paramName}: Optional[${pythonType}] = None`);

    paramMappings.push(`'${apiFieldName}': ${paramName}`);
  }

  let bodyConstructionLines: string[] = [];
  if (paramMappings.length > 0) {
    bodyConstructionLines.push('_params = {');
    bodyConstructionLines.push(`    ${paramMappings.join(',\n    ')}`);
    bodyConstructionLines.push('}');
    bodyConstructionLines.push('body = {k: v for k, v in _params.items() if v is not None}');
    bodyConstructionLines.push('');
    bodyConstructionLines.push('if not body:');
    bodyConstructionLines.push(
      '    raise ValueError("No fields to update. At least one parameter must be provided.")'
    );
  } else {
    bodyConstructionLines.push('body = {}');
  }

  return {
    params,
    bodyConstruction: bodyConstructionLines.join('\n        ')
  };
};

// Map IntrospectedType to Python type
let mapTypeToPython = (type: IntrospectedType): string => {
  switch (type.type) {
    case 'string':
    case 'enum':
    case 'literal':
      return 'str';
    case 'integer':
      return 'int';
    case 'number':
      return 'float';
    case 'boolean':
      return 'bool';
    case 'object':
      return 'Dict[str, Any]';
    case 'array':
      if (type.items && type.items[0]) {
        let itemType = mapTypeToPython(type.items[0]);
        return `List[${itemType}]`;
      }
      return 'List[Any]';
    case 'any':
      return 'Any';
    case 'record':
      if (type.items && type.items[0]) {
        let valueType = mapTypeToPython(type.items[0]);
        return `Dict[str, ${valueType}]`;
      }
      return 'Dict[str, Any]';
    case 'union':
      if (type.items && type.items.length > 0) {
        let unionTypes = type.items.map(item => mapTypeToPython(item));
        // Remove duplicates and filter out None/null
        let uniqueTypes = [...new Set(unionTypes.filter(t => t !== 'None'))];
        if (uniqueTypes.length === 0) return 'Any';
        if (uniqueTypes.length === 1) return uniqueTypes[0];
        return `Union[${uniqueTypes.join(', ')}]`;
      }
      return 'Any';
    case 'intersection':
      return 'Any';
    case 'date':
      return 'str'; // dates are strings
    default:
      return 'Any';
  }
};

let createEndpoint = (i: {
  endpoint: Endpoint & { path: { path: string; sdkPath: string } };
  controller: Controller;
  typeIdToName: Map<string, { typeName: string; mapperName: string }>;
  types: { id: string; type: any }[];
}) => {
  let types: string[] = [i.endpoint.outputId];
  if (i.endpoint.bodyId) types.push(i.endpoint.bodyId);
  if (i.endpoint.queryId) types.push(i.endpoint.queryId);

  let parts = i.endpoint.path.sdkPath.split('.');
  let methodName = parts.pop()!;

  let inputs: { type: string; name: string; optional?: boolean }[] = [];
  let pathParts = i.endpoint.path.path.split('/').filter(Boolean);
  let pathParams = pathParts.filter(p => p.startsWith(':')).map(p => p.slice(1));

  // Create mapping from original param names to snake_case param names
  let paramNameMapping = new Map<string, string>();
  for (let param of pathParams) {
    let snakeCaseParam = Cases.toSnakeCase(param);
    paramNameMapping.set(param, snakeCaseParam);
    inputs.push({
      type: 'str',
      name: snakeCaseParam
    });
  }

  let bodyType = i.endpoint.bodyId ? i.typeIdToName.get(i.endpoint.bodyId)! : undefined;
  let bodyTypeDef = i.endpoint.bodyId ? i.typeDefinitions.get(i.endpoint.bodyId) : undefined;
  let queryType = i.endpoint.queryId ? i.typeIdToName.get(i.endpoint.queryId)! : undefined;
  let outputType = i.typeIdToName.get(i.endpoint.outputId)!;

  // Extract body type properties for keyword arguments
  let bodyTypeObject = i.endpoint.bodyId
    ? i.types.find(t => t.id === i.endpoint.bodyId)?.type
    : null;
  let bodyFields: { name: string; type: string; optional: boolean; pyName: string }[] = [];

  // Extract query type properties for keyword arguments
  let queryTypeObject = i.endpoint.queryId
    ? i.types.find(t => t.id === i.endpoint.queryId)?.type
    : null;
  let queryFields: { name: string; type: string; optional: boolean; pyName: string }[] = [];

  // Python keywords that can't be used as parameter names
  let pythonKeywords = new Set([
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
    'exec',
    'finally',
    'for',
    'from',
    'global',
    'if',
    'import',
    'in',
    'is',
    'lambda',
    'not',
    'or',
    'pass',
    'print',
    'raise',
    'return',
    'try',
    'while',
    'with',
    'yield',
    'None',
    'True',
    'False'
  ]);

  // Helper function to extract properties from object types
  let extractPropertiesFromObject = (
    obj: any,
    fields: { name: string; type: string; optional: boolean; pyName: string }[]
  ) => {
    if (obj.properties) {
      Object.entries(obj.properties).forEach(([key, value]: [string, any]) => {
        let pyName = Cases.toSnakeCase(key); // Use snake_case for parameter name
        // Handle Python keywords by appending underscore
        if (pythonKeywords.has(pyName)) {
          pyName = `${pyName}_`;
        }
        let fieldType = getPythonTypeHint(value);
        fields.push({
          name: key,
          pyName,
          type: fieldType,
          optional: value.optional || value.nullable
        });
      });
    }
  };

  if (bodyTypeObject) {
    if (bodyTypeObject.type === 'object' && bodyTypeObject.properties) {
      // Handle regular object types
      extractPropertiesFromObject(bodyTypeObject, bodyFields);
    } else if (bodyTypeObject.type === 'intersection' && bodyTypeObject.items) {
      // Handle intersection types by merging properties from all objects
      for (let item of bodyTypeObject.items) {
        if (item.type === 'object') {
          extractPropertiesFromObject(item, bodyFields);
        } else if (item.type === 'union' && item.items) {
          // For union types in intersection, add properties from all union members as optional
          for (let unionItem of item.items) {
            if (unionItem.type === 'object' && unionItem.properties) {
              Object.entries(unionItem.properties).forEach(([key, value]: [string, any]) => {
                let pyName = Cases.toSnakeCase(key);
                let fieldType = getPythonTypeHint(value);
                // Check if field already exists to avoid duplicates
                if (!bodyFields.some(f => f.name === key)) {
                  bodyFields.push({
                    name: key,
                    pyName,
                    type: fieldType,
                    optional: true // Union members are always optional since only one branch is used
                  });
                }
              });
            }
          }
        }
      }
    }
  }

  // Extract query fields for all methods
  if (queryTypeObject) {
    if (queryTypeObject.type === 'object' && queryTypeObject.properties) {
      // Handle regular object types
      extractPropertiesFromObject(queryTypeObject, queryFields);
    } else if (queryTypeObject.type === 'intersection' && queryTypeObject.items) {
      // Handle intersection types by merging properties from all objects
      for (let item of queryTypeObject.items) {
        if (item.type === 'object') {
          extractPropertiesFromObject(item, queryFields);
        } else if (item.type === 'union' && item.items) {
          // For union types in intersection, add properties from all union members as optional
          for (let unionItem of item.items) {
            if (unionItem.type === 'object' && unionItem.properties) {
              Object.entries(unionItem.properties).forEach(([key, value]: [string, any]) => {
                let pyName = Cases.toSnakeCase(key);
                let fieldType = getPythonTypeHint(value);
                // Check if field already exists to avoid duplicates
                if (!queryFields.some(f => f.name === key)) {
                  queryFields.push({
                    name: key,
                    pyName,
                    type: fieldType,
                    optional: true // Union members are always optional since only one branch is used
                  });
                }
              });
            }
          }
        }
      }
    }
  }

  if (bodyType) {
    inputs.push({
      type: bodyType.typeName,
      name: 'body'
    });
  }

  if (queryType) {
    inputs.push({
      type: queryType.typeName,
      name: 'query',
      optional: true
    });
  }

  // Generate method signature with keyword arguments for all operations
  let hasBody = bodyType && bodyFields.length > 0;
  let hasQuery = queryType && queryFields.length > 0;

  let params: string[] = ['self'];

  // Add path parameters first
  for (let param of pathParams) {
    let snakeCaseParam = Cases.toSnakeCase(param);
    params.push(`${snakeCaseParam}: str`);
  }

  // Add keyword-only separator if we have body or query fields
  if (hasBody || hasQuery) {
    params.push('*');
  }

  // Add query fields (these come before body fields for better parameter order)
  if (hasQuery) {
    // Add required query fields first (no default values)
    let requiredQueryFields = queryFields.filter(f => !f.optional);
    let optionalQueryFields = queryFields.filter(f => f.optional);

    for (let field of requiredQueryFields) {
      params.push(`${field.pyName}: ${field.type}`);
    }

    for (let field of optionalQueryFields) {
      params.push(`${field.pyName}: ${field.type} = None`);
    }
  }

  // For methods with bodies, add body fields
  if (hasBody) {
    // Add required body fields first (no default values)
    let requiredFields = bodyFields.filter(f => !f.optional);
    let optionalFields = bodyFields.filter(f => f.optional);

    for (let field of requiredFields) {
      params.push(`${field.pyName}: ${field.type}`);
    }

    for (let field of optionalFields) {
      params.push(`${field.pyName}: ${field.type} = None`);
    }
  }

  let methodSignature = params.join(', ');

  // python path list
  let pythonPath = pathParts
    .map(p => {
      if (p.startsWith(':')) {
        let originalParam = p.slice(1);
        let snakeCaseParam = paramNameMapping.get(originalParam) || originalParam;
        return snakeCaseParam;
      } else {
        return `'${p}'`;
      }
    })
    .join(', ');

  // Generate method body
  let methodBody = '';

  // Generate query construction logic for keyword arguments
  if (hasQuery) {
    methodBody += `        # Build query parameters from keyword arguments\n`;
    methodBody += `        query_dict = {}\n`;

    for (let field of queryFields) {
      if (field.optional) {
        methodBody += `        if ${field.pyName} is not None:\n`;
        methodBody += `            query_dict["${field.name}"] = ${field.pyName}\n`;
      } else {
        methodBody += `        query_dict["${field.name}"] = ${field.pyName}\n`;
      }
    }
    methodBody += `\n`;
  }

  if (hasBody) {
    // Generate body construction logic for keyword arguments
    methodBody += `        # Build body parameters from keyword arguments\n`;
    methodBody += `        body_dict = {}\n`;

    for (let field of bodyFields) {
      if (field.optional) {
        methodBody += `        if ${field.pyName} is not None:\n`;
        methodBody += `            body_dict["${field.name}"] = ${field.pyName}\n`;
      } else {
        methodBody += `        body_dict["${field.name}"] = ${field.pyName}\n`;
      }
    }
    methodBody += `\n`;
  }

  // Generate docstring with improved parameter documentation
  let docArgs: string[] = [];

  // Document path parameters
  for (let param of pathParams) {
    let snakeCaseParam = Cases.toSnakeCase(param);
    docArgs.push(`:param ${snakeCaseParam}: str`);
  }

  // Document query fields
  if (hasQuery) {
    for (let field of queryFields) {
      let paramDoc = `:param ${field.pyName}: ${field.type}`;
      if (field.optional) paramDoc += ' (optional)';
      docArgs.push(paramDoc);
    }
  }

  // Document body fields or body parameter
  if (hasBody) {
    for (let field of bodyFields) {
      let paramDoc = `:param ${field.pyName}: ${field.type}`;
      if (field.optional) paramDoc += ' (optional)';
      docArgs.push(paramDoc);
    }
  }

  let docstring = dedent`
    """
    ${i.endpoint.name}
    ${i.endpoint.description}

    ${docArgs.join('\n    ')}
    :return: ${outputType.typeName}
    """`;

  // Generate request construction
  let requestArgs = [`path=[${pythonPath}]`];

  if (hasBody) {
    requestArgs.push(`body=body_dict`);
  }

  if (hasQuery) {
    requestArgs.push(`query=query_dict`);
  }

  // join arguments with commas and newlines for valid Python syntax
  let requestArgsJoined = requestArgs.join(',\n            ');

  let methodBody = bodyConstructionCode
    ? `${bodyConstructionCode}\n        \n        request = MetorialRequest(\n            ${requestArgsJoined}\n        )`
    : `request = MetorialRequest(\n            ${requestArgsJoined}\n        )`;

  let source = dedent`
    def ${Cases.toSnakeCase(methodName)}(${methodSignature}) -> ${outputType.typeName}:
        ${docstring}
${methodBody}        request = MetorialRequest(
            ${requestArgsJoined}
        )
        return self._${i.endpoint.method.toLowerCase()}(request).transform(${outputType.mapperName}.from_dict)
  `;

  return {
    imports: types.flatMap(t => [
      i.typeIdToName.get(t)!.mapperName,
      i.typeIdToName.get(t)!.typeName
    ]),
    source
  };
};
