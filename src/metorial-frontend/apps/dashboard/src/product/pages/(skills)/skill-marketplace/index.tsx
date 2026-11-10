import { DetailsOverviewLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import { SkillMarketplacePluginsScene } from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { SkillMarketplaceSyncRail } from './syncRail';

export let SkillMarketplacePage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let { skillMarketplaceId } = useParams();
  let [changeSignal, setChangeSignal] = useState(0);

  return (
    <DetailsOverviewLayout
      aside={
        <SkillMarketplaceSyncRail
          skillMarketplaceId={skillMarketplaceId}
          changeSignal={changeSignal}
        />
      }
    >
      <SkillMarketplacePluginsScene
        instanceId={instance.data?.id}
        skillMarketplaceId={skillMarketplaceId}
        showHeader={false}
        onChange={() => setChangeSignal(current => current + 1)}
        getSkillPath={skillId =>
          Paths.instance.skill(organization.data, project.data, instance.data, skillId)
        }
      />
    </DetailsOverviewLayout>
  );
};
