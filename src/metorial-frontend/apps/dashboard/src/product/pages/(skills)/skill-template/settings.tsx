import { Paths } from '@metorial/frontend-config';
import { SkillTemplateSettingsScene } from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { useNavigate, useParams } from 'react-router-dom';

export let SkillTemplateSettingsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let { skillTemplateId } = useParams();

  return (
    <SkillTemplateSettingsScene
      instanceId={instance.data?.id}
      onDeleteSuccess={() =>
        navigate(Paths.instance.skillTemplates(organization.data, project.data, instance.data))
      }
      skillTemplateId={skillTemplateId}
    />
  );
};
