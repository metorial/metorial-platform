import type { IntrospectedType } from '../../fetch';
import type { Descriptor, Field, MapperOptions, PatternId } from './descriptor';

let dateFilterFields: Field[] = [
  ['gt', 0, 4],
  ['lt', 0, 4]
];

let paginationFields: Field[] = ['has_more_before', 'has_more_after'];

let timestampFields: Field[] = [
  ['created_at', 1, 4],
  ['updated_at', 1, 4]
];

export interface MapperPattern {
  id: PatternId;
  name: string;
  priority: number;
  match: (type: IntrospectedType, fields: Field[]) => boolean;
  encode: (fields: Field[]) => Descriptor;
  expand: (descriptor: Descriptor) => Descriptor;
}

let fieldName = (field: Field) => (typeof field === 'string' ? field : field[0]);

let fieldValue = (fields: Field[], name: string) =>
  fields.find(field => fieldName(field) === name);

let sameNameValue = (fields: Field[], name: string): Descriptor | undefined => {
  let field = fieldValue(fields, name);
  return Array.isArray(field) && field[1] === 0 ? (field[2] ?? 0) : undefined;
};

let property = (type: IntrospectedType, name: string) =>
  type.properties?.[name] ??
  (name === 'created_at'
    ? type.properties?.createdAt
    : name === 'updated_at'
      ? type.properties?.updatedAt
      : undefined);

export let mapperPatterns: readonly MapperPattern[] = [
  {
    id: 5,
    name: 'date-filter',
    priority: 10,
    match: (type, fields) =>
      fields.length === 2 &&
      ['gt', 'lt'].every(
        name => property(type, name)?.type === 'date' && sameNameValue(fields, name) === 4
      ),
    encode: () => 5,
    expand: () => [1, dateFilterFields]
  },
  {
    id: 6,
    name: 'pagination',
    priority: 20,
    match: (type, fields) =>
      fields.length === 2 &&
      paginationFields.every(
        name =>
          typeof name === 'string' &&
          property(type, name)?.type === 'boolean' &&
          fields.includes(name)
      ),
    encode: () => 6,
    expand: () => [1, paginationFields]
  },
  {
    id: 8,
    name: 'timestamps',
    priority: 30,
    match: (type, fields) =>
      fields.length === 2 &&
      ['created_at', 'updated_at'].every(name => {
        let field = fieldValue(fields, name);
        return (
          property(type, name)?.type === 'date' &&
          Array.isArray(field) &&
          field[1] === 1 &&
          field[2] === 4
        );
      }),
    encode: () => 8,
    expand: () => [1, timestampFields]
  },
  {
    id: 7,
    name: 'paginated-list',
    priority: 40,
    match: (type, fields) => {
      if (
        property(type, 'items')?.type !== 'array' ||
        fields.some(field => !['items', 'pagination'].includes(fieldName(field)))
      )
        return false;

      let pagination = sameNameValue(fields, 'pagination');
      let paginationType = property(type, 'pagination');
      let paginationMatches =
        pagination === 6 ||
        (Array.isArray(pagination) &&
          pagination[0] === 1 &&
          paginationType !== undefined &&
          mapperPatterns
            .find(pattern => pattern.id === 6)!
            .match(paginationType, pagination[1]));
      let items = sameNameValue(fields, 'items');

      return (
        paginationMatches && (items === undefined || (Array.isArray(items) && items[0] === 2))
      );
    },
    encode: fields => {
      let items = sameNameValue(fields, 'items');
      return [7, Array.isArray(items) && items[0] === 2 ? items[1] : 0];
    },
    expand: descriptor => {
      if (!Array.isArray(descriptor) || descriptor[0] !== 7)
        throw new Error('Expected paginated-list descriptor.');

      return [
        1,
        [
          ['items', 0, [2, descriptor[1]]],
          ['pagination', 0, [1, paginationFields]]
        ]
      ];
    }
  }
];

export let matchPattern = (
  type: IntrospectedType,
  descriptor: Descriptor,
  options: MapperOptions
): Descriptor => {
  if (options.patterns === false || !Array.isArray(descriptor) || descriptor[0] !== 1)
    return descriptor;

  let candidates = mapperPatterns.filter(
    pattern => !Array.isArray(options.patterns) || options.patterns.includes(pattern.id)
  );

  for (let pattern of [...candidates].sort((a, b) => a.priority - b.priority)) {
    if (!pattern.match(type, descriptor[1])) continue;

    options.onPattern?.(pattern.id);
    return pattern.encode(descriptor[1]);
  }

  return descriptor;
};

export let expandPatterns = (descriptor: Descriptor): Descriptor => {
  if (
    descriptor === 5 ||
    descriptor === 6 ||
    descriptor === 8 ||
    (Array.isArray(descriptor) && descriptor[0] === 7)
  ) {
    let id = typeof descriptor === 'number' ? descriptor : descriptor[0];
    return expandPatterns(
      mapperPatterns.find(pattern => pattern.id === id)!.expand(descriptor)
    );
  }

  if (!Array.isArray(descriptor)) return descriptor;
  if (descriptor[0] === 1)
    return [
      1,
      descriptor[1].map(field =>
        Array.isArray(field) && field.length === 3
          ? [field[0], field[1], expandPatterns(field[2])]
          : field
      )
    ];
  if (descriptor[0] === 2) return [2, expandPatterns(descriptor[1])];

  return [3, descriptor[1].map(([kind, child]) => [kind, expandPatterns(child)])];
};
