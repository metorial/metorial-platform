import { Service } from '@lowerdeck/service';
import type { Instance, OrganizationActor } from '@metorial/db';
import type { ProviderEventBase } from '@metorial/fabric';
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

type SubspaceRawListResponse = {
  items: any[];
  pagination: {
    has_more_after: boolean;
    has_more_before: boolean;
  };
};

type SubspaceListResult = {
  run: (query: PaginatorRunQuery) => Promise<{
    items: any[];
    pagination: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }>;
};

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
          ? { organizationActor: OrganizationActor }
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

export type SubspaceService<SubspaceController extends {}, Overrides extends {}> = {
  [K in Exclude<keyof SubspaceController, keyof Overrides>]: SubspaceController[K] extends (
    ...args: any[]
  ) => any
    ? K extends 'list'
      ? (...args: SubspaceMethodArgs<SubspaceController, K>) => Promise<SubspaceListResult>
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
        ) => Promise<SubspaceListResult>
      : (
          ...args: SubspacePublicMethodArgs<SubspaceController, K>
        ) => ReturnType<SubspaceController[K]>
    : never;
} & Overrides;

let toSubspaceListResponse = (result: SubspaceRawListResponse) => ({
  items: result.items,
  pagination: {
    hasNextPage: result.pagination.has_more_after,
    hasPreviousPage: result.pagination.has_more_before
  }
});

let createListMethod = (
  callController: (args: any[]) => Promise<SubspaceRawListResponse>,
  getFirstArg: (args: any[]) => any
) => {
  return async (...args: any[]) => {
    let firstArg = getFirstArg(args);

    return {
      async run(query: PaginatorRunQuery) {
        let result = await callController([
          {
            ...firstArg,
            ...query
          }
        ]);

        return toSubspaceListResponse(result);
      }
    };
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
  overrides: (subspace: SubspaceService<SubspaceController, {}>) => Overrides
) => {
  let methodsObj = buildServiceMethods(
    methods as any[],
    methodName => async (args: any[]) => {
      let firstArg = args[0] as {
        instance: Instance;
        organizationActor?: OrganizationActor;
      };

      let { tenant, environmentId } = await getTenantForSubspace(firstArg.instance);

      let actor = await (firstArg.organizationActor
        ? getActorForSubspace(tenant, firstArg.organizationActor)
        : undefined);

      let payload = {
        ...args[0],
        actorId: actor?.id,
        tenantId: tenant.id,
        environmentId
      };
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
