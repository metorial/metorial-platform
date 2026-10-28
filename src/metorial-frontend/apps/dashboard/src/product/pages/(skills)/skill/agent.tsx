import { DocumentEditorScene } from '@metorial/scene-docs';
import { useSkillWorkspace } from '@metorial/scene-skills';
import { useCurrentInstance, useCurrentOrganization, useSkill } from '@metorial/state';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';

let DocumentPage = styled.div`
  height: 100%;
  min-height: 0;
`;

export let SkillAgentDocumentPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let { skillId, documentId } = useParams();
  let skill = useSkill(instance.data?.id, skillId);
  let workspace = useSkillWorkspace();

  return (
    <DocumentPage>
      <DocumentEditorScene
        instanceId={instance.data?.id}
        documentId={documentId}
        chrome={workspace ? 'external' : undefined}
        loadError={skill.error}
        setRestrictHeight={enabled => (window as any).metorial_setRestrictHeight?.(enabled)}
        hideSharingControls
        skillShareContext={
          skillId
            ? {
                mode: 'dashboard',
                organizationId: organization.data?.id,
                skills: [{ id: skillId, name: skill.data?.name ?? null }]
              }
            : null
        }
      />
    </DocumentPage>
  );
};
