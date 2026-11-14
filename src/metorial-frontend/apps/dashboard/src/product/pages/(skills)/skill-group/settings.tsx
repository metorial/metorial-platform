import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Navigate, useParams } from 'react-router-dom';

export let SkillGroupSettingsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { skillGroupId } = useParams();

  if (!instance.data || !organization.data || !project.data) return null;

  return (
    <Navigate
      replace
      to={Paths.instance.skillGroup(
        organization.data,
        project.data,
        instance.data,
        skillGroupId
      )}
    />
  );
};
