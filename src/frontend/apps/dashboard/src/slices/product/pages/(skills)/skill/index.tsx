import { Paths } from '@metorial/frontend-config';
import { SkillLinkProvidersScene, SkillStoreFileViewerScene } from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';

let PageStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export let SkillPage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let { skillId } = useParams();

  return (
    <PageStack>
      <SkillStoreFileViewerScene
        instanceId={instance.data?.id}
        skillId={skillId}
        getDocumentPath={documentId =>
          Paths.instance(organization.data, project.data, instance.data, 'doc', documentId)
        }
      />
      <SkillLinkProvidersScene instanceId={instance.data?.id} skillId={skillId} />
    </PageStack>
  );
};
