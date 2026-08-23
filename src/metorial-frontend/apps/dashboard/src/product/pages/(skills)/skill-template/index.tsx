import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { SkillTemplateLinkProvidersScene, StoreFileViewerScene } from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillTemplate
} from '@metorial/state';
import { Callout } from '@metorial/ui';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';

let PageStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export let SkillTemplatePage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let { skillTemplateId } = useParams();
  let skillTemplate = useSkillTemplate(instance.data?.id, skillTemplateId);

  return renderWithLoader({ skillTemplate })(({ skillTemplate }) => (
    <PageStack>
      {skillTemplate.data.owner === 'system' && (
        <Callout color="gray">
          This skill template is managed by Metorial. You cannot modify the files or linked
          providers for this template.
        </Callout>
      )}

      <StoreFileViewerScene
        instanceId={instance.data?.id}
        storeId={skillTemplate.data.storeId}
        title="Template Files"
        description="Manage the documents and files that are included with this skill template."
        readOnly={skillTemplate.data.owner === 'system'}
        getDocumentPath={documentId =>
          Paths.instance(organization.data, project.data, instance.data, 'doc', documentId)
        }
      />
      <SkillTemplateLinkProvidersScene
        instanceId={instance.data?.id}
        skillTemplateId={skillTemplateId}
        readOnly={skillTemplate.data.owner === 'system'}
      />
    </PageStack>
  ));
};
