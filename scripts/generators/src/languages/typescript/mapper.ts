import type { IntrospectedType } from '../../fetch';
import { format } from '../../format';
import { getObjectProperties, validateTypeProperties } from './properties';
import type { Branch, Descriptor, Field, MapperOptions, Target } from './descriptor';
import { matchPattern } from './patterns';

export let generateMapper = async (
  name: string,
  typename: string,
  type: IntrospectedType,
  options: MapperOptions = {}
): Promise<string> => {
  let descriptor = generateMapperDescriptor(type, typename, options);
  let flags = options.dateDefaults !== false && requiresDateDefaults(descriptor) ? ', 1' : '';
  let expression =
    Array.isArray(descriptor) && descriptor[0] === 1
      ? `mapObject<${typename}>(${JSON.stringify(descriptor[1])}${flags})`
      : `createMapper<${typename}>(${JSON.stringify(descriptor)}${flags})`;

  return (await format(`export let ${name} = /* @__PURE__ */ ${expression};\n`)) + '\n';
};

let generateDescriptor = (
  type: IntrospectedType,
  path: string,
  options: MapperOptions
): Descriptor => {
  if (type.type === 'object') {
    let fields: Field[] = [];

    for (let { key, source, target, value } of getObjectProperties(type, path)) {
      let child = generateDescriptor(value, `${path}.${key}`, options);
      let automatic =
        /^[a-z]+(?:_[a-z]+)+$/.test(source) &&
        source.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()) === target;
      let rename: Target = source === target ? 0 : automatic ? 1 : target;

      if (child === 0) {
        if (source !== target) fields.push(automatic ? source : [source, rename]);
      } else {
        fields.push([source, rename, child]);
      }
    }

    return matchPattern(type, fields.length ? [1, fields] : 0, options);
  }

  if (type.type === 'array') {
    let child = generateDescriptor(type.items![0], `${path}[]`, options);
    return child === 0 ? 0 : [2, child];
  }

  if (type.type === 'union' || type.type === 'intersection')
    return generateUnion(type, path, options);
  if (type.type === 'date') return 4;

  return 0;
};

let flattenItems = (items: IntrospectedType[]): IntrospectedType[] =>
  items.flatMap(item =>
    item.type === 'union' || item.type === 'intersection'
      ? flattenItems(item.items ?? [])
      : item
  );

let generateUnion = (
  type: IntrospectedType,
  path: string,
  options: MapperOptions
): Descriptor => {
  let objectType: IntrospectedType | undefined;
  let arrayTypes: IntrospectedType[] = [];
  let primitives = new Set<number>();

  for (let item of flattenItems(type.items ?? [])) {
    if (item.type === 'object') {
      getObjectProperties(item, path);
      objectType = { ...item, properties: { ...objectType?.properties, ...item.properties } };
    } else if (item.type === 'array') {
      arrayTypes.push(item.items![0]);
    } else if (item.type === 'date') {
      primitives.add(2);
    } else if (item.type === 'string') {
      primitives.add(3);
    } else if (item.type === 'number') {
      primitives.add(4);
    } else if (item.type === 'boolean') {
      primitives.add(5);
    } else if (item.type === 'enum' || item.type === 'literal') {
      for (let example of item.examples) {
        if (typeof example === 'string') primitives.add(3);
        if (typeof example === 'number') primitives.add(4);
        if (typeof example === 'boolean') primitives.add(5);
      }
    }
  }

  let branches: Branch[] = [];

  if (objectType) {
    let child = generateDescriptor(objectType, path, options);
    if (child !== 0) branches.push([0, child]);
  }

  if (arrayTypes.length) {
    let child = generateUnion(
      { ...type, type: 'union', items: arrayTypes },
      `${path}[]`,
      options
    );
    if (child !== 0) branches.push([1, [2, child]]);
  }

  if (primitives.has(2)) {
    branches.push([2, 4]);
    if (primitives.has(3)) branches.push([3, 0]);
    if (primitives.has(4)) branches.push([4, 0]);
  }

  return branches.length ? [3, branches] : 0;
};

export let validateMapperType = (type: IntrospectedType, path: string): void => {
  validateTypeProperties(type, path);
  generateDescriptor(type, path, { patterns: false });
};

let dateShorthand = (descriptor: Descriptor): Descriptor => {
  if (!Array.isArray(descriptor)) return descriptor;

  if (descriptor[0] === 1) {
    return [
      1,
      descriptor[1].map((field): Field => {
        let source = typeof field === 'string' ? field : field[0];
        let target = typeof field === 'string' ? 1 : field[1];
        let child = typeof field === 'string' ? 0 : (field[2] ?? 0);

        if (source.endsWith('_at')) {
          if (child === 4) return target === 1 ? source : [source, target];
          if (child === 0) return [source, target, 0];
        }

        return Array.isArray(field) && field.length === 3
          ? [source, target, dateShorthand(child)]
          : field;
      })
    ];
  }

  if (descriptor[0] === 2 || descriptor[0] === 7)
    return [descriptor[0], dateShorthand(descriptor[1])];

  return [3, descriptor[1].map(([kind, child]) => [kind, dateShorthand(child)])];
};

export let generateMapperDescriptor = (
  type: IntrospectedType,
  path: string,
  options: MapperOptions = {}
): Descriptor => {
  validateTypeProperties(type, path);

  let descriptor = generateDescriptor(type, path, options);
  return options.dateDefaults === false ? descriptor : dateShorthand(descriptor);
};

let requiresDateDefaults = (descriptor: Descriptor): boolean => {
  if (!Array.isArray(descriptor)) return false;

  if (descriptor[0] === 1) {
    return descriptor[1].some(field =>
      typeof field === 'string'
        ? field.endsWith('_at')
        : field.length === 2
          ? field[0].endsWith('_at')
          : requiresDateDefaults(field[2])
    );
  }

  if (descriptor[0] === 2 || descriptor[0] === 7) return requiresDateDefaults(descriptor[1]);

  return descriptor[1].some(([, child]) => requiresDateDefaults(child));
};
