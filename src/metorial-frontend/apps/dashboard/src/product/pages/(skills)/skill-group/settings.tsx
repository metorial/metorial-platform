import { Paths } from '@metorial/frontend-config';
import { SkillGroupSettingsScene } from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { useNavigate, useParams } from 'react-router-dom';

export let SkillGroupSettingsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let { skillGroupId } = useParams();

  return (
    <SkillGroupSettingsScene
      instanceId={instance.data?.id}
      onDeleteSuccess={() =>
        navigate(Paths.instance.skillGroups(organization.data, project.data, instance.data))
      }
      skillGroupId={skillGroupId}
    />
  );
};
