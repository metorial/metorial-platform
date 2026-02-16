import type { Instance, OrganizationActor } from '@metorial/db';
import { Service } from '@metorial/service';
import { getActorForSubspace, getTenantForSubspace } from '../subspace';

export type Tail<T extends any[]> = T extends [any, ...infer U] ? U : [];

export let createSubspaceService = <SubspaceController extends {}, Overrides extends {}>(
  controller: SubspaceController,
  methods: (keyof SubspaceController)[],
  overrides: (subspace: SubspaceController) => Overrides
) => {
  let methodsObj: any = {
    ...overrides(controller)
  };

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

  let methodsTyped = methodsObj as {
    [K in Exclude<keyof SubspaceController, keyof Overrides>]: SubspaceController[K] extends (
      ...args: any[]
    ) => any
      ? (
          arg0: { instance: Instance } & Omit<
            Parameters<SubspaceController[K]>[0],
            'tenantId' | 'environmentId'
          > &
            (Parameters<SubspaceController[K]>[0] extends { actorId: any }
              ? { organizationActor: OrganizationActor }
              : {}),
          ...args: Tail<Parameters<SubspaceController[K]>>
        ) => ReturnType<SubspaceController[K]>
      : never;
  } & Overrides;

  return Service.create('subspace', () => methodsTyped).build();
};
