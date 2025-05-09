import { Cases } from './case';
import type { IntrospectedType } from './fetch';
import { format } from './format';

export let generateTypescriptMapper = async (
  name: string,
  typename: string,
  type: IntrospectedType
) => {
  return (await format(`export let ${name} = ${generateMapper(type, typename)};\n\n`)) + '\n';
};

let generateMapper = (type: IntrospectedType, typename?: string): string => {
  if (type.type == 'object') {
    return objectMapper(type, typename);
  } else if (type.type == 'array') {
    return arrayMapper(type, typename);
  } else if (type.type == 'union' || type.type == 'intersection') {
    return unionOrIntersectionMapper(type);
  }

  return `mtMap.${getMapperName(type)}()`;
};

let objectMapper = (type: IntrospectedType, typename?: string): string => {
  let seenKeys = new Set();

  let properties = Object.entries(type.properties!)
    .map(([key, value]) => {
      let processedType = generateMapper(value);

      let camelKey = Cases.toCamelCase(key);
      if (seenKeys.has(camelKey)) return undefined!;
      seenKeys.add(camelKey);

      if (key == 'createdAt') key = 'created_at';
      if (key == 'updatedAt') key = 'updated_at';

      return `${camelKey}: mtMap.objectField('${key}', ${processedType})`;
    })
    .filter(Boolean);

  if (typename) {
    return `mtMap.object<${typename}>({ ${properties.join(', ')} })`;
  } else {
    return `mtMap.object({ ${properties.join(', ')} })`;
  }
};

let arrayMapper = (type: IntrospectedType, typename?: string): string => {
  let processedType = generateMapper(type.items![0]);

  if (typename) {
    return `mtMap.array<${typename}>(${processedType})`;
  } else {
    return `mtMap.array(${processedType})`;
  }
};

let unionOrIntersectionMapper = (type: IntrospectedType): string => {
  let objectType: IntrospectedType | undefined;
  let numberType: IntrospectedType | undefined;
  let stringType: IntrospectedType | undefined;
  let booleanType: IntrospectedType | undefined;
  let dateType: IntrospectedType | undefined;
  let arrayTypes: IntrospectedType[] = [];

  for (let item of type.items!) {
    if (item.type == 'object') {
      if (!objectType) objectType = item;

      objectType = {
        ...objectType,
        properties: {
          ...objectType.properties,
          ...item.properties
        }
      };
    } else if (item.type == 'number') {
      if (!numberType) numberType = item;
    } else if (item.type == 'string') {
      if (!stringType) stringType = item;
    } else if (item.type == 'boolean') {
      if (!booleanType) booleanType = item;
    } else if (item.type == 'date') {
      if (!dateType) dateType = item;
    } else if (item.type == 'array') {
      arrayTypes.push(item.items![0]);
    }
  }

  let subMappers: string[] = [];

  if (objectType) subMappers.push(`mtMap.unionOption('object', ${objectMapper(objectType)})`);
  if (numberType) subMappers.push(`mtMap.unionOption('number', mtMap.passthrough())`);
  if (stringType) subMappers.push(`mtMap.unionOption('string', mtMap.passthrough())`);
  if (booleanType) subMappers.push(`mtMap.unionOption('boolean', mtMap.passthrough())`);
  if (dateType) subMappers.push(`mtMap.unionOption('date', mtMap.passthrough())`);

  if (arrayTypes.length) {
    subMappers.push(
      `mtMap.unionOption('array', ${unionOrIntersectionMapper({
        type: 'union',
        items: arrayTypes,
        nullable: false,
        optional: false,
        examples: []
      })})`
    );
  }

  return `mtMap.union([${subMappers.join(', ')}])`;
};

let typeToMapperName = {
  object: 'object',
  array: 'array',

  date: 'date',

  union: 'union',
  intersection: 'union',

  string: 'passthrough',
  literal: 'passthrough',
  enum: 'passthrough',
  number: 'passthrough',
  boolean: 'passthrough',
  any: 'passthrough',
  record: 'passthrough'
};

let getMapperName = (type: IntrospectedType): string =>
  typeToMapperName[type.type as keyof typeof typeToMapperName] ?? 'any';
