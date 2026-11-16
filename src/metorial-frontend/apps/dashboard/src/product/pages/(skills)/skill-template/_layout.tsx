import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { SkillWorkspaceLayout } from '@metorial/scene-skills';
import {
  useCreateSkill,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillTemplate,
  useStorePermissions
} from '@metorial/state';
import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { showSkillCloneFormModal } from '../../../scenes/skills/cloneModal';
import { SkillDocumentSkeleton } from '../skill';
import { SkillTemplatePage } from './index';

let LoadingHost = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
`;

let LoadingOverlay = styled.div<{ $visible: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 100;
  overflow: hidden;
  --docs-inset-top: 56px;
  background: #fff;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  visibility: ${({ $visible }) => ($visible ? 'visible' : 'hidden')};
  pointer-events: ${({ $visible }) => ($visible ? 'auto' : 'none')};
  transition:
    opacity 0.28s ease,
    visibility 0s linear ${({ $visible }) => ($visible ? '0s' : '0.28s')};
`;

export let SkillTemplateLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { skillTemplateId } = useParams();
  let skillTemplate = useSkillTemplate(instance.data?.id, skillTemplateId);
  let storePermissions = useStorePermissions(instance.data?.id, skillTemplate.data?.storeId);
  let updateTemplate = skillTemplate.updateMutator();
  let createSkill = useCreateSkill();
  let navigate = useNavigate();

  let isSystem = skillTemplate.data?.owner === 'system';
  let canWriteStore =
    !isSystem &&
    (storePermissions.data?.hasFullAccess ||
      storePermissions.data?.permissions.includes('content_write'));

  let [readyTemplateId, setReadyTemplateId] = useState<string | null>(null);
  let onDocumentReady = useCallback(
    () => setReadyTemplateId(skillTemplateId ?? null),
    [skillTemplateId]
  );
  let showSkeleton = readyTemplateId != (skillTemplateId ?? null) && !skillTemplate.error;
  let permissionsLoading =
    !!skillTemplate.data?.storeId && !storePermissions.data && !storePermissions.error;

  let templatePath = Paths.instance.skillTemplate(
    organization.data,
    project.data,
    instance.data,
    skillTemplate.data?.id ?? skillTemplateId
  );

  let cloneAsSkill = () => {
    if (!instance.data || !skillTemplate.data) return;

    showSkillCloneFormModal({
      title: 'Clone Template as Skill',
      description: 'Choose a name and description for the new skill.',
      submitLabel: 'Clone as Skill',
      initialName: skillTemplate.data.name,
      initialDescription: skillTemplate.data.description,
      onSubmit: async values => {
        let [skill] = await createSkill.mutate({
          instanceId: instance.data!.id,
          templateId: skillTemplate.data!.id,
          name: values.name,
          description: values.description
        });

        if (!skill) return false;

        navigate(
          Paths.instance.skill(organization.data, project.data, instance.data, skill.id)
        );
      }
    });
  };

  return (
    <LoadingHost>
      {(!skillTemplate.data || permissionsLoading) && !skillTemplate.error
        ? null
        : renderWithLoader({ skillTemplate })(({ skillTemplate }) => (
            <SkillWorkspaceLayout
              onDocumentReady={onDocumentReady}
              instanceId={instance.data?.id}
              skill={{
                id: skillTemplate.data.id,
                name: skillTemplate.data.name,
                storeId: skillTemplate.data.storeId
              }}
              template={{ templateId: skillTemplate.data.id }}
              workspaceLabel="Skill Templates"
              backPath={Paths.instance.skillTemplates(
                organization.data,
                project.data,
                instance.data
              )}
              routes={{
                overview: templatePath,
                mergeRequests: `${templatePath}/merge-requests`,
                mergeRequest: mergeRequestId =>
                  `${templatePath}/merge-requests/${mergeRequestId}`,
                document: (_, itemId) => `${templatePath}/item/${itemId}`,
                providers: `${templatePath}/providers`,
                agents: `${templatePath}/agents`,
                settings: `${templatePath}/settings`
              }}
              defaultCanvas={<SkillTemplatePage />}
              readOnly={!canWriteStore}
              onNameChange={
                isSystem
                  ? undefined
                  : async name => {
                      let [, error] = await updateTemplate.mutate({ name });
                      if (error) throw error;
                      skillTemplate.refetch();
                    }
              }
              onDuplicate={instance.data ? cloneAsSkill : null}
            />
          ))}
      <LoadingOverlay $visible={showSkeleton} aria-hidden={!showSkeleton || undefined}>
        <SkillDocumentSkeleton />
      </LoadingOverlay>
    </LoadingHost>
  );
};
