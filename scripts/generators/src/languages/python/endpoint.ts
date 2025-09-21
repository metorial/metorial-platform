import dedent from 'dedent';
import { Cases } from '../../case';
import type { Controller, Endpoint, IntrospectedType } from '../../fetch';
import { safePyName, toPyIdentifier } from './utils';

export let createController = async (i: {
  endpoints: (Endpoint & { path: { path: string; sdkPath: string } })[];
  controller: Controller;
  path: string[];
  typeIdToName: Map<string, { typeName: string; mapperName: string }>;
  typeDefinitions: Map<string, IntrospectedType>;
}): Promise<string> => {
  let endpoints = i.endpoints.map(e => createEndpoint({ ...i, endpoint: e }));
  let endpointCode = endpoints.map(e => e.source).join('\n\n');

  // collect unique imports
  let importsSet = new Set<string>();
  endpoints.forEach(e => e.imports.forEach(imp => importsSet.add(imp)));
  let resourcesImports = Array.from(importsSet)
    .map(imp => imp.replace(/^type /, '')) // remove 'type' keyword for Python
    .join(', ');

  let className = `Metorial${i.path.map(Cases.toPascalCase).join('')}Endpoint`;

  let source = dedent`
    from typing import Optional, Dict, Any, List, Union
    from metorial_util_endpoint import BaseMetorialEndpoint, MetorialEndpointManager, MetorialRequest
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
  typeDefinitions: Map<string, IntrospectedType>;
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
  let bodyTypeDef = i.endpoint.bodyId ? i.typeDefinitions.get(i.endpoint.bodyId) : undefined;
  let queryType = i.endpoint.queryId ? i.typeIdToName.get(i.endpoint.queryId)! : undefined;
  let outputType = i.typeIdToName.get(i.endpoint.outputId)!;

  // Generate keyword-only arguments for body parameters instead of a single body parameter
  let keywordArgs: string[] = [];
  let bodyConstructionCode = '';

  if (bodyType && bodyTypeDef) {
    // Generate keyword arguments from the body type definition
    let keywordParams = generateKeywordArguments(bodyTypeDef);
    keywordArgs = keywordParams.params;
    bodyConstructionCode = keywordParams.bodyConstruction;
  }

  if (queryType) {
    inputs.push({
      type: queryType.typeName,
      name: 'query',
      optional: true
    });
  }

  // python method parameters - add keyword-only arguments after path parameters
  let params = ['self'].concat(
    inputs.map(i => `${i.name}: ${i.type}${i.optional ? ' = None' : ''}`)
  );

  // Add keyword-only arguments if we have body parameters
  if (keywordArgs.length > 0) {
    params.push('*'); // Force keyword-only arguments
    params = params.concat(keywordArgs);
  }

  let paramsString = params.join(', ');

  // python path list
  let pythonPath = pathParts.map(p => (p.startsWith(':') ? p.slice(1) : `'${p}'`)).join(', ');

  // body and query code
  let bodyCode =
    bodyType && !bodyConstructionCode ? `body=${bodyType.mapperName}.to_dict(body),` : '';
  let queryCode = queryType
    ? `query=${queryType.mapperName}.to_dict(query) if query is not None else None,`
    : '';

  // Generate docstring with all parameters
  let allParams = inputs.map(inp => `:param ${inp.name}: ${inp.type}`);
  if (keywordArgs.length > 0) {
    // Extract parameter names and types from keyword arguments for docstring
    let keywordDocs = keywordArgs.map(arg => {
      let [name, typeInfo] = arg.split(':').map(s => s.trim());
      let actualType = typeInfo.replace('Optional[', '').replace('] = None', '');
      return `:param ${name}: ${actualType} (optional)`;
    });
    allParams = allParams.concat(keywordDocs);
  }

  let docstring = dedent`
    """
    ${i.endpoint.name}
    ${i.endpoint.description}

    ${allParams.join('\n    ')}
    :return: ${outputType.typeName}
    """`;

  // use MetorialRequest for all endpoint calls
  let requestArgs = [`path=[${pythonPath}]`];
  if (bodyCode) requestArgs.push(bodyCode);
  if (bodyConstructionCode) requestArgs.push('body=body,');
  if (queryCode) requestArgs.push(queryCode);

  // join arguments with commas and newlines for valid Python syntax
  let requestArgsJoined = requestArgs.join(',\n            ');

  let methodBody = bodyConstructionCode
    ? `${bodyConstructionCode}\n        \n        request = MetorialRequest(\n            ${requestArgsJoined}\n        )`
    : `request = MetorialRequest(\n            ${requestArgsJoined}\n        )`;

  let source = dedent`
    def ${Cases.toSnakeCase(methodName)}(${paramsString}) -> ${outputType.typeName}:
        ${docstring}
        ${methodBody}
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
