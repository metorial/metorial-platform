import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  showCreateSkillMergeRequestModal,
  SkillWorkspaceLayout
} from '@metorial/scene-skills';
import {
  useCreateSkillExport,
  useCreateSkillForkSync,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDuplicateSkill,
  useSkill,
  useStorePermissions
} from '@metorial/state';
import { snackbar } from '@metorial/ui';
import { useNavigate, useParams } from 'react-router-dom';
import { showSkillCloneFormModal } from '../../../scenes/skills/cloneModal';
import { SkillPage } from './index';

let downloadExport = (url: string, fileName: string) => {
  let link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export let SkillLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { skillId } = useParams();
  let skill = useSkill(instance.data?.id, skillId);
  let parentSkillId =
    skill.data?.hierarchy.type == 'fork' ? skill.data.hierarchy.parentSkillId : null;
  let parentSkill = useSkill(instance.data?.id, parentSkillId);
  let storePermissions = useStorePermissions(instance.data?.id, skill.data?.storeId);
  let duplicateSkill = useDuplicateSkill();
  let createSkillForkSync = useCreateSkillForkSync();
  let createSkillExport = useCreateSkillExport();
  let updateSkill = skill.updateMutator();
  let navigate = useNavigate();
  let canReadStore =
    storePermissions.data?.hasFullAccess ||
    storePermissions.data?.permissions.includes('content_read');
  let canWriteStore =
    storePermissions.data?.hasFullAccess ||
    storePermissions.data?.permissions.includes('content_write');

  let skillPathParams = [
    organization.data,
    project.data,
    instance.data,
    skill.data?.id ?? skillId
  ] as const;
  let skillPath = Paths.instance.skill(...skillPathParams);
  let skillHref = (id: string) =>
    Paths.instance.skill(organization.data, project.data, instance.data, id);

  let duplicate = () => {
    if (!instance.data || !skill.data) return;

    showSkillCloneFormModal({
      title: 'Duplicate Skill',
      description: 'Choose a name and description for the duplicated skill.',
      submitLabel: 'Duplicate Skill',
      initialName: `Copy of ${skill.data.name}`,
      initialDescription: skill.data.description,
      onSubmit: async values => {
        let [duplicatedSkill] = await duplicateSkill.mutate({
          instanceId: instance.data!.id,
          skillId: skill.data!.id,
          name: values.name,
          description: values.description
        });

        if (!duplicatedSkill) return false;

        navigate(skillHref(duplicatedSkill.id));
      }
    });
  };

  let exportSkill = () => {
    if (!instance.data || !skill.data) return;

    void snackbar.promise(
      (async () => {
        let [skillExport, error] = await createSkillExport.mutate({
          instanceId: instance.data!.id,
          target: 'skill',
          skillId: skill.data!.id
        });

        if (error) throw error;
        if (!skillExport?.fileLink)
          throw new Error('Export completed without a download link');

        downloadExport(skillExport.fileLink!.url, `${skill.data!.slug}.zip`);
      })(),
      {
        loading: 'Exporting skill…',
        success: 'Skill export downloaded',
        error: 'Failed to export skill'
      }
    );
  };

  let syncWithUpstream = () => {
    if (!instance.data || !skill.data) return;

    void snackbar.promise(
      (async () => {
        let [skillForkSync, error] = await createSkillForkSync.mutate({
          instanceId: instance.data!.id,
          skillId: skill.data!.id
        });

        if (error) throw error;
        if (!skillForkSync) throw new Error('Skill sync completed without a result');

        if (skillForkSync.status === 'action_required' && skillForkSync.mergeRequestId) {
          navigate(`${skillPath}/merge-requests/${skillForkSync.mergeRequestId}/conversation`);
        }

        skill.refetch();

        return skillForkSync;
      })(),
      {
        loading: 'Syncing with upstream…',
        success: skillForkSync =>
          skillForkSync.status === 'completed'
            ? 'Skill synced with upstream'
            : 'Review required to finish syncing',
        error: (error: any) =>
          error?.error?.data?.message ?? error?.message ?? 'Failed to sync skill'
      }
    );
  };

  return (
    <>
      {renderWithLoader(
        { skill },
        {
          spaceTop: 50
        }
      )(({ skill }) => {
        let isFork = skill.data.hierarchy.type == 'fork';

        return (
          <SkillWorkspaceLayout
            instanceId={instance.data?.id}
            skill={skill.data}
            workspaceLabel="Skills"
            backPath={Paths.instance.skills(organization.data, project.data, instance.data)}
            routes={{
              overview: skillPath,
              mergeRequests: `${skillPath}/merge-requests`,
              mergeRequest: mergeRequestId =>
                `${skillPath}/merge-requests/${mergeRequestId}/conversation`,
              document: (_, itemId) => `${skillPath}/item/${itemId}`,
              agent: documentId => `${skillPath}/agent/${documentId}`,
              providers: `${skillPath}/providers`,
              agents: `${skillPath}/agents`,
              settings: `${skillPath}/settings`,
              groups: `${skillPath}/groups`,
              versions: `${skillPath}/versions`,
              participants: `${skillPath}/participants`
            }}
            defaultCanvas={<SkillPage />}
            shareContext={{
              mode: 'dashboard',
              organizationId: organization.data?.id,
              skills: [{ id: skill.data.id, name: skill.data.name }]
            }}
            readOnly={!canWriteStore}
            onNameChange={async name => {
              let [, error] = await updateSkill.mutate({ name });
              if (error) throw error;
              skill.refetch();
            }}
            onImageChange={async input => {
              let [, error] = await updateSkill.mutate(input);
              if (error) throw error;
              skill.refetch();
            }}
            onDuplicate={instance.data ? duplicate : null}
            onExport={instance.data ? exportSkill : null}
            exportLoading={createSkillExport.isLoading}
            fork={
              isFork
                ? {
                    onRequestMerge:
                      instance.data && canReadStore
                        ? () =>
                            showCreateSkillMergeRequestModal({
                              instanceId: instance.data!.id,
                              sourceSkillId: skill.data.id,
                              onCreated: mergeRequestId =>
                                navigate(
                                  `${skillPath}/merge-requests/${mergeRequestId}/conversation`
                                )
                            })
                        : null,
                    onSync: instance.data && canWriteStore ? syncWithUpstream : null,
                    parentHref: skill.data.hierarchy.parentSkillId
                      ? skillHref(skill.data.hierarchy.parentSkillId)
                      : null,
                    parentName: parentSkill.data?.name ?? null
                  }
                : null
            }
          />
        );
      })}
    </>
  );
};
