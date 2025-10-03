import dedent from 'dedent';
import { Cases } from '../../case';
import type { Controller, Endpoint } from '../../fetch';

// Helper function to convert introspected type to Python type hint
let getPythonTypeHint = (type: any): string => {
  const wrapOptional = (
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
    let isModificationMethod = ['POST', 'PUT', 'PATCH'].includes(e.method.toUpperCase());
    return hasBody && isModificationMethod;
  });

  // Check if we need datetime imports (if any endpoint uses datetime type hints)
  let needsDatetimeImports = i.endpoints.some(e => {
    if (!e.bodyId) return false;
    let bodyType = i.types?.find(t => t.id === e.bodyId)?.type;
    if (!bodyType || bodyType.type !== 'object' || !bodyType.properties) return false;

    return Object.values(bodyType.properties).some(
      (prop: any) =>
        prop.type === 'date' || (prop.type === 'array' && prop.items?.[0]?.type === 'date')
    );
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

  for (let param of pathParams) {
    inputs.push({
      type: 'str',
      name: param
    });
  }

  let bodyType = i.endpoint.bodyId ? i.typeIdToName.get(i.endpoint.bodyId)! : undefined;
  let queryType = i.endpoint.queryId ? i.typeIdToName.get(i.endpoint.queryId)! : undefined;
  let outputType = i.typeIdToName.get(i.endpoint.outputId)!;

  // Extract body type properties for keyword arguments
  let bodyTypeObject = i.endpoint.bodyId
    ? i.types.find(t => t.id === i.endpoint.bodyId)?.type
    : null;
  let bodyFields: { name: string; type: string; optional: boolean; pyName: string }[] = [];

  // Helper function to extract properties from object types
  let extractPropertiesFromObject = (obj: any) => {
    if (obj.properties) {
      Object.entries(obj.properties).forEach(([key, value]: [string, any]) => {
        let pyName = Cases.toSnakeCase(key);
        let fieldType = getPythonTypeHint(value);
        bodyFields.push({
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
      extractPropertiesFromObject(bodyTypeObject);
    } else if (bodyTypeObject.type === 'intersection' && bodyTypeObject.items) {
      // Handle intersection types by merging properties from all objects
      for (let item of bodyTypeObject.items) {
        if (item.type === 'object') {
          extractPropertiesFromObject(item);
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

  // Generate method signature with keyword arguments for POST/PUT/PATCH operations
  let hasBody = bodyType && bodyFields.length > 0;
  let isModificationMethod = ['POST', 'PUT', 'PATCH'].includes(
    i.endpoint.method.toUpperCase()
  );

  let params: string[] = ['self'];

  // Add path parameters first
  for (let param of pathParams) {
    params.push(`${param}: str`);
  }

  // For methods with bodies, add keyword-only separator and individual fields
  if (hasBody && isModificationMethod && bodyType) {
    // Force keyword-only arguments for body fields
    params.push('*');

    // Add required body fields first (no default values)
    let requiredFields = bodyFields.filter(f => !f.optional);
    let optionalFields = bodyFields.filter(f => f.optional);

    for (let field of requiredFields) {
      params.push(`${field.pyName}: ${field.type}`);
    }

    for (let field of optionalFields) {
      params.push(`${field.pyName}: ${field.type} = None`);
    }

    // Add legacy body parameter support
    params.push(`_body: Optional[${bodyType.typeName}] = None`);
  } else if (bodyType) {
    // For non-modification methods or simple bodies, use the original body parameter
    params.push(`body: ${bodyType.typeName}`);
  }

  // Add query parameter
  if (queryType) {
    params.push(`query: ${queryType.typeName} = None`);
  }

  let methodSignature = params.join(', ');

  // python path list
  let pythonPath = pathParts.map(p => (p.startsWith(':') ? p.slice(1) : `'${p}'`)).join(', ');

  // Generate method body
  let methodBody = '';

  if (hasBody && isModificationMethod && bodyType) {
    // Generate body construction logic for keyword arguments
    methodBody += `        # Handle body parameter - support both keyword args and legacy body dict\n`;
    methodBody += `        if _body is not None:\n`;
    methodBody += `            # Legacy dictionary support\n`;
    methodBody += `            body_dict = ${bodyType.mapperName}.to_dict(_body)\n`;
    methodBody += `        else:\n`;
    methodBody += `            # Build from keyword arguments\n`;
    methodBody += `            body_dict = {}\n`;

    for (let field of bodyFields) {
      if (field.optional) {
        methodBody += `            if ${field.pyName} is not None:\n`;
        methodBody += `                body_dict["${field.name}"] = ${field.pyName}\n`;
      } else {
        methodBody += `            body_dict["${field.name}"] = ${field.pyName}\n`;
      }
    }
    methodBody += `\n`;
  }

  // Generate docstring with improved parameter documentation
  let docArgs: string[] = [];

  // Document path parameters
  for (let param of pathParams) {
    docArgs.push(`:param ${param}: str`);
  }

  // Document body fields (for modification methods) or body parameter
  if (hasBody && isModificationMethod && bodyType) {
    for (let field of bodyFields) {
      let paramDoc = `:param ${field.pyName}: ${field.type}`;
      if (field.optional) paramDoc += ' (optional)';
      docArgs.push(paramDoc);
    }
    docArgs.push(
      `:param _body: ${bodyType.typeName} (optional) - Legacy dictionary format (deprecated)`
    );
  } else if (bodyType) {
    docArgs.push(`:param body: ${bodyType.typeName}`);
  }

  // Document query parameter
  if (queryType) {
    docArgs.push(`:param query: ${queryType.typeName} (optional)`);
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

  if (hasBody && isModificationMethod && bodyType) {
    requestArgs.push(`body=body_dict`);
  } else if (bodyType) {
    requestArgs.push(`body=${bodyType.mapperName}.to_dict(body)`);
  }

  if (queryType) {
    requestArgs.push(
      `query=${queryType.mapperName}.to_dict(query) if query is not None else None`
    );
  }

  // join arguments with commas and newlines for valid Python syntax
  let requestArgsJoined = requestArgs.join(',\n            ');

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
