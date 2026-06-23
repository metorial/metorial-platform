import { Paths } from '@metorial/frontend-config';
import { SkillPluginSkillsScene } from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { useParams } from 'react-router-dom';

export let SkillPluginPage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let { skillPluginId } = useParams();

  return (
    <SkillPluginSkillsScene
      instanceId={instance.data?.id}
      skillPluginId={skillPluginId}
      getSkillPath={skillId =>
        Paths.instance.skill(organization.data, project.data, instance.data, skillId)
      }
    />
  );
};
