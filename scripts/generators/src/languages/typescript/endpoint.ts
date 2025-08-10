import dedent from 'dedent';
import { Cases } from '../../case';
import type { Controller, Endpoint } from '../../fetch';
import { format } from '../../format';

export let createController = (i: {
  endpoints: (Endpoint & { path: { path: string; sdkPath: string } })[];
  controller: Controller;
  path: string[];
  typeIdToName: Map<string, { typeName: string; mapperName: string }>;
}) => {
  let endpoints = i.endpoints.map(e => createEndpoint({ ...i, endpoint: e }));
  let endpointCode = endpoints.map(e => e.source).join('\n\n');

  let source = dedent`
    import { BaseMetorialEndpoint, MetorialEndpointManager } from '@metorial/util-endpoint';

    import {
      ${endpoints
        .flatMap(e => e.imports)
        .filter(i => {
          let parts = i.split(' ');
          let lastPart = parts[parts.length - 1];
          return endpointCode.includes(lastPart);
        })
        .sort()
        .join(', ')}
    } from '../resources';

    /**
     * @name ${i.controller.name} controller
     * @description ${i.controller.description}
     *
     * @see https://metorial.com/api
     * @see https://metorial.com/docs
     */
    export class Metorial${Cases.toPascalCase(i.path.join('_'))}Endpoint {
      constructor(private readonly _manager: MetorialEndpointManager<any>) {}

      // thin proxies so method bodies stay unchanged
      private _get(request: any)    { return this._manager._get(request); }
      private _post(request: any)   { return this._manager._post(request); }
      private _put(request: any)    { return this._manager._put(request); }
      private _patch(request: any)  { return this._manager._patch(request); }
      private _delete(request: any) { return this._manager._delete(request); }

      ${endpointCode}
    }
  `;

  return format(source);
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
    inputs.push({ type: 'string', name: param });
  }

  let bodyType = i.endpoint.bodyId ? i.typeIdToName.get(i.endpoint.bodyId)! : undefined;
  let queryType = i.endpoint.queryId ? i.typeIdToName.get(i.endpoint.queryId)! : undefined;
  let outputType = i.typeIdToName.get(i.endpoint.outputId)!;

  if (bodyType) inputs.push({ type: bodyType.typeName, name: 'body' });
  if (queryType) inputs.push({ type: queryType.typeName, name: 'query', optional: true });

  let allInputs = [
    ...inputs,
    { type: '{ headers?: Record<string, string> }', name: 'opts', optional: true }
  ];

  return {
    imports: types.flatMap(t => [
      i.typeIdToName.get(t)!.mapperName,
      `type ${i.typeIdToName.get(t)!.typeName}`
    ]),
    source: dedent`
      /** 
       * @name ${i.endpoint.name}
       * @description ${i.endpoint.description}
       *
       * @param ${allInputs.map(p => `\`${p.name}\` - ${p.type}`).join('\n* @param ')}
       * @returns ${outputType.typeName}
       * @see https://metorial.com/api
       * @see https://metorial.com/docs
       */    
      ${Cases.toCamelCase(methodName)}(
        ${allInputs.map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ')}
      ): Promise<${outputType.typeName}> {
        ${
          pathParams.length > 0
            ? `let path = \`${pathParts.map(p => (p.startsWith(':') ? `\${${p.slice(1)}}` : p)).join('/')}\`;`
            : `let path = '${pathParts.join('/')}';`
        }

        let request = {
          path,
          ${bodyType ? `body: ${bodyType.mapperName}.transformTo(body),` : ''}
          ${queryType ? `query: query ? ${queryType.mapperName}.transformTo(query) : undefined,` : ''}
          ...(opts?.headers ? { headers: opts.headers } : {})
        } as any;

        return this._${i.endpoint.method.toLowerCase()}(request).transform(${outputType.mapperName});  
      }
    `
  };
};
