import { Paths } from '@metorial/frontend-config';
import { SkillPluginSettingsScene } from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { useNavigate, useParams } from 'react-router-dom';

export let SkillPluginSettingsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let { skillPluginId } = useParams();

  return (
    <SkillPluginSettingsScene
      instanceId={instance.data?.id}
      onDeleteSuccess={() =>
        navigate(Paths.instance.skillPlugins(organization.data, project.data, instance.data))
      }
      skillPluginId={skillPluginId}
    />
  );
};
