import type {
  DashboardInstanceSkillsCreateOutput,
  DashboardInstanceSkillTemplatesCreateBody,
  DashboardInstanceSkillTemplatesGetOutput,
  DashboardInstanceSkillTemplatesItemsCreateBody,
  DashboardInstanceSkillTemplatesItemsGetOutput,
  DashboardInstanceSkillTemplatesItemsListQuery,
  DashboardInstanceSkillTemplatesListQuery,
  DashboardInstanceSkillTemplatesUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type SkillTemplate = DashboardInstanceSkillTemplatesGetOutput;
export type SkillTemplateItem = DashboardInstanceSkillTemplatesItemsGetOutput;

let toArrayIfString = <T extends string>(value: T | T[] | undefined) =>
  typeof value === 'string' ? [value] : value;

let normalizeSkillTemplatesListQuery = (
  query: DashboardInstanceSkillTemplatesListQuery
): DashboardInstanceSkillTemplatesListQuery => ({
  ...query,
  status: toArrayIfString(query.status),
  owner: toArrayIfString(query.owner)
});

export let skillTemplatesLoader = createLoader({
  name: 'skillTemplates',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceSkillTemplatesListQuery) =>
    withAuth(sdk =>
      sdk.skillTemplates.list(i.instanceId, normalizeSkillTemplatesListQuery(i))
    ),
  mutators: {}
});

export let useCreateSkillTemplate = skillTemplatesLoader.createExternalMutator(
  (i: DashboardInstanceSkillTemplatesCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.skillTemplates.create(i.instanceId, i))
);

export let useCreateSkillFromTemplate = skillTemplatesLoader.createExternalMutator(
  (i: { instanceId: string; skillTemplateId: string; name?: string; description?: string }) =>
    withAuth(async sdk => {
      let skillTemplate = await sdk.skillTemplates.get(i.instanceId, i.skillTemplateId);
      let skill = await sdk.skills.create(i.instanceId, {
        name: i.name ?? skillTemplate.name,
        description: i.description ?? skillTemplate.description ?? undefined,
        metadata: skillTemplate.metadata ?? undefined
      });

      let [skillTemplateItems, storeItems] = await Promise.all([
        autoPaginate(cursor =>
          sdk.skillTemplates.items.list(i.instanceId, i.skillTemplateId, {
            ...cursor,
            limit: 100,
            order: 'asc'
          })
        ),
        autoPaginate(cursor =>
          sdk.stores.items.list(i.instanceId, skillTemplate.storeId, {
            ...cursor,
            limit: 100,
            order: 'asc',
            type: ['directory', 'document', 'file']
          })
        )
      ]);

      await Promise.all(
        skillTemplateItems.map(item =>
          item.type === 'provider' && item.provider
            ? sdk.skills.items.create(i.instanceId, skill.id, {
                type: 'provider',
                providerId: item.provider.id
              })
            : item.type === 'integration' && item.integration
              ? sdk.skills.items.create(i.instanceId, skill.id, {
                  type: 'integration',
                  integrationId: item.integration.id
                })
              : Promise.resolve(null)
        )
      );

      let operations = storeItems
        .map(item => {
          if (!item.path) return null;
          if (item.kind === 'directory') return { type: 'add' as const, path: item.path };
          if (item.kind === 'document' && item.document?.id) {
            return {
              type: 'add' as const,
              path: item.path,
              documentId: item.document.id
            };
          }
          if (item.kind === 'file' && item.file?.id) {
            return { type: 'add' as const, path: item.path, fileId: item.file.id };
          }

          return null;
        })
        .filter((operation): operation is NonNullable<typeof operation> => !!operation);

      if (operations.length > 0) {
        await sdk.stores.items.modify(i.instanceId, skill.storeId, { operations });
      }

      return skill;
    }) as Promise<DashboardInstanceSkillsCreateOutput>
);

export let useSkillTemplates = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSkillTemplatesListQuery | null
) => {
  return usePaginator(
    pagination =>
      skillTemplatesLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    instanceId ? `${instanceId}:${JSON.stringify(query ?? {})}` : null
  );
};

export let skillTemplateLoader = createLoader({
  name: 'skillTemplate',
  parents: [skillTemplatesLoader],
  fetch: (i: { instanceId: string; skillTemplateId: string }) =>
    withAuth(sdk => sdk.skillTemplates.get(i.instanceId, i.skillTemplateId)),
  mutators: {
    update: (
      i: DashboardInstanceSkillTemplatesUpdateBody,
      {
        input: { instanceId, skillTemplateId }
      }: { input: { instanceId: string; skillTemplateId: string } }
    ) => withAuth(sdk => sdk.skillTemplates.update(instanceId, skillTemplateId, i)),

    delete: (
      _: void,
      {
        input: { instanceId, skillTemplateId }
      }: { input: { instanceId: string; skillTemplateId: string } }
    ) => withAuth(sdk => sdk.skillTemplates.delete(instanceId, skillTemplateId))
  }
});

export let useSkillTemplate = (
  instanceId: string | null | undefined,
  skillTemplateId: string | null | undefined
) => {
  let data = skillTemplateLoader.use(
    instanceId && skillTemplateId ? { instanceId, skillTemplateId } : null
  );

  return {
    ...data,
    updateMutator: data.useMutator('update'),
    deleteMutator: data.useMutator('delete')
  };
};

export let skillTemplateItemsLoader = createLoader({
  name: 'skillTemplateItems',
  parents: [skillTemplateLoader, skillTemplatesLoader],
  fetch: (
    i: {
      instanceId: string;
      skillTemplateId: string;
    } & DashboardInstanceSkillTemplatesItemsListQuery
  ) => withAuth(sdk => sdk.skillTemplates.items.list(i.instanceId, i.skillTemplateId, i)),
  mutators: {}
});

export let useCreateSkillTemplateItem = skillTemplateItemsLoader.createExternalMutator(
  (
    i: DashboardInstanceSkillTemplatesItemsCreateBody & {
      instanceId: string;
      skillTemplateId: string;
    }
  ) => withAuth(sdk => sdk.skillTemplates.items.create(i.instanceId, i.skillTemplateId, i))
);

export let useDeleteSkillTemplateItem = skillTemplateItemsLoader.createExternalMutator(
  (i: { instanceId: string; skillTemplateId: string; skillTemplateItemId: string }) =>
    withAuth(sdk =>
      sdk.skillTemplates.items.delete(i.instanceId, i.skillTemplateId, i.skillTemplateItemId)
    )
);

export let useSkillTemplateItems = (
  instanceId: string | null | undefined,
  skillTemplateId: string | null | undefined,
  query?: DashboardInstanceSkillTemplatesItemsListQuery | null
) => {
  return usePaginator(
    pagination =>
      skillTemplateItemsLoader.use(
        instanceId && skillTemplateId && query !== null
          ? { instanceId, skillTemplateId, ...pagination, ...(query ?? {}) }
          : null
      ),
    instanceId && skillTemplateId ? `${instanceId}:${skillTemplateId}` : null
  );
};

export let allSkillTemplateItemsLoader = createLoader({
  name: 'allSkillTemplateItems',
  parents: [skillTemplateLoader, skillTemplateItemsLoader],
  fetch: (
    i: {
      instanceId: string;
      skillTemplateId: string;
    } & Omit<DashboardInstanceSkillTemplatesItemsListQuery, 'after' | 'before' | 'cursor'>
  ) =>
    withAuth(sdk =>
      autoPaginate(cursor =>
        sdk.skillTemplates.items.list(i.instanceId, i.skillTemplateId, {
          ...i,
          ...cursor,
          limit: i.limit ?? 100,
          order: i.order ?? 'asc'
        })
      )
    ),
  mutators: {}
});

export let useAllSkillTemplateItems = (
  instanceId: string | null | undefined,
  skillTemplateId: string | null | undefined,
  query?: Omit<
    DashboardInstanceSkillTemplatesItemsListQuery,
    'after' | 'before' | 'cursor'
  > | null
) => {
  return allSkillTemplateItemsLoader.use(
    instanceId && skillTemplateId && query !== null
      ? {
          instanceId,
          skillTemplateId,
          ...(query ?? {})
        }
      : null
  );
};

export let skillTemplateItemLoader = createLoader({
  name: 'skillTemplateItem',
  parents: [skillTemplateItemsLoader, skillTemplateLoader],
  fetch: (i: { instanceId: string; skillTemplateId: string; skillTemplateItemId: string }) =>
    withAuth(sdk =>
      sdk.skillTemplates.items.get(i.instanceId, i.skillTemplateId, i.skillTemplateItemId)
    ),
  mutators: {
    delete: (
      _: void,
      {
        input: { instanceId, skillTemplateId, skillTemplateItemId }
      }: {
        input: {
          instanceId: string;
          skillTemplateId: string;
          skillTemplateItemId: string;
        };
      }
    ) =>
      withAuth(sdk =>
        sdk.skillTemplates.items.delete(instanceId, skillTemplateId, skillTemplateItemId)
      )
  }
});

export let useSkillTemplateItem = (
  instanceId: string | null | undefined,
  skillTemplateId: string | null | undefined,
  skillTemplateItemId: string | null | undefined
) => {
  let data = skillTemplateItemLoader.use(
    instanceId && skillTemplateId && skillTemplateItemId
      ? { instanceId, skillTemplateId, skillTemplateItemId }
      : null
  );

  return {
    ...data,
    deleteMutator: data.useMutator('delete')
  };
};
