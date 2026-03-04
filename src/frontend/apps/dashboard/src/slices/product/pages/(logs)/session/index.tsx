import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Navigate, useParams } from 'react-router-dom';

export let SessionPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let { sessionId } = useParams();
  if (!instance.data || !sessionId) return null;

  return (
    <Navigate
      replace
      to={Paths.instance.providerSession(
        organization.data,
        project.data,
        instance.data,
        sessionId
      )}
    />
  );
};
