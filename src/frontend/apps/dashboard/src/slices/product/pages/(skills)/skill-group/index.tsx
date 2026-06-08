import { Paths } from '@metorial/frontend-config';
import { SkillGroupSkillsScene } from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { useParams } from 'react-router-dom';

export let SkillGroupPage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let { skillGroupId } = useParams();

  return (
    <SkillGroupSkillsScene
      instanceId={instance.data?.id}
      skillGroupId={skillGroupId}
      getSkillPath={skillId =>
        Paths.instance.skill(organization.data, project.data, instance.data, skillId)
      }
    />
  );
};
