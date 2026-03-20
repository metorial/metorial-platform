/**
 * Go endpoint generator.
 *
 * Generates Go endpoint structs with methods for each API controller.
 * Each controller becomes a struct with typed methods that delegate
 * to an HTTP client, handling path parameters, query parameters,
 * and request bodies.
 */

import { Cases } from '../../case';
import type { Controller, Endpoint, IntrospectedType } from '../../fetch';
import { toGoIdentifier, toGoFolderName } from './utils';

let GO_MODULE_PATH = 'github.com/metorial/metorial-go/v1';

/**
 * Maps an IntrospectedType to a Go type string for use in endpoint
 * parameter structs.
 */
let mapTypeToGo = (type: IntrospectedType): string => {
  let wrapOptional = (goType: string, optional: boolean, nullable: boolean): string => {
    if (optional || nullable) {
      return `*${goType}`;
    }
    return goType;
  };

  switch (type.type) {
    case 'string':
    case 'enum':
    case 'literal':
      return wrapOptional('string', type.optional, type.nullable);
    case 'number':
      return wrapOptional('float64', type.optional, type.nullable);
    case 'boolean':
      return wrapOptional('bool', type.optional, type.nullable);
    case 'date':
      return wrapOptional('string', type.optional, type.nullable);
    case 'array': {
      let itemType = type.items?.[0];
      let itemGo = itemType ? mapTypeToGo(itemType) : 'any';
      return wrapOptional(`[]${itemGo}`, type.optional, type.nullable);
    }
    case 'object':
      return wrapOptional('map[string]any', type.optional, type.nullable);
    case 'record': {
      let valueType = type.items?.[0];
      let valueGo = valueType ? mapTypeToGo(valueType) : 'any';
      return wrapOptional(`map[string]${valueGo}`, type.optional, type.nullable);
    }
    case 'union': {
      if (type.items && type.items.length > 0) {
        let baseTypes = new Set(
          type.items.map(i => {
            if (i.type === 'literal' || i.type === 'string' || i.type === 'enum') return 'string';
            if (i.type === 'number') return 'float64';
            if (i.type === 'boolean') return 'bool';
            return 'any';
          })
        );
        if (baseTypes.size === 1) {
          return wrapOptional(Array.from(baseTypes)[0], type.optional, type.nullable);
        }
      }
      return wrapOptional('any', type.optional, type.nullable);
    }
    case 'intersection':
      return wrapOptional('map[string]any', type.optional, type.nullable);
    case 'any':
    default:
      return wrapOptional('any', type.optional, type.nullable);
  }
};

/**
 * Extracts properties from an introspected type, handling object,
 * intersection, and union types by merging properties.
 */
let extractProperties = (
  typeDef: IntrospectedType
): Record<string, IntrospectedType> => {
  let props: Record<string, IntrospectedType> = {};

  if (typeDef.type === 'object' && typeDef.properties) {
    Object.assign(props, typeDef.properties);
  } else if (typeDef.type === 'intersection' && typeDef.items) {
    for (let item of typeDef.items) {
      if (item.type === 'object' && item.properties) {
        Object.assign(props, item.properties);
      } else if (item.type === 'union' && item.items) {
        for (let unionItem of item.items) {
          if (unionItem.type === 'object' && unionItem.properties) {
            for (let [key, prop] of Object.entries(unionItem.properties)) {
              if (!props[key]) {
                props[key] = { ...prop, optional: true };
              }
            }
          }
        }
      }
    }
  }

  return props;
};

/**
 * Generates a complete Go endpoint file for a controller.
 */
export let createController = async (i: {
  endpoints: (Endpoint & { path: { path: string; sdkPath: string } })[];
  controller: Controller;
  path: string[];
  namePath?: string[];
  typeIdToName: Map<string, { typeName: string; mapperName: string }>;
  types?: { id: string; type: IntrospectedType }[];
}): Promise<string> => {
  // namePath has kebab-case parts for proper PascalCase naming; path has Go folder names for imports
  let naming = i.namePath || i.path;
  let endpointStructName = `${naming.map(Cases.toPascalCase).join('')}Endpoint`;

  // The resource package path is the folder path for resource types.
  let resourcePkgParts = i.path.map(toGoFolderName);
  let resourcePkgPath = resourcePkgParts.join('/');
  // Go package name is the leaf directory name
  let resourcePkgName = resourcePkgParts[resourcePkgParts.length - 1];

  // Generate each endpoint method
  let methods: string[] = [];
  let paramStructs: string[] = [];

  for (let endpoint of i.endpoints) {
    let result = createEndpointMethod({
      endpoint,
      controller: i.controller,
      endpointStructName,
      typeIdToName: i.typeIdToName,
      types: i.types || [],
      resourcePkgName,
    });

    methods.push(result.source);

    if (result.paramStruct) {
      paramStructs.push(result.paramStruct);
    }
  }

  // Build imports block
  let imports: string[] = [];
  imports.push(`\t"${GO_MODULE_PATH}/internal/endpoint"`);
  imports.push(`\t"${GO_MODULE_PATH}/resources/${resourcePkgPath}"`);
  imports.sort();

  let importsBlock = `import (\n${imports.join('\n')}\n)`;

  // Build the endpoint struct + constructor
  let description = i.controller.description
    ? `// ${endpointStructName} provides access to ${lowercaseFirst(i.controller.description)}\n`
    : `// ${endpointStructName} provides access to ${i.path.join(' ')} operations.\n`;

  let structDef = `${description}type ${endpointStructName} struct {\n\tclient *endpoint.Client\n}`;

  let constructor =
    `// New${endpointStructName} creates a new ${endpointStructName}.\n` +
    `func New${endpointStructName}(client *endpoint.Client) *${endpointStructName} {\n` +
    `\treturn &${endpointStructName}{client: client}\n` +
    `}`;

  // Assemble the full file
  let paramStructsCode = paramStructs.length > 0 ? paramStructs.join('\n\n') + '\n\n' : '';
  let methodsCode = methods.join('\n\n');

  let source = `package endpoints\n\n${importsBlock}\n\n${structDef}\n\n${constructor}\n\n${paramStructsCode}${methodsCode}\n`;

  return source;
};

/**
 * Generates a single endpoint method and its associated parameter struct.
 */
let createEndpointMethod = (i: {
  endpoint: Endpoint & { path: { path: string; sdkPath: string } };
  controller: Controller;
  endpointStructName: string;
  typeIdToName: Map<string, { typeName: string; mapperName: string }>;
  types: { id: string; type: IntrospectedType }[];
  resourcePkgName: string;
}): {
  source: string;
  paramStruct: string | null;
} => {
  let sdkParts = i.endpoint.path.sdkPath.split('.');
  let rawMethodName = sdkParts.pop()!;
  let methodName = Cases.toPascalCase(rawMethodName);

  // Parse path parameters
  let pathParts = i.endpoint.path.path.split('/').filter(Boolean);
  let pathParams = pathParts.filter(p => p.startsWith(':')).map(p => p.slice(1));

  // Derive the output type name from the sdkPath parts (matching how resource files name types).
  // Use kebab-case parts so PascalCase conversion preserves word boundaries
  // (e.g., "provider-deployments" → "ProviderDeployments" not "Providerdeployments").
  let kebabParts = sdkParts.map(p => Cases.toKebabCase(p));
  let kebabMethodName = Cases.toKebabCase(rawMethodName);
  let outputGoType = Cases.toPascalCase([...kebabParts, kebabMethodName, 'output'].join('_'));
  let qualifiedOutputType = `${i.resourcePkgName}.${outputGoType}`;

  // Build method parameters
  let httpMethod = i.endpoint.method.toUpperCase();
  let funcParams: string[] = [];

  // Path parameters
  for (let param of pathParams) {
    let goParamName = Cases.toCamelCase(param);
    funcParams.push(`${goParamName} string`);
  }

  // Determine body/query types
  let bodyTypeDef = i.endpoint.bodyId
    ? i.types.find(t => t.id === i.endpoint.bodyId)?.type
    : null;
  let queryTypeDef = i.endpoint.queryId
    ? i.types.find(t => t.id === i.endpoint.queryId)?.type
    : null;

  let bodyProps = bodyTypeDef ? extractProperties(bodyTypeDef) : {};
  let queryProps = queryTypeDef ? extractProperties(queryTypeDef) : {};

  let hasBody = Object.keys(bodyProps).length > 0;
  let hasQuery = Object.keys(queryProps).length > 0;

  // Generate parameter struct(s)
  let paramStruct: string | null = null;
  let bodyStructName = '';
  let queryStructName = '';

  if (hasBody && hasQuery) {
    bodyStructName = `${i.endpointStructName}${methodName}Body`;
    queryStructName = `${i.endpointStructName}${methodName}Params`;

    let bodyStructFields = generateStructFields(bodyProps);
    let queryStructFields = generateStructFields(queryProps);

    paramStruct =
      `// ${bodyStructName} contains the request body for ${methodName}.\n` +
      `type ${bodyStructName} struct {\n${bodyStructFields.code}}\n\n` +
      `// ${queryStructName} contains optional query parameters for ${methodName}.\n` +
      `type ${queryStructName} struct {\n${queryStructFields.code}}`;

    funcParams.push(`body *${bodyStructName}`);
    funcParams.push(`params *${queryStructName}`);
  } else if (hasBody) {
    bodyStructName = `${i.endpointStructName}${methodName}Body`;
    let bodyStructFields = generateStructFields(bodyProps);

    paramStruct =
      `// ${bodyStructName} contains the request body for ${methodName}.\n` +
      `type ${bodyStructName} struct {\n${bodyStructFields.code}}`;

    funcParams.push(`body *${bodyStructName}`);
  } else if (hasQuery) {
    queryStructName = `${i.endpointStructName}${methodName}Params`;
    let queryStructFields = generateStructFields(queryProps);

    paramStruct =
      `// ${queryStructName} contains optional query parameters for ${methodName}.\n` +
      `type ${queryStructName} struct {\n${queryStructFields.code}}`;

    funcParams.push(`params *${queryStructName}`);
  }

  // Build method signature
  let receiver = `(e *${i.endpointStructName})`;
  let paramsStr = funcParams.join(', ');
  let signature = `func ${receiver} ${methodName}(${paramsStr}) (*${qualifiedOutputType}, error)`;

  // Build method body
  let bodyLines: string[] = [];

  // Query construction
  if (hasQuery) {
    bodyLines.push(`\tvar query map[string]any`);
    bodyLines.push(`\tif params != nil {`);
    bodyLines.push(`\t\tquery = endpoint.StructToQuery(params)`);
    bodyLines.push(`\t}`);
  }

  // Build path array
  let goPath = pathParts.map(p => {
    if (p.startsWith(':')) {
      return Cases.toCamelCase(p.slice(1));
    }
    return `"${p}"`;
  });

  // Build request struct
  let requestFields: string[] = [];
  requestFields.push(`\t\tPath:  []string{${goPath.join(', ')}},`);

  if (hasQuery) {
    requestFields.push(`\t\tQuery: query,`);
  }

  if (hasBody) {
    requestFields.push(`\t\tBody:  body,`);
  }

  bodyLines.push(`\treq := &endpoint.Request{`);
  bodyLines.push(...requestFields);
  bodyLines.push(`\t}`);

  // Result variable + client call
  bodyLines.push(`\tvar result ${qualifiedOutputType}`);

  let clientMethod = httpMethod.charAt(0).toUpperCase() + httpMethod.slice(1).toLowerCase();
  bodyLines.push(`\tif err := e.client.${clientMethod}(req, &result); err != nil {`);
  bodyLines.push(`\t\treturn nil, err`);
  bodyLines.push(`\t}`);
  bodyLines.push(`\treturn &result, nil`);

  // Build docstring
  let doc = i.endpoint.description
    ? `// ${methodName} ${lowercaseFirst(i.endpoint.description)}`
    : `// ${methodName} performs the ${i.endpoint.name} operation.`;

  let source = `${doc}\n${signature} {\n${bodyLines.join('\n')}\n}`;

  return {
    source,
    paramStruct,
  };
};

/**
 * Generates Go struct field lines for a set of properties.
 */
let generateStructFields = (
  properties: Record<string, IntrospectedType>
): { code: string } => {
  let lines: string[] = [];

  for (let [key, value] of Object.entries(properties)) {
    let goFieldName = toGoIdentifier(key);
    let goType = mapTypeToGo(value);

    let isOptional = value.optional || value.nullable;
    let tag: string;
    if (isOptional) {
      tag = `\`json:"${key},omitempty"\``;
    } else {
      tag = `\`json:"${key}"\``;
    }

    let comment = value.description ? `\t// ${goFieldName} - ${value.description}\n` : '';
    lines.push(`${comment}\t${goFieldName} ${goType} ${tag}`);
  }

  return { code: lines.join('\n') + '\n' };
};

/**
 * Lowercases the first character of a string.
 */
let lowercaseFirst = (s: string): string => {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
};
