import { Paths } from '@metorial/frontend-config';
import { SkillMarketplaceSettingsScene } from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { useNavigate, useParams } from 'react-router-dom';

export let SkillMarketplaceSettingsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let { skillMarketplaceId } = useParams();

  return (
    <SkillMarketplaceSettingsScene
      instanceId={instance.data?.id}
      onDeleteSuccess={() =>
        navigate(
          Paths.instance.skillMarketplaces(organization.data, project.data, instance.data)
        )
      }
      skillMarketplaceId={skillMarketplaceId}
    />
  );
};
