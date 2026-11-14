import { Service } from '@lowerdeck/service';
import type { Organization, Project } from '@metorial/db';
import { getTenantForNebula } from '../nebula';

export type Tail<T extends any[]> = T extends [any, ...infer U] ? U : [];

type PaginatorRunQuery = {
  limit?: number;
  after?: string;
  before?: string;
  cursor?: string;
  order?: 'asc' | 'desc';
};

type SecretsRawListResponse<Item = unknown> = {
  items: Item[];
  pagination: {
    has_more_after: boolean;
    has_more_before: boolean;
  };
};

type SecretsListResult<Item = unknown> = {
  run: (query: PaginatorRunQuery) => Promise<{
    items: Item[];
    pagination: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }>;
};

type SecretsListResultFull<Item = unknown> = {
  run: (query: PaginatorRunQuery) => Promise<{
    items: Item[];
    pagination: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }>;

  map: <Item2>(
    mapper: (item: Item[]) => Item2[] | Promise<Item2[]>
  ) => SecretsListResult<Item2>;
};

type SecretsMethodReturn<T> = T extends (...args: any[]) => infer R ? Awaited<R> : never;

type SecretsListItem<SecretsController extends {}, K extends keyof SecretsController> =
  SecretsMethodReturn<SecretsController[K]> extends {
    items: infer Items extends any[];
  }
    ? Items[number]
    : never;

type SecretsMethodArgs<
  SecretsController extends {},
  K extends keyof SecretsController
> = SecretsController[K] extends (...args: any[]) => any
  ? [
      arg0: { organization: Organization; project: Project } & Omit<
        Parameters<SecretsController[K]>[0],
        'tenantId'
      >,
      ...args: Tail<Parameters<SecretsController[K]>>
    ]
  : never;

export type SecretsServiceInner<SecretsController extends {}, Overrides extends {}> = {
  [K in Exclude<keyof SecretsController, keyof Overrides>]: SecretsController[K] extends (
    ...args: any[]
  ) => any
    ? K extends 'list'
      ? (
          ...args: SecretsMethodArgs<SecretsController, K>
        ) => Promise<SecretsListResultFull<SecretsListItem<SecretsController, K>>>
      : (...args: SecretsMethodArgs<SecretsController, K>) => ReturnType<SecretsController[K]>
    : never;
} & Overrides;

export type SecretsService<SecretsController extends {}, Overrides extends {}> = {
  [K in Exclude<keyof SecretsController, keyof Overrides>]: SecretsController[K] extends (
    ...args: any[]
  ) => any
    ? K extends 'list'
      ? (
          ...args: SecretsMethodArgs<SecretsController, K>
        ) => Promise<SecretsListResult<SecretsListItem<SecretsController, K>>>
      : (...args: SecretsMethodArgs<SecretsController, K>) => ReturnType<SecretsController[K]>
    : never;
} & Overrides;

let toSecretsListResponse = <Item>(result: SecretsRawListResponse<Item>) => ({
  items: result.items,
  pagination: {
    hasNextPage: result.pagination.has_more_after,
    hasPreviousPage: result.pagination.has_more_before
  }
});

let createListMethod = <Item>(
  callController: (args: any[]) => Promise<SecretsRawListResponse<Item>>,
  getFirstArg: (args: any[]) => any
) => {
  return async (...args: any[]) => {
    let firstArg = getFirstArg(args);

    let getResult = (query: PaginatorRunQuery) =>
      callController([
        {
          ...firstArg,
          limit: query.limit,
          after: query.after,
          before: query.before,
          cursor: query.cursor,
          order: query.order
        },
        ...args.slice(1)
      ]);

    return {
      async run(query: PaginatorRunQuery) {
        return toSecretsListResponse(await getResult(query));
      },

      map<Item2>(
        mapper: (item: Item[]) => Item2[] | Promise<Item2[]>
      ): SecretsListResult<Item2> {
        return {
          async run(query: PaginatorRunQuery) {
            let result = await getResult(query);
            let mapped = await mapper(result.items);
            return toSecretsListResponse({
              items: mapped,
              pagination: result.pagination
            });
          }
        };
      }
    } as SecretsListResultFull<Item>;
  };
};

let buildServiceMethods = (
  methods: (string | symbol | number)[],
  makeCallController: (methodName: any) => (args: any[]) => Promise<any>,
  getFirstArg: (args: any[]) => any
) => {
  let methodsObj: any = {};

  for (let methodName of methods) {
    if (methodsObj[methodName]) continue;

    let callController = makeCallController(methodName);

    if (methodName === 'list') {
      methodsObj[methodName] = createListMethod(callController, getFirstArg);
    } else {
      methodsObj[methodName] = (...args: any[]) => callController(args);
    }
  }

  return methodsObj;
};

export let createSecretsService = <SecretsController extends {}, Overrides extends {}>(
  controller: SecretsController,
  methods: (keyof SecretsController)[],
  overrides: (secrets: SecretsServiceInner<SecretsController, {}>) => Overrides
) => {
  let methodsObj = buildServiceMethods(
    methods as any[],
    methodName => async (args: any[]) => {
      let firstArg = args[0] as {
        organization: Organization;
        project: Project;
      };

      let { id: tenantId } = await getTenantForNebula(firstArg.project);

      let payload = {
        ...args[0],
        tenantId
      };

      delete (payload as any).organization;
      delete (payload as any).project;

      return (controller as any)[methodName](payload, ...args.slice(1));
    },
    args => args[0]
  );

  let overRideMethods = overrides(methodsObj);

  let methodsTyped = {
    ...methodsObj,
    ...overRideMethods
  } as SecretsService<SecretsController, Overrides>;

  return Service.create('secrets', () => methodsTyped).build();
};
