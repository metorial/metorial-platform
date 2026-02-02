import type { Instance, Organization, OrganizationActor } from '@metorial/db';
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

    methodsObj[methodName] = async (...args: any[]) => {
      let firstArg = args[0] as {
        instance: Instance;
        organization: Organization;
        organizationActor?: OrganizationActor;
      };

      let { tenant, environment } = await getTenantForSubspace(
        firstArg.organization,
        firstArg.instance
      );

      let actor = await (firstArg.organizationActor
        ? getActorForSubspace(tenant, firstArg.organizationActor)
        : undefined);

      return (controller as any)[methodName](
        {
          ...args[0],

          actorId: actor?.id,
          tenantId: tenant.id,
          environmentId: environment.id
        },
        ...args.slice(1)
      );
    };
  }

  let methodsTyped = methodsObj as {
    [K in Exclude<keyof SubspaceController, keyof Overrides>]: SubspaceController[K] extends (
      ...args: any[]
    ) => any
      ? (
          arg0: { instance: Instance; organization: Organization } & Omit<
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
