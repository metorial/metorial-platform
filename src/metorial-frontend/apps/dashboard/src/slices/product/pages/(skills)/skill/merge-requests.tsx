import { Paths } from '@metorial/frontend-config';
import { SkillMergeRequestsScene } from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { useParams } from 'react-router-dom';

export let SkillMergeRequestsPage = () => {
  let { skillId } = useParams();
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return (
    <SkillMergeRequestsScene
      instanceId={instance.data?.id}
      skillId={skillId}
      href={mergeRequestId =>
        `${Paths.instance.skill(
          organization.data,
          project.data,
          instance.data,
          skillId
        )}/merge-requests/${mergeRequestId}`
      }
    />
  );
};
