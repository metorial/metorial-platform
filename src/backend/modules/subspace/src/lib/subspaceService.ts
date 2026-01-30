import { Instance } from '@metorial/db';
import { Service } from '@metorial/service';
import { getTenantForSubspace } from '../subspace';

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

    if (methodName === 'list') {
      // metorial API expects to call paginator.run(paginationInput)
      methodsObj[methodName] = async (...args: any[]) => {
        let tenant = await getTenantForSubspace(args[0].instance);
        let baseInput = {
          ...args[0],
          tenantId: tenant.id
        };

        return {
          async run(paginationInput: any) {
            let result = await (controller as any)[methodName]({
              ...baseInput,
              ...paginationInput
            });

            // Convert to PaginatedList format expected by metorial Paginator
            return {
              items: result.items || [],
              pagination: {
                hasNextPage: result.pagination?.has_more_after ?? false,
                hasPreviousPage: result.pagination?.has_more_before ?? false
              }
            };
          }
        };
      };
    } else {
      methodsObj[methodName] = async (...args: any[]) => {
        let tenant = await getTenantForSubspace(args[0].instance);

        return (controller as any)[methodName](
          {
            ...args[0],
            tenantId: tenant.id
          },
          ...args.slice(1)
        );
      };
    }
  }

  let methodsTyped = methodsObj as {
    [K in Exclude<keyof SubspaceController, keyof Overrides>]: SubspaceController[K] extends (
      ...args: any[]
    ) => any
      ? (
          arg0: { instance: Instance } & Omit<
            Parameters<SubspaceController[K]>[0],
            'tenantId'
          >,
          ...args: Tail<Parameters<SubspaceController[K]>>
        ) => ReturnType<SubspaceController[K]>
      : never;
  } & Overrides;

  return Service.create('subspace', () => methodsTyped).build();
};
