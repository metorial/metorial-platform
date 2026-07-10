import { Paths } from '@metorial/frontend-config';
import { SkillMergeRequestScene } from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { useNavigate, useParams } from 'react-router-dom';

export let SkillMergeRequestPage = () => {
  let { mergeRequestId } = useParams();
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();

  return (
    <SkillMergeRequestScene
      instanceId={instance.data?.id}
      mergeRequestId={mergeRequestId}
      onMerged={skillId =>
        navigate(Paths.instance.skill(organization.data, project.data, instance.data, skillId))
      }
    />
  );
};
