import { Paths } from '@metorial/frontend-config';
import { createProject, useCurrentOrganization } from '@metorial/state';
import { useLayoutEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export let OrganizationRedirect = () => {
  let org = useCurrentOrganization();
  let navigate = useNavigate();

  let [search] = useSearchParams();
  let path = search.get('path');

  let navigatedRef = useRef(false);
  useLayoutEffect(() => {
    if (!org.data || navigatedRef.current) return;
    navigatedRef.current = true;

    let orgInstances = org.data.instances || [];
    let instance = orgInstances[0];

    if (instance) {
      navigate(Paths.instance(org.data, instance.project, instance, path), { replace: true });
    } else {
      createProject(org.data);
    }
  }, [org.data]);

  return null;
};
