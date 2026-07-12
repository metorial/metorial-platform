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
import { Button, Flex, toast, Tooltip } from '@metorial/ui';
import { RiDownloadLine, RiFileCopyLine } from '@remixicon/react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { showSkillCloneFormModal } from '../../../scenes/skills/cloneModal';

let WorkspacePage = styled.div<{ $flush: boolean }>`
  box-sizing: border-box;
  width: 100%;
  min-height: 100%;
  height: ${p => (p.$flush ? '100%' : 'auto')};
  max-width: ${p => (p.$flush ? 'none' : '1120px')};
  margin: 0 auto;
  padding: ${p => (p.$flush ? '0' : '32px clamp(24px, 4vw, 48px) 64px')};
`;

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
  let updateSkill = skill.updateMutator();
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
  let skillPath = Paths.instance.skill(...skillPathParams);
  let isDocumentRoute =
    pathname == skillPath ||
    pathname.startsWith(`${skillPath}/item/`) ||
    pathname.startsWith(`${skillPath}/agent/`);

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
            )}/merge-requests/${skillForkSync.mergeRequestId}/conversation`
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
    <>
      {renderWithLoader(
        { skill },
        {
          spaceTop: 50
        }
      )(({ skill }) => (
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
          actions={
            <Flex gap="8px">
              {skill.data.hierarchy.type == 'fork' && instance.data && canReadStore && (
                <Button
                  size="2"
                  variant="soft"
                  onClick={() =>
                    showCreateSkillMergeRequestModal({
                      instanceId: instance.data!.id,
                      sourceSkillId: skill.data.id,
                      onCreated: mergeRequestId =>
                        navigate(`${skillPath}/merge-requests/${mergeRequestId}/conversation`)
                    })
                  }
                  menu={
                    skill.data.hierarchy.type == 'fork' && instance.data && canWriteStore
                      ? [
                          {
                            label: 'Sync with upstream',
                            onClick: syncWithUpstream
                          }
                        ]
                      : []
                  }
                >
                  Request Merge
                </Button>
              )}

              <Tooltip content="Duplicate Skill">
                <Button
                  aria-label="Duplicate Skill"
                  disabled={!instance.data}
                  iconRight={<RiFileCopyLine size={16} />}
                  onClick={duplicate}
                  size="2"
                  variant="soft"
                />
              </Tooltip>

              <Tooltip content="Export Skill">
                <Button
                  aria-label="Export Skill"
                  size="2"
                  disabled={!instance.data}
                  iconRight={<RiDownloadLine size={16} />}
                  loading={createSkillExport.isLoading}
                  success={createSkillExport.isSuccess}
                  onClick={exportSkill}
                  variant="soft"
                />
              </Tooltip>
            </Flex>
          }
        >
          <WorkspacePage $flush={isDocumentRoute}>
            <Outlet />
          </WorkspacePage>
        </SkillWorkspaceLayout>
      ))}
    </>
  );
};
