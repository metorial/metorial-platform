import { Instance } from '@metorial/db';
import { Service } from '@metorial/service';
import { getTenantForSubspace } from '../subspace';

export type Tail<T extends any[]> = T extends [any, ...infer U] ? U : [];

export let createSubspaceService = <SubspaceController extends {}, Overrides extends {}>(
  controller: SubspaceController,
  methods: (keyof SubspaceController)[],
  overrides: Overrides
) => {
  let methodsObj: any = {
    ...overrides
  };

  for (let methodName of methods) {
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

  let methodsTyped = methodsObj as {
    [K in keyof SubspaceController]: SubspaceController[K] extends (...args: any[]) => any
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
