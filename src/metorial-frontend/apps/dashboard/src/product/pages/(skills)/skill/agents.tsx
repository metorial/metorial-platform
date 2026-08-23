import { Paths } from '@metorial/frontend-config';
import { SkillAgentsScene } from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { useParams } from 'react-router-dom';

export let SkillAgentsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { skillId } = useParams();
  let skillPath = Paths.instance.skill(
    organization.data,
    project.data,
    instance.data,
    skillId
  );

  return (
    <SkillAgentsScene
      instanceId={instance.data?.id}
      skillId={skillId}
      getDocumentPath={documentId => `${skillPath}/agent/${documentId}`}
    />
  );
};
