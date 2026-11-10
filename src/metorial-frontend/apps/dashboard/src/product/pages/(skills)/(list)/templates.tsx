import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Navigate } from 'react-router-dom';

export let SkillTemplatesPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  if (!instance.data || !organization.data || !project.data) return null;

  return (
    <Navigate
      replace
      to={Paths.instance.skillTemplates(organization.data, project.data, instance.data)}
    />
  );
};
