import { Paths } from '@metorial/frontend-config';
import { SkillMarketplacePluginsScene } from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { useParams } from 'react-router-dom';

export let SkillMarketplacePage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let { skillMarketplaceId } = useParams();

  return (
    <SkillMarketplacePluginsScene
      instanceId={instance.data?.id}
      skillMarketplaceId={skillMarketplaceId}
      getSkillPluginPath={skillPluginId =>
        Paths.instance.skillPlugin(
          organization.data,
          project.data,
          instance.data,
          skillPluginId
        )
      }
      getSkillPath={skillId =>
        Paths.instance.skill(organization.data, project.data, instance.data, skillId)
      }
    />
  );
};
