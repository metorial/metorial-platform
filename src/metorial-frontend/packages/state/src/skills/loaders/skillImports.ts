import type {
  DashboardInstanceSkillsImportsCreateBody,
  DashboardInstanceSkillsImportsCreateOutput,
  DashboardInstanceSkillsImportsGetOutput
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { useEffect, useRef } from 'react';
import { withAuth } from '../../user';
import { skillsLoader } from './skills';

export type SkillImport = DashboardInstanceSkillsImportsCreateOutput;

export type CreateSkillImportInput = DashboardInstanceSkillsImportsCreateBody & {
  instanceId: string;
};

export let skillImportsLoader = createLoader({
  name: 'skillImports',
  parents: [],
  fetch: async () => [],
  mutators: {}
});

export let useCreateSkillImport = skillImportsLoader.createExternalMutator(
  (i: CreateSkillImportInput) => withAuth(sdk => sdk.skillImports.create(i.instanceId, i))
);

export let skillImportLoader = createLoader({
  name: 'skillImport',
  parents: [skillImportsLoader],
  fetch: (i: { instanceId: string; skillImportId: string }) =>
    withAuth(sdk => sdk.skillImports.get(i.instanceId, i.skillImportId)),
  mutators: {}
});

export let useSkillImport = (
  instanceId: string | null | undefined,
  skillImportId: string | null | undefined
) => {
  let data = skillImportLoader.use(
    instanceId && skillImportId ? { instanceId, skillImportId } : null
  );
  let isActive = data.data ? ['pending', 'processing'].includes(data.data.status) : false;
  let refetchRef = useRef(data.refetch);
  let refreshedSkillsRef = useRef(false);
  refetchRef.current = data.refetch;

  useEffect(() => {
    if (!isActive) return;
    let id = setInterval(() => refetchRef.current(), 2000);
    return () => clearInterval(id);
  }, [isActive]);

  useEffect(() => {
    if (
      !data.data ||
      !(
        ['completed', 'failed'] as DashboardInstanceSkillsImportsGetOutput['status'][]
      ).includes(data.data.status) ||
      refreshedSkillsRef.current
    ) {
      return;
    }

    refreshedSkillsRef.current = true;
    skillsLoader.refetchAll();
  }, [data.data?.status]);

  return data;
};
