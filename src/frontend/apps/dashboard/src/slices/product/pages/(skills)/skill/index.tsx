import { Paths } from '@metorial/frontend-config';
import {
  SkillAgentsScene,
  SkillGroupsForSkillScene,
  SkillLinkProvidersScene,
  StoreFileViewerScene
} from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkill
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
  let skill = useSkill(instance.data?.id, skillId);

  return (
    <PageStack>
      <StoreFileViewerScene
        instanceId={instance.data?.id}
        storeId={skill.data?.storeId}
        title="Skill Files"
        description="Manage the documents and files of this skill. Describe workflows, behaviors, and tasks for agentic workflows."
        getDocumentPath={documentId =>
          Paths.instance(organization.data, project.data, instance.data, 'doc', documentId)
        }
      />
      <SkillAgentsScene instanceId={instance.data?.id} skillId={skillId} />
      <SkillLinkProvidersScene instanceId={instance.data?.id} skillId={skillId} />
      <SkillGroupsForSkillScene
        instanceId={instance.data?.id}
        skillId={skillId}
        getSkillGroupPath={skillGroupId =>
          Paths.instance.skillGroup(
            organization.data,
            project.data,
            instance.data,
            skillGroupId
          )
        }
      />
    </PageStack>
  );
};
