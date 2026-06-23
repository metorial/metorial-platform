import type {
  DashboardInstanceSkillsAgentsCreateBody,
  DashboardInstanceSkillsAgentsGetOutput,
  DashboardInstanceSkillsAgentsListQuery,
  DashboardInstanceSkillsAgentsUpdateBody,
  DashboardInstanceSkillsConfigurationsGetOutput,
  DashboardInstanceSkillsConfigurationsUpdateBody,
  DashboardInstanceSkillsCreateBody,
  DashboardInstanceSkillsDuplicateBody,
  DashboardInstanceSkillsForkBody,
  DashboardInstanceSkillsGetOutput,
  DashboardInstanceSkillsItemsCreateBody,
  DashboardInstanceSkillsItemsGetOutput,
  DashboardInstanceSkillsItemsListQuery,
  DashboardInstanceSkillsListQuery,
  DashboardInstanceSkillsParticipantsGetOutput,
  DashboardInstanceSkillsParticipantsListQuery,
  DashboardInstanceSkillsUpdateBody,
  DashboardInstanceSkillsVersionsGetOutput,
  DashboardInstanceSkillsVersionsListQuery,
  DashboardInstanceSkillsVersionsSnapshotGetOutput
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type Skill = DashboardInstanceSkillsGetOutput;
export type SkillAgent = DashboardInstanceSkillsAgentsGetOutput;
export type SkillConfiguration = DashboardInstanceSkillsConfigurationsGetOutput;
export type SkillItem = DashboardInstanceSkillsItemsGetOutput;
export type SkillParticipant = DashboardInstanceSkillsParticipantsGetOutput;
export type SkillVersion = DashboardInstanceSkillsVersionsGetOutput;
export type SkillVersionSnapshot = DashboardInstanceSkillsVersionsSnapshotGetOutput;

let toArrayIfString = <T extends string>(value: T | T[] | undefined) =>
  typeof value === 'string' ? [value] : value;

let normalizeSkillsListQuery = (
  query: DashboardInstanceSkillsListQuery
): DashboardInstanceSkillsListQuery => ({
  ...query,
  status: toArrayIfString(query.status)
});

let normalizeSkillItemsListQuery = (
  query: DashboardInstanceSkillsItemsListQuery
): DashboardInstanceSkillsItemsListQuery => ({
  ...query,
  status: toArrayIfString(query.status),
  type: toArrayIfString(query.type)
});

export let skillsLoader = createLoader({
  name: 'skills',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceSkillsListQuery) =>
    withAuth(sdk => sdk.skills.list(i.instanceId, normalizeSkillsListQuery(i))),
  mutators: {}
});

export let useCreateSkill = skillsLoader.createExternalMutator(
  (i: DashboardInstanceSkillsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.skills.create(i.instanceId, i))
);

export let useForkSkill = skillsLoader.createExternalMutator(
  (i: DashboardInstanceSkillsForkBody & { instanceId: string; skillId: string }) =>
    withAuth(sdk => sdk.skills.fork(i.instanceId, i.skillId, i))
);

export let useDuplicateSkill = skillsLoader.createExternalMutator(
  (i: DashboardInstanceSkillsDuplicateBody & { instanceId: string; skillId: string }) =>
    withAuth(sdk => sdk.skills.duplicate(i.instanceId, i.skillId, i))
);

export let useSkills = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSkillsListQuery | null
) => {
  return usePaginator(
    pagination =>
      skillsLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    instanceId ? `${instanceId}:${JSON.stringify(query ?? {})}` : null
  );
};

export let skillLoader = createLoader({
  name: 'skill',
  parents: [skillsLoader],
  fetch: (i: { instanceId: string; skillId: string }) =>
    withAuth(sdk => sdk.skills.get(i.instanceId, i.skillId)),
  mutators: {
    update: (
      i: DashboardInstanceSkillsUpdateBody,
      { input: { instanceId, skillId } }: { input: { instanceId: string; skillId: string } }
    ) => withAuth(sdk => sdk.skills.update(instanceId, skillId, i)),

    delete: (
      _: void,
      { input: { instanceId, skillId } }: { input: { instanceId: string; skillId: string } }
    ) => withAuth(sdk => sdk.skills.delete(instanceId, skillId))
  }
});

export let useSkill = (
  instanceId: string | null | undefined,
  skillId: string | null | undefined
) => {
  let data = skillLoader.use(instanceId && skillId ? { instanceId, skillId } : null);

  return {
    ...data,
    updateMutator: data.useMutator('update'),
    deleteMutator: data.useMutator('delete')
  };
};

export let defaultSkillConfigurationLoader = createLoader({
  name: 'defaultSkillConfiguration',
  parents: [],
  fetch: (i: { instanceId: string }) =>
    withAuth(sdk => sdk.skills.configurations.get(i.instanceId, 'default')),
  mutators: {
    update: (
      i: DashboardInstanceSkillsConfigurationsUpdateBody,
      { input: { instanceId } }: { input: { instanceId: string } }
    ) => withAuth(sdk => sdk.skills.configurations.update(instanceId, 'default', i))
  }
});

export let useDefaultSkillConfiguration = (instanceId: string | null | undefined) => {
  let data = defaultSkillConfigurationLoader.use(instanceId ? { instanceId } : null);

  return {
    ...data,
    updateMutator: data.useMutator('update')
  };
};

export let skillAgentsLoader = createLoader({
  name: 'skillAgents',
  parents: [skillLoader],
  fetch: (
    i: { instanceId: string; skillId: string } & DashboardInstanceSkillsAgentsListQuery
  ) => withAuth(sdk => sdk.skills.agents.list(i.instanceId, i.skillId, i)),
  mutators: {}
});

export let useCreateSkillAgent = skillAgentsLoader.createExternalMutator(
  (i: DashboardInstanceSkillsAgentsCreateBody & { instanceId: string; skillId: string }) =>
    withAuth(sdk => sdk.skills.agents.create(i.instanceId, i.skillId, i))
);

export let useUpdateSkillAgent = skillAgentsLoader.createExternalMutator(
  (
    i: DashboardInstanceSkillsAgentsUpdateBody & {
      instanceId: string;
      skillId: string;
      skillAgentId: string;
    }
  ) => withAuth(sdk => sdk.skills.agents.update(i.instanceId, i.skillId, i.skillAgentId, i))
);

export let useDeleteSkillAgent = skillAgentsLoader.createExternalMutator(
  (i: { instanceId: string; skillId: string; skillAgentId: string }) =>
    withAuth(sdk => sdk.skills.agents.delete(i.instanceId, i.skillId, i.skillAgentId))
);

export let useSkillAgents = (
  instanceId: string | null | undefined,
  skillId: string | null | undefined,
  query?: DashboardInstanceSkillsAgentsListQuery | null
) => {
  return usePaginator(
    pagination =>
      skillAgentsLoader.use(
        instanceId && skillId && query !== null
          ? { instanceId, skillId, ...pagination, ...(query ?? {}) }
          : null
      ),
    instanceId && skillId
      ? `${instanceId}:${skillId}:agents:${JSON.stringify(query ?? {})}`
      : null
  );
};

export let skillAgentLoader = createLoader({
  name: 'skillAgent',
  parents: [skillAgentsLoader, skillLoader],
  fetch: (i: { instanceId: string; skillId: string; skillAgentId: string }) =>
    withAuth(sdk => sdk.skills.agents.get(i.instanceId, i.skillId, i.skillAgentId)),
  mutators: {
    update: (
      i: DashboardInstanceSkillsAgentsUpdateBody,
      {
        input: { instanceId, skillId, skillAgentId }
      }: { input: { instanceId: string; skillId: string; skillAgentId: string } }
    ) => withAuth(sdk => sdk.skills.agents.update(instanceId, skillId, skillAgentId, i)),

    delete: (
      _: void,
      {
        input: { instanceId, skillId, skillAgentId }
      }: { input: { instanceId: string; skillId: string; skillAgentId: string } }
    ) => withAuth(sdk => sdk.skills.agents.delete(instanceId, skillId, skillAgentId))
  }
});

export let useSkillAgent = (
  instanceId: string | null | undefined,
  skillId: string | null | undefined,
  skillAgentId: string | null | undefined
) => {
  let data = skillAgentLoader.use(
    instanceId && skillId && skillAgentId ? { instanceId, skillId, skillAgentId } : null
  );

  return {
    ...data,
    updateMutator: data.useMutator('update'),
    deleteMutator: data.useMutator('delete')
  };
};

export let skillItemsLoader = createLoader({
  name: 'skillItems',
  parents: [skillLoader, skillsLoader],
  fetch: (
    i: { instanceId: string; skillId: string } & DashboardInstanceSkillsItemsListQuery
  ) =>
    withAuth(sdk =>
      sdk.skills.items.list(i.instanceId, i.skillId, normalizeSkillItemsListQuery(i))
    ),
  mutators: {}
});

export let useCreateSkillItem = skillItemsLoader.createExternalMutator(
  (i: DashboardInstanceSkillsItemsCreateBody & { instanceId: string; skillId: string }) =>
    withAuth(sdk => sdk.skills.items.create(i.instanceId, i.skillId, i))
);

export let useDeleteSkillItem = skillItemsLoader.createExternalMutator(
  (i: { instanceId: string; skillId: string; skillItemId: string }) =>
    withAuth(sdk => sdk.skills.items.delete(i.instanceId, i.skillId, i.skillItemId))
);

export let useSkillItems = (
  instanceId: string | null | undefined,
  skillId: string | null | undefined,
  query?: DashboardInstanceSkillsItemsListQuery | null
) => {
  return usePaginator(
    pagination =>
      skillItemsLoader.use(
        instanceId && skillId && query !== null
          ? { instanceId, skillId, ...pagination, ...(query ?? {}) }
          : null
      ),
    instanceId && skillId ? `${instanceId}:${skillId}` : null
  );
};

export let allSkillItemsLoader = createLoader({
  name: 'allSkillItems',
  parents: [skillLoader, skillItemsLoader],
  fetch: (
    i: {
      instanceId: string;
      skillId: string;
    } & Omit<DashboardInstanceSkillsItemsListQuery, 'after' | 'before' | 'cursor'>
  ) =>
    withAuth(sdk =>
      autoPaginate(cursor =>
        sdk.skills.items.list(
          i.instanceId,
          i.skillId,
          normalizeSkillItemsListQuery({
            ...i,
            ...cursor,
            limit: i.limit ?? 100,
            order: i.order ?? 'asc'
          })
        )
      )
    ),
  mutators: {}
});

export let useAllSkillItems = (
  instanceId: string | null | undefined,
  skillId: string | null | undefined,
  query?: Omit<DashboardInstanceSkillsItemsListQuery, 'after' | 'before' | 'cursor'> | null
) => {
  return allSkillItemsLoader.use(
    instanceId && skillId && query !== null
      ? {
          instanceId,
          skillId,
          ...(query ?? {})
        }
      : null
  );
};

export let skillItemLoader = createLoader({
  name: 'skillItem',
  parents: [skillItemsLoader, skillLoader],
  fetch: (i: { instanceId: string; skillId: string; skillItemId: string }) =>
    withAuth(sdk => sdk.skills.items.get(i.instanceId, i.skillId, i.skillItemId)),
  mutators: {
    delete: (
      _: void,
      {
        input: { instanceId, skillId, skillItemId }
      }: { input: { instanceId: string; skillId: string; skillItemId: string } }
    ) => withAuth(sdk => sdk.skills.items.delete(instanceId, skillId, skillItemId))
  }
});

export let useSkillItem = (
  instanceId: string | null | undefined,
  skillId: string | null | undefined,
  skillItemId: string | null | undefined
) => {
  let data = skillItemLoader.use(
    instanceId && skillId && skillItemId ? { instanceId, skillId, skillItemId } : null
  );

  return {
    ...data,
    deleteMutator: data.useMutator('delete')
  };
};

export let skillParticipantsLoader = createLoader({
  name: 'skillParticipants',
  parents: [skillLoader],
  fetch: (
    i: {
      instanceId: string;
      skillId: string;
    } & DashboardInstanceSkillsParticipantsListQuery
  ) => withAuth(sdk => sdk.skills.participants.list(i.instanceId, i.skillId, i)),
  mutators: {}
});

export let useSkillParticipants = (
  instanceId: string | null | undefined,
  skillId: string | null | undefined,
  query?: DashboardInstanceSkillsParticipantsListQuery | null
) => {
  return usePaginator(
    pagination =>
      skillParticipantsLoader.use(
        instanceId && skillId && query !== null
          ? { instanceId, skillId, ...pagination, ...(query ?? {}) }
          : null
      ),
    instanceId && skillId ? `${instanceId}:${skillId}:participants` : null
  );
};

export let skillParticipantLoader = createLoader({
  name: 'skillParticipant',
  parents: [skillParticipantsLoader, skillLoader],
  fetch: (i: { instanceId: string; skillId: string; skillParticipantId: string }) =>
    withAuth(sdk =>
      sdk.skills.participants.get(i.instanceId, i.skillId, i.skillParticipantId)
    ),
  mutators: {}
});

export let useSkillParticipant = (
  instanceId: string | null | undefined,
  skillId: string | null | undefined,
  skillParticipantId: string | null | undefined
) => {
  return skillParticipantLoader.use(
    instanceId && skillId && skillParticipantId
      ? { instanceId, skillId, skillParticipantId }
      : null
  );
};

export let skillVersionsLoader = createLoader({
  name: 'skillVersions',
  parents: [skillLoader],
  fetch: (
    i: {
      instanceId: string;
      skillId: string;
    } & DashboardInstanceSkillsVersionsListQuery
  ) => withAuth(sdk => sdk.skills.versions.list(i.instanceId, i.skillId, i)),
  mutators: {}
});

export let useSkillVersions = (
  instanceId: string | null | undefined,
  skillId: string | null | undefined,
  query?: DashboardInstanceSkillsVersionsListQuery | null
) => {
  return usePaginator(
    pagination =>
      skillVersionsLoader.use(
        instanceId && skillId && query !== null
          ? { instanceId, skillId, ...pagination, ...(query ?? {}) }
          : null
      ),
    instanceId && skillId ? `${instanceId}:${skillId}:versions` : null
  );
};

export let skillVersionLoader = createLoader({
  name: 'skillVersion',
  parents: [skillVersionsLoader, skillLoader],
  fetch: (i: { instanceId: string; skillId: string; skillVersionId: string }) =>
    withAuth(sdk => sdk.skills.versions.get(i.instanceId, i.skillId, i.skillVersionId)),
  mutators: {}
});

export let useSkillVersion = (
  instanceId: string | null | undefined,
  skillId: string | null | undefined,
  skillVersionId: string | null | undefined
) => {
  return skillVersionLoader.use(
    instanceId && skillId && skillVersionId ? { instanceId, skillId, skillVersionId } : null
  );
};

export let skillVersionSnapshotLoader = createLoader({
  name: 'skillVersionSnapshot',
  parents: [skillVersionLoader],
  fetch: (i: { instanceId: string; skillId: string; skillVersionId: string }) =>
    withAuth(sdk =>
      sdk.skills.versions.snapshot.get(i.instanceId, i.skillId, i.skillVersionId)
    ),
  mutators: {}
});

export let useSkillVersionSnapshot = (
  instanceId: string | null | undefined,
  skillId: string | null | undefined,
  skillVersionId: string | null | undefined
) => {
  return skillVersionSnapshotLoader.use(
    instanceId && skillId && skillVersionId ? { instanceId, skillId, skillVersionId } : null
  );
};
