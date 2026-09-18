import { Paths } from '@metorial/frontend-config';
import { SkillMarketplacePluginsScene } from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { SkillMarketplaceRepositorySyncBox } from './repositorySync';

let PageStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export let SkillMarketplacePage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let { skillMarketplaceId } = useParams();

  return (
    <PageStack>
      <SkillMarketplaceRepositorySyncBox skillMarketplaceId={skillMarketplaceId} />
      <Box
        title="Plugins and Skills"
        description="Manage plugins and skills for this marketplace. Use plugins to group related skills or add individual skills directly."
      >
        <SkillMarketplacePluginsScene
          instanceId={instance.data?.id}
          skillMarketplaceId={skillMarketplaceId}
          showHeader={false}
          getSkillPluginPath={skillPluginId =>
            Paths.organization.settings(
              organization.data,
              'project',
              project.data?.slug,
              'instance',
              instance.data?.slug,
              'skills',
              'plugins',
              skillPluginId
            )
          }
          getSkillPath={skillId =>
            Paths.instance.skill(organization.data, project.data, instance.data, skillId)
          }
        />
      </Box>
    </PageStack>
  );
};
