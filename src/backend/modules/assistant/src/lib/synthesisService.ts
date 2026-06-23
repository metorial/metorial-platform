import { Service } from '@lowerdeck/service';
import { type Consumer, type Instance, type OrganizationActor } from '@metorial/db';
import {
  ensureSynthesisActor,
  ensureSynthesisScope,
  getAssistantActorInput,
  type AssistantActorInput,
  type SynthesisScope
} from '../synthesis';

export type Tail<T extends any[]> = T extends [any, ...infer U] ? U : [];

export type PaginatorRunQuery = {
  limit?: number;
  after?: string;
  before?: string;
  cursor?: string;
  order?: 'asc' | 'desc';
};

type SynthesisRawListResponse<Item = unknown> = {
  items: Item[];
  pagination: {
    has_more_after: boolean;
    has_more_before: boolean;
  };
};

export type SynthesisCallContext = {
  scope: SynthesisScope;
  actorId?: string;
};

type SynthesisListResult<Item = unknown> = {
  run: (query: PaginatorRunQuery) => Promise<{
    items: Item[];
    pagination: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }>;
};

type SynthesisListResultFull<Item = unknown> = SynthesisListResult<Item> & {
  map: <Item2>(
    mapper: (items: Item[]) => Item2[] | Promise<Item2[]>
  ) => SynthesisListResult<Item2>;

  mapWithContext: <Item2>(
    mapper: (items: Item[], context: SynthesisCallContext) => Item2[] | Promise<Item2[]>
  ) => SynthesisListResult<Item2>;
};

type SynthesisMethodReturn<T> = T extends (...args: any[]) => infer R ? Awaited<R> : never;

type SynthesisListItem<SynthesisController extends {}, K extends keyof SynthesisController> =
  SynthesisMethodReturn<SynthesisController[K]> extends {
    items: infer Items extends any[];
  }
    ? Items[number]
    : never;

type RequiredActorInput =
  | { actor: OrganizationActor; consumer?: undefined; actorId?: undefined }
  | { actor?: undefined; consumer: Consumer; actorId?: undefined }
  | { actor?: undefined; consumer?: undefined; actorId: string };

type OptionalActorInput =
  | { actor?: OrganizationActor; consumer?: undefined; actorId?: undefined }
  | { actor?: undefined; consumer?: Consumer; actorId?: undefined }
  | { actor?: undefined; consumer?: undefined; actorId?: string };

type SynthesisMethodArgs<
  SynthesisController extends {},
  K extends keyof SynthesisController
> = SynthesisController[K] extends (...args: any[]) => any
  ? [
      arg0: { instance: Instance } & Omit<
        Parameters<SynthesisController[K]>[0],
        'tenantId' | 'environmentId' | 'actorId'
      > &
        (Parameters<SynthesisController[K]>[0] extends { actorId: string }
          ? RequiredActorInput
          : {}) &
        (Parameters<SynthesisController[K]>[0] extends { actorId?: string | undefined | never }
          ? OptionalActorInput
          : {}),
      ...args: Tail<Parameters<SynthesisController[K]>>
    ]
  : never;

type OptionalTenantEnvironment<T> = T extends object
  ? Omit<T, 'tenantId' | 'environmentId'> & {
      tenantId?: string;
      environmentId?: string;
    }
  : T;

type SynthesisPublicMethodArgs<
  SynthesisController extends {},
  K extends keyof SynthesisController
> = SynthesisController[K] extends (...args: any[]) => any
  ? Parameters<SynthesisController[K]> extends [infer Arg0, ...infer Rest]
    ? [arg0: OptionalTenantEnvironment<Arg0>, ...args: Rest]
    : Parameters<SynthesisController[K]>
  : never;

export type SynthesisServiceHelpers = {
  getContext: (
    input: {
      instance: Instance;
      actor?: OrganizationActor;
      consumer?: Consumer;
      actorId?: string;
    },
    options?: SynthesisServiceOptions
  ) => Promise<SynthesisCallContext>;
};

export type SynthesisServiceInner<SynthesisController extends {}, Overrides extends {}> = {
  [K in Exclude<keyof SynthesisController, keyof Overrides>]: SynthesisController[K] extends (
    ...args: any[]
  ) => any
    ? K extends 'list'
      ? (
          ...args: SynthesisMethodArgs<SynthesisController, K>
        ) => Promise<SynthesisListResultFull<SynthesisListItem<SynthesisController, K>>>
      : (
          ...args: SynthesisMethodArgs<SynthesisController, K>
        ) => ReturnType<SynthesisController[K]>
    : never;
} & Overrides;

export type SynthesisService<SynthesisController extends {}, Overrides extends {}> = {
  [K in Exclude<keyof SynthesisController, keyof Overrides>]: SynthesisController[K] extends (
    ...args: any[]
  ) => any
    ? K extends 'list'
      ? (
          ...args: SynthesisMethodArgs<SynthesisController, K>
        ) => Promise<SynthesisListResult<SynthesisListItem<SynthesisController, K>>>
      : (
          ...args: SynthesisMethodArgs<SynthesisController, K>
        ) => ReturnType<SynthesisController[K]>
    : never;
} & Overrides;

export type SynthesisPublicService<SynthesisController extends {}, Overrides extends {}> = {
  [K in Exclude<keyof SynthesisController, keyof Overrides>]: SynthesisController[K] extends (
    ...args: any[]
  ) => any
    ? K extends 'list'
      ? (
          ...args: SynthesisPublicMethodArgs<SynthesisController, K>
        ) => Promise<SynthesisListResult<SynthesisListItem<SynthesisController, K>>>
      : (
          ...args: SynthesisPublicMethodArgs<SynthesisController, K>
        ) => ReturnType<SynthesisController[K]>
    : never;
} & Overrides;

export type SynthesisServiceOptions = {
  includeEnvironment?: boolean;
  includeActor?: boolean;
};

let toSynthesisListResponse = <Item>(result: SynthesisRawListResponse<Item>) => ({
  items: result.items,
  pagination: {
    hasNextPage: result.pagination.has_more_after,
    hasPreviousPage: result.pagination.has_more_before
  }
});

export let getSynthesisServiceContext = async (
  input: {
    instance: Instance;
    actor?: OrganizationActor;
    consumer?: Consumer;
    actorId?: string;
  },
  options: SynthesisServiceOptions = {}
): Promise<SynthesisCallContext> => {
  let scope = await ensureSynthesisScope({
    instance: input.instance
  });

  let actorId = input.actorId;
  if (options.includeActor !== false && !actorId && (input.actor || input.consumer)) {
    let actor = await ensureSynthesisActor({
      scope,
      ...getAssistantActorInput(input as AssistantActorInput)
    });
    actorId = actor.id;
  }

  return {
    scope,
    actorId
  };
};

export let getSynthesisServicePayload = async (
  input: Record<string, any>,
  options: SynthesisServiceOptions = {}
) => {
  let context = await getSynthesisServiceContext(input as any, options);
  let payload: Record<string, any> = {
    ...input,
    tenantId: context.scope.tenantId,
    environmentId:
      options.includeEnvironment === false ? undefined : context.scope.environmentId,
    actorId: options.includeActor === false ? undefined : context.actorId
  };

  delete payload.actor;
  delete payload.consumer;
  delete payload.instance;
  delete payload.organization;

  if (options.includeEnvironment === false) {
    delete payload.environmentId;
  }

  if (options.includeActor === false) {
    delete payload.actorId;
  }

  return {
    context,
    payload
  };
};

let createListMethod = <Item>(
  callController: (args: any[]) => Promise<{
    context: SynthesisCallContext;
    result: SynthesisRawListResponse<Item>;
  }>,
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
        let { result } = await getResult(query);
        return toSynthesisListResponse(result);
      },

      map<Item2>(
        mapper: (items: Item[]) => Item2[] | Promise<Item2[]>
      ): SynthesisListResult<Item2> {
        return {
          async run(query: PaginatorRunQuery) {
            let { result } = await getResult(query);
            let mapped = await mapper(result.items);
            return toSynthesisListResponse({
              items: mapped,
              pagination: result.pagination
            });
          }
        };
      },

      mapWithContext<Item2>(
        mapper: (items: Item[], context: SynthesisCallContext) => Item2[] | Promise<Item2[]>
      ): SynthesisListResult<Item2> {
        return {
          async run(query: PaginatorRunQuery) {
            let { context, result } = await getResult(query);
            let mapped = await mapper(result.items, context);
            return toSynthesisListResponse({
              items: mapped,
              pagination: result.pagination
            });
          }
        };
      }
    } as SynthesisListResultFull<Item>;
  };
};

let buildServiceMethods = (
  methods: (string | symbol | number)[],
  makeCallController: (
    methodName: any
  ) => (args: any[]) => Promise<{ context?: SynthesisCallContext; result: any }>,
  getFirstArg: (args: any[]) => any
) => {
  let methodsObj: any = {};

  for (let methodName of methods) {
    if (methodsObj[methodName]) continue;

    let callController = makeCallController(methodName);

    if (methodName === 'list') {
      methodsObj[methodName] = createListMethod(callController as any, getFirstArg);
    } else {
      methodsObj[methodName] = async (...args: any[]) => {
        let { result } = await callController(args);
        return result;
      };
    }
  }

  return methodsObj;
};

export let createSynthesisService = <SynthesisController extends {}, Overrides extends {}>(
  serviceName: string,
  controller: SynthesisController,
  methods: (keyof SynthesisController)[],
  overrides: (
    synthesis: SynthesisServiceInner<SynthesisController, {}> & SynthesisServiceHelpers
  ) => Overrides,
  options: SynthesisServiceOptions = {}
) => {
  let methodsObj = buildServiceMethods(
    methods as any[],
    methodName => async (args: any[]) => {
      let { context, payload } = await getSynthesisServicePayload(args[0], options);

      return {
        context,
        result: await (controller as any)[methodName](payload, ...args.slice(1))
      };
    },
    args => args[0]
  );

  let helperMethods: SynthesisServiceHelpers = {
    getContext: getSynthesisServiceContext
  };

  let overRideMethods = overrides({
    ...methodsObj,
    ...helperMethods
  });

  let methodsTyped = {
    ...methodsObj,
    ...overRideMethods
  } as SynthesisService<SynthesisController, Overrides>;

  return Service.create(serviceName, () => methodsTyped).build();
};

export let createSynthesisPublicService = <
  SynthesisController extends {},
  Overrides extends {}
>(
  serviceName: string,
  controller: SynthesisController,
  methods: (keyof SynthesisController)[],
  overrides: (synthesis: SynthesisPublicService<SynthesisController, {}>) => Overrides
) => {
  let methodsObj = buildServiceMethods(
    methods as any[],
    methodName => async (args: any[]) => ({
      result: await (controller as any)[methodName](...args)
    }),
    args => args[0] ?? {}
  );

  let overRideMethods = overrides(methodsObj);

  let methodsTyped = {
    ...methodsObj,
    ...overRideMethods
  } as SynthesisPublicService<SynthesisController, Overrides>;

  return Service.create(serviceName, () => methodsTyped).build();
};
