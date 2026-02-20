import type { Instance, OrganizationActor } from '@metorial/db';
import type { ProviderEventBase } from '@metorial/fabric';
import { Service } from '@metorial/service';
import { getActorForSubspace, getTenantForSubspace } from '../subspace';

export type Tail<T extends any[]> = T extends [any, ...infer U] ? U : [];

export let toEventBase = (params: Record<string, any>): ProviderEventBase => {
  let { instance, organizationActor, ...input } = params;
  return { instance, organizationActor, input };
};

type SubspaceListResult = {
  run: (query: {
    limit?: number;
    after?: string;
    before?: string;
    cursor?: string;
    order?: 'asc' | 'desc';
  }) => Promise<{
    items: any[];
    pagination: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }>;
};

type SubspaceMethodArgs<SubspaceController extends {}, K extends keyof SubspaceController> =
  SubspaceController[K] extends (...args: any[]) => any
    ? [
        arg0: { instance: Instance } & Omit<
          Parameters<SubspaceController[K]>[0],
          'tenantId' | 'environmentId'
        > &
          (Parameters<SubspaceController[K]>[0] extends { actorId: any }
            ? { organizationActor: OrganizationActor }
            : {}),
        ...args: Tail<Parameters<SubspaceController[K]>>
      ]
    : never;

export type SubspaceService<SubspaceController extends {}, Overrides extends {}> = {
  [K in Exclude<keyof SubspaceController, keyof Overrides>]: SubspaceController[K] extends (
    ...args: any[]
  ) => any
    ? K extends 'list'
      ? (...args: SubspaceMethodArgs<SubspaceController, K>) => Promise<SubspaceListResult>
      : (...args: SubspaceMethodArgs<SubspaceController, K>) => ReturnType<SubspaceController[K]>
    : never;
} & Overrides;

export let createSubspaceService = <SubspaceController extends {}, Overrides extends {}>(
  controller: SubspaceController,
  methods: (keyof SubspaceController)[],
  overrides: (subspace: SubspaceService<SubspaceController, {}>) => Overrides
) => {
  let methodsObj: any = {};

  for (let methodName of methods) {
    if (methodsObj[methodName]) continue;

    let callController = async (args: any[]) => {
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
    };

    if (methodName === 'list') {
      // make Paginator-compatible object with a .run() method
      methodsObj[methodName] = async (...args: any[]) => {
        let firstArg = args[0];
        return {
          async run(query: {
            limit?: number;
            after?: string;
            before?: string;
            cursor?: string;
            order?: 'asc' | 'desc';
          }) {
            let result = await callController([
              {
                ...firstArg,
                limit: query.limit,
                after: query.after,
                before: query.before,
                cursor: query.cursor,
                order: query.order
              }
            ]);
            return {
              items: result.items,
              pagination: {
                hasNextPage: result.pagination.has_more_after,
                hasPreviousPage: result.pagination.has_more_before
              }
            };
          }
        };
      };
    } else {
      methodsObj[methodName] = (...args: any[]) => callController(args);
    }
  }

  let overRideMethods = overrides(methodsObj);

  let methodsTyped = {
    ...methodsObj,
    ...overRideMethods
  } as SubspaceService<SubspaceController, {}>;

  return Service.create('subspace', () => methodsTyped).build();
};
