import { Service } from '@lowerdeck/service';
import { Consumer, type Instance, type OrganizationActor } from '@metorial/db';
import type { ProviderEventBase } from '@metorial/fabric';
import { ensureSubspaceConsumerActor } from '@metorial/internal-clients';
import { getActorForSubspace, getTenantForSubspace } from '../subspace';

export type Tail<T extends any[]> = T extends [any, ...infer U] ? U : [];

export let toEventBase = (params: Record<string, any>): ProviderEventBase => {
  let { instance, organizationActor, ...input } = params;
  return { instance, organizationActor, input };
};

type PaginatorRunQuery = {
  limit?: number;
  after?: string;
  before?: string;
  cursor?: string;
  order?: 'asc' | 'desc';
};

type SubspaceRawListResponse<Item = unknown> = {
  items: Item[];
  pagination: {
    has_more_after: boolean;
    has_more_before: boolean;
  };
};

type SubspaceListResult<Item = unknown> = {
  run: (query: PaginatorRunQuery) => Promise<{
    items: Item[];
    pagination: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }>;
};

type SubspaceListResultFull<Item = unknown> = {
  run: (query: PaginatorRunQuery) => Promise<{
    items: Item[];
    pagination: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }>;

  map: <Item2>(
    mapper: (item: Item[]) => Item2[] | Promise<Item2[]>
  ) => SubspaceListResult<Item2>;
};

type SubspaceMethodReturn<T> = T extends (...args: any[]) => infer R ? Awaited<R> : never;

type SubspaceListItem<SubspaceController extends {}, K extends keyof SubspaceController> =
  SubspaceMethodReturn<SubspaceController[K]> extends {
    items: infer Items extends any[];
  }
    ? Items[number]
    : never;

type SubspaceMethodArgs<
  SubspaceController extends {},
  K extends keyof SubspaceController
> = SubspaceController[K] extends (...args: any[]) => any
  ? [
      arg0: { instance: Instance } & Omit<
        Parameters<SubspaceController[K]>[0],
        'tenantId' | 'environmentId' | 'actorId'
      > &
        (Parameters<SubspaceController[K]>[0] extends { actorId: any }
          ?
              | { organizationActor: OrganizationActor }
              | { consumer: Consumer }
              | { actorId: string }
          : {}),
      ...args: Tail<Parameters<SubspaceController[K]>>
    ]
  : never;

type OptionalTenantEnvironment<T> = T extends object
  ? Omit<T, 'tenantId' | 'environmentId'> & {
      tenantId?: string;
      environmentId?: string;
    }
  : T;

type SubspacePublicMethodArgs<
  SubspaceController extends {},
  K extends keyof SubspaceController
> = SubspaceController[K] extends (...args: any[]) => any
  ? Parameters<SubspaceController[K]> extends [infer Arg0, ...infer Rest]
    ? [arg0: OptionalTenantEnvironment<Arg0>, ...args: Rest]
    : Parameters<SubspaceController[K]>
  : never;

export type SubspaceServiceInner<SubspaceController extends {}, Overrides extends {}> = {
  [K in Exclude<keyof SubspaceController, keyof Overrides>]: SubspaceController[K] extends (
    ...args: any[]
  ) => any
    ? K extends 'list'
      ? (
          ...args: SubspaceMethodArgs<SubspaceController, K>
        ) => Promise<SubspaceListResultFull<SubspaceListItem<SubspaceController, K>>>
      : (
          ...args: SubspaceMethodArgs<SubspaceController, K>
        ) => ReturnType<SubspaceController[K]>
    : never;
} & Overrides;

export type SubspaceService<SubspaceController extends {}, Overrides extends {}> = {
  [K in Exclude<keyof SubspaceController, keyof Overrides>]: SubspaceController[K] extends (
    ...args: any[]
  ) => any
    ? K extends 'list'
      ? (
          ...args: SubspaceMethodArgs<SubspaceController, K>
        ) => Promise<SubspaceListResult<SubspaceListItem<SubspaceController, K>>>
      : (
          ...args: SubspaceMethodArgs<SubspaceController, K>
        ) => ReturnType<SubspaceController[K]>
    : never;
} & Overrides;

export type SubspacePublicService<SubspaceController extends {}, Overrides extends {}> = {
  [K in Exclude<keyof SubspaceController, keyof Overrides>]: SubspaceController[K] extends (
    ...args: any[]
  ) => any
    ? K extends 'list'
      ? (
          ...args: SubspacePublicMethodArgs<SubspaceController, K>
        ) => Promise<SubspaceListResult<SubspaceListItem<SubspaceController, K>>>
      : (
          ...args: SubspacePublicMethodArgs<SubspaceController, K>
        ) => ReturnType<SubspaceController[K]>
    : never;
} & Overrides;

let toSubspaceListResponse = <Item>(result: SubspaceRawListResponse<Item>) => ({
  items: result.items,
  pagination: {
    hasNextPage: result.pagination.has_more_after,
    hasPreviousPage: result.pagination.has_more_before
  }
});

let createListMethod = <Item>(
  callController: (args: any[]) => Promise<SubspaceRawListResponse<Item>>,
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
        return toSubspaceListResponse(await getResult(query));
      },

      map<Item2>(
        mapper: (item: Item[]) => Item2[] | Promise<Item2[]>
      ): SubspaceListResult<Item2> {
        return {
          async run(query: PaginatorRunQuery) {
            let result = await getResult(query);
            let mapped = await mapper(result.items);
            return toSubspaceListResponse({
              items: mapped,
              pagination: result.pagination
            });
          }
        };
      }
    } as SubspaceListResultFull<Item>;
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

export let createSubspaceService = <SubspaceController extends {}, Overrides extends {}>(
  controller: SubspaceController,
  methods: (keyof SubspaceController)[],
  overrides: (subspace: SubspaceServiceInner<SubspaceController, {}>) => Overrides
) => {
  let methodsObj = buildServiceMethods(
    methods as any[],
    methodName => async (args: any[]) => {
      let firstArg = args[0] as {
        instance: Instance;
        organizationActor?: OrganizationActor;
        consumer?: Consumer;
        actorId?: string;
      };

      let { tenant, environmentId } = await getTenantForSubspace(firstArg.instance);

      let actorId = firstArg.actorId;
      if (!actorId && firstArg.organizationActor) {
        let actor = await getActorForSubspace(tenant, firstArg.organizationActor);
        actorId = actor?.id;
      } else if (!actorId && firstArg.consumer) {
        let actor = await ensureSubspaceConsumerActor(tenant.id, firstArg.consumer);
        actorId = actor?.id;
      }

      let payload = {
        ...args[0],
        actorId,
        tenantId: tenant.id,
        environmentId
      };

      delete (payload as any).organizationActor;
      delete (payload as any).instance;
      delete (payload as any).organization;

      return (controller as any)[methodName](payload, ...args.slice(1));
    },
    args => args[0]
  );

  let overRideMethods = overrides(methodsObj);

  let methodsTyped = {
    ...methodsObj,
    ...overRideMethods
  } as SubspaceService<SubspaceController, Overrides>;

  return Service.create('subspace', () => methodsTyped).build();
};

export let createSubspacePublicService = <SubspaceController extends {}, Overrides extends {}>(
  controller: SubspaceController,
  methods: (keyof SubspaceController)[],
  overrides: (subspace: SubspacePublicService<SubspaceController, {}>) => Overrides
) => {
  let methodsObj = buildServiceMethods(
    methods as any[],
    methodName => async (args: any[]) => (controller as any)[methodName](...args),
    args => args[0] ?? {}
  );

  let overRideMethods = overrides(methodsObj);

  let methodsTyped = {
    ...methodsObj,
    ...overRideMethods
  } as SubspacePublicService<SubspaceController, Overrides>;

  return Service.create('subspacePublic', () => methodsTyped).build();
};
