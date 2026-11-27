import { SkillSettingsScene } from '@metorial/scene-skills';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCurrentOrganization, useCurrentProject } from '@metorial/state';
import { useNavigate, useParams } from 'react-router-dom';

export let SkillSettingsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let { skillId } = useParams();

  return (
    <SkillSettingsScene
      instanceId={instance.data?.id}
      onDeleteSuccess={() =>
        navigate(Paths.instance.skills(organization.data, project.data, instance.data))
      }
      skillId={skillId}
    />
  );
};
