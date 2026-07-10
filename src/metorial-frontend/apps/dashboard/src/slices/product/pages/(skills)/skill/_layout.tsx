import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { showCreateSkillMergeRequestModal } from '@metorial/scene-skills';
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
import { Button, Flex, LinkTabs, toast } from '@metorial/ui';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { showSkillCloneFormModal } from '../../../scenes/skills/cloneModal';

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
  let storePermissions = useStorePermissions(instance.data?.id, skill.data?.storeId);
  let duplicateSkill = useDuplicateSkill();
  let createSkillForkSync = useCreateSkillForkSync();
  let createSkillExport = useCreateSkillExport();
  let navigate = useNavigate();
  let pathname = useLocation().pathname;
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

        navigate(
          Paths.instance.skill(
            organization.data,
            project.data,
            instance.data,
            duplicatedSkill.id
          )
        );
      }
    });
  };

  let exportSkill = () => {
    if (!instance.data || !skill.data) return;

    toast.promise(
      async () => {
        let [skillExport, error] = await createSkillExport.mutate({
          instanceId: instance.data!.id,
          target: 'skill',
          skillId: skill.data!.id
        });

        if (error) throw error;
        if (!skillExport?.fileLink)
          throw new Error('Export completed without a download link');

        downloadExport(skillExport.fileLink!.url, `${skill.data!.slug}.zip`);
      },
      {
        loading: 'Exporting skill...',
        success: 'Skill export downloaded',
        error: 'Failed to export skill'
      }
    );
  };

  let syncWithUpstream = () => {
    if (!instance.data || !skill.data) return;

    toast.promise(
      async () => {
        let [skillForkSync, error] = await createSkillForkSync.mutate({
          instanceId: instance.data!.id,
          skillId: skill.data!.id
        });

        if (error) throw error;
        if (!skillForkSync) throw new Error('Skill sync completed without a result');

        if (skillForkSync.status === 'action_required' && skillForkSync.mergeRequestId) {
          navigate(
            `${Paths.instance.skill(
              organization.data,
              project.data,
              instance.data,
              skill.data!.id
            )}/merge-requests/${skillForkSync.mergeRequestId}`
          );
        }

        return skillForkSync;
      },
      {
        loading: 'Syncing with upstream...',
        success: skillForkSync =>
          skillForkSync.status === 'completed'
            ? 'Skill synced with upstream'
            : 'Review required to finish syncing',
        error: error => (error instanceof Error ? error.message : 'Failed to sync skill')
      }
    );
  };

  return (
    <ContentLayout>
      <PageHeader
        title={skill.data?.name ?? '...'}
        description={skill.data?.description ?? undefined}
        pagination={[
          {
            label: 'Skills',
            href: Paths.instance.skills(organization.data, project.data, instance.data)
          },
          {
            label: skill.data?.name ?? '...',
            href: Paths.instance.skill(...skillPathParams)
          }
        ]}
        actions={
          <Flex gap="8px">
            {skill.data?.hierarchy.type == 'fork' && instance.data && canReadStore && (
              <Button
                size="2"
                onClick={() =>
                  showCreateSkillMergeRequestModal({
                    instanceId: instance.data!.id,
                    sourceSkillId: skill.data!.id,
                    onCreated: mergeRequestId =>
                      navigate(
                        `${Paths.instance.skill(
                          organization.data,
                          project.data,
                          instance.data,
                          skill.data!.id
                        )}/merge-requests/${mergeRequestId}`
                      )
                  })
                }
              >
                Create Merge Request
              </Button>
            )}
            {skill.data?.hierarchy.type == 'fork' && instance.data && canWriteStore && (
              <Button
                size="2"
                loading={createSkillForkSync.isLoading}
                onClick={syncWithUpstream}
              >
                Sync with upstream
              </Button>
            )}
            <Button size="2" disabled={!instance.data || !skill.data} onClick={duplicate}>
              Duplicate Skill
            </Button>

            <Button
              size="2"
              disabled={!instance.data || !skill.data}
              loading={createSkillExport.isLoading}
              success={createSkillExport.isSuccess}
              onClick={exportSkill}
            >
              Export Skill
            </Button>
          </Flex>
        }
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Overview',
            to: Paths.instance.skill(...skillPathParams)
          },
          {
            label: 'Participants',
            to: `${Paths.instance.skill(...skillPathParams)}/participants`
          },
          {
            label: 'Versions',
            to: `${Paths.instance.skill(...skillPathParams)}/versions`
          },
          {
            label: 'Merge requests',
            to: `${Paths.instance.skill(...skillPathParams)}/merge-requests`
          },
          {
            label: 'Settings',
            to: `${Paths.instance.skill(...skillPathParams)}/settings`
          }
        ]}
      />

      <InitialLoadBoundary>
        {renderWithLoader({ skill })(() => (
          <Outlet />
        ))}
      </InitialLoadBoundary>
    </ContentLayout>
  );
};
