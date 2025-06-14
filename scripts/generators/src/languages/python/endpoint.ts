import dedent from 'dedent';
import { Cases } from '../../case';
import type { Controller, Endpoint } from '../../fetch';

export let createController = async (i: {
  endpoints: (Endpoint & { path: { path: string; sdkPath: string } })[];
  controller: Controller;
  path: string[];
  typeIdToName: Map<string, { typeName: string; mapperName: string }>;
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

let createEndpoint = (i: {
  endpoint: Endpoint & { path: { path: string; sdkPath: string } };
  controller: Controller;
  typeIdToName: Map<string, { typeName: string; mapperName: string }>;
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

  // python method parameters
  let params = ['self']
    .concat(inputs.map(i => `${i.name}: ${i.type}${i.optional ? ' = None' : ''}`))
    .join(', ');

  // python path list
  let pythonPath = pathParts.map(p => (p.startsWith(':') ? p.slice(1) : `'${p}'`)).join(', ');

  // body and query code
  let bodyCode = bodyType ? `body=${bodyType.mapperName}.transform_to(body),` : '';
  let queryCode = queryType
    ? `query=${queryType.mapperName}.transform_to(query) if query is not None else None,`
    : '';

  let docstring = dedent`
    """
    ${i.endpoint.name}
    ${i.endpoint.description}

    ${inputs.map(inp => `:param ${inp.name}: ${inp.type}`).join('\n    ')}
    :return: ${outputType.typeName}
    """`;

  // use MetorialRequest for all endpoint calls
  let requestArgs = [`path=[${pythonPath}]`];
  if (bodyCode) requestArgs.push(bodyCode);
  if (queryCode) requestArgs.push(queryCode);

  // join arguments with commas and newlines for valid Python syntax
  let requestArgsJoined = requestArgs.join(',\n            ');

  let source = dedent`
    def ${Cases.toSnakeCase(methodName)}(${params}):
        ${docstring}
        request = MetorialRequest(
            ${requestArgsJoined}
        )
        return self._${i.endpoint.method.toLowerCase()}(request).transform(${outputType.mapperName})
  `;

  return {
    imports: types.flatMap(t => [
      i.typeIdToName.get(t)!.mapperName,
      i.typeIdToName.get(t)!.typeName
    ]),
    source
  };
};
