import type {
  DashboardInstanceSkillsTemplatesCreateBody,
  DashboardInstanceSkillsTemplatesGetOutput,
  DashboardInstanceSkillsTemplatesItemsCreateBody,
  DashboardInstanceSkillsTemplatesItemsGetOutput,
  DashboardInstanceSkillsTemplatesItemsListQuery,
  DashboardInstanceSkillsTemplatesListQuery,
  DashboardInstanceSkillsTemplatesUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type SkillTemplate = DashboardInstanceSkillsTemplatesGetOutput;
export type SkillTemplateItem = DashboardInstanceSkillsTemplatesItemsGetOutput;

let toArrayIfString = <T extends string>(value: T | T[] | undefined) =>
  typeof value === 'string' ? [value] : value;

let normalizeSkillTemplatesListQuery = (
  query: DashboardInstanceSkillsTemplatesListQuery
): DashboardInstanceSkillsTemplatesListQuery => ({
  ...query,
  status: toArrayIfString(query.status),
  owner: toArrayIfString(query.owner)
});

export let skillTemplatesLoader = createLoader({
  name: 'skillTemplates',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceSkillsTemplatesListQuery) =>
    withAuth(sdk =>
      sdk.skillTemplates.list(i.instanceId, normalizeSkillTemplatesListQuery(i))
    ),
  mutators: {}
});

export let useCreateSkillTemplate = skillTemplatesLoader.createExternalMutator(
  (i: DashboardInstanceSkillsTemplatesCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.skillTemplates.create(i.instanceId, i))
);

export let useSkillTemplates = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSkillsTemplatesListQuery | null
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
      i: DashboardInstanceSkillsTemplatesUpdateBody,
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
    } & DashboardInstanceSkillsTemplatesItemsListQuery
  ) => withAuth(sdk => sdk.skillTemplates.items.list(i.instanceId, i.skillTemplateId, i)),
  mutators: {}
});

export let useCreateSkillTemplateItem = skillTemplateItemsLoader.createExternalMutator(
  (
    i: DashboardInstanceSkillsTemplatesItemsCreateBody & {
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
  query?: DashboardInstanceSkillsTemplatesItemsListQuery | null
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
    } & Omit<DashboardInstanceSkillsTemplatesItemsListQuery, 'after' | 'before' | 'cursor'>
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
    DashboardInstanceSkillsTemplatesItemsListQuery,
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
