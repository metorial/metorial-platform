import { Paths } from '@metorial/frontend-config';
import { SkillMergeRequestScene } from '@metorial/scene-skills';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

export let SkillMergeRequestPage = () => {
  let { mergeRequestId, mergeRequestTab } = useParams();
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let location = useLocation();
  let basePath = location.pathname.replace(/\/(conversation|changes)\/?$/, '');

  return (
    <SkillMergeRequestScene
      instanceId={instance.data?.id}
      mergeRequestId={mergeRequestId}
      tab={mergeRequestTab == 'changes' ? 'changes' : 'conversation'}
      conversationHref={`${basePath}/conversation`}
      changesHref={`${basePath}/changes`}
      onMerged={skillId =>
        navigate(Paths.instance.skill(organization.data, project.data, instance.data, skillId))
      }
    />
  );
};
