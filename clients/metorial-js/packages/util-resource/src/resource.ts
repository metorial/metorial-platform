export type MetorialResource<T extends object, N extends string> = { __typename: N } & T;

export type AttributeMappers<T> = {
  [Key in keyof T]: (value: T[Key]) => any;
};

export type MetorialResourceMapped<
  T extends object,
  N extends string,
  M extends AttributeMappers<T>
> = MetorialResource<
  Omit<T, keyof M | '__typename'> & {
    [Key in keyof M]: ReturnType<M[Key]>;
  },
  N
>;

export type AnyObject = Record<string, any>;

export let createMetorialResource =
  <T extends object>() =>
  <N extends string, M extends AttributeMappers<any>>(opts: {
    name: N;
    attributes: { [key: string]: string };
    attributeMappers: M;
  }): MetorialResourceFactory<MetorialResourceMapped<T, N, M>> => {
    let mapper = (input: AnyObject): MetorialResourceMapped<T, N, M> => {
      let output = { __typename: opts.name } as any;

      for (let inputKey in opts.attributes) {
        let outputKey = opts.attributes[inputKey];
        let value = input[inputKey];

        let mapper =
          opts.attributeMappers[inputKey as keyof typeof opts.attributeMappers] ??
          opts.attributeMappers[outputKey as keyof typeof opts.attributeMappers];

        if (mapper && value !== undefined && value !== null) {
          output[outputKey] = mapper(value);
        } else {
          output[outputKey] = value ?? null;
        }
      }

      return output;
    };

    return Object.assign(mapper, {
      transformFrom: mapper
    });
  };

export type MetorialMetadata = Record<string, any>;

interface ResourceListParams {
  items: AnyObject[];
  pagination: {
    afterCursor: string | null;
    beforeCursor: string | null;
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
    pageSize: number;
  };
}

export let createPaginatedMetorialResource =
  <Resource extends MetorialResource<any, any>>(
    resource: MetorialResourceFactory<Resource>
  ): MetorialResourceListFactory<Resource> =>
  (response: ResourceListParams) => ({
    __typename: 'paginated_list',
    items: response.items.map(resource),
    pagination: {
      afterCursor: response.pagination.afterCursor,
      beforeCursor: response.pagination.beforeCursor,
      hasMoreBefore: response.pagination.hasMoreBefore,
      hasMoreAfter: response.pagination.hasMoreAfter,
      pageSize: response.pagination.pageSize
    }
  });

export type MetorialResourceFactory<T extends MetorialResource<any, any>> = ((
  input: AnyObject
) => T) & { name: string; transformFrom: (input: AnyObject) => T };

export type MetorialPaginatedListResource<T extends MetorialResource<any, any>> =
  MetorialResource<
    {
      items: T[];
      pagination: ResourceListParams['pagination'];
    },
    'paginated_list'
  >;

export type MetorialResourceListFactory<T extends MetorialResource<any, any>> = (
  input: ResourceListParams
) => MetorialPaginatedListResource<T>;

export type MetorialAnyResourceFactory<T> =
  | MetorialResourceFactory<T>
  | MetorialResourceListFactory<T>;

export type InferTypeFromMetorialResource<
  T extends MetorialResourceFactory<any> | MetorialResourceListFactory<any>
> =
  T extends MetorialResourceFactory<infer R>
    ? R
    : T extends MetorialResourceListFactory<infer R>
      ? ReturnType<T>
      : never;

export type StringFilter<T = string> = T | { eq: T } | { in: T[] };
export type NumberFilter<T = number> =
  | T
  | { eq: T }
  | { in: T[] }
  | { gt?: T; gte?: T; lt?: T; lte?: T };
export type BooleanFilter<T = boolean> = T | { eq: T };
export type DateFilter<T = Date> = T | { eq: T } | { gt?: T; gte?: T; lt?: T; lte?: T };
