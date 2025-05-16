import { Paths } from '@metorial/frontend-config';
import { createProject } from '@metorial/layout';
import { useCurrentOrganization } from '@metorial/state';
import { useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export let OrganizationRedirect = () => {
  let org = useCurrentOrganization();
  let navigate = useNavigate();

  let navigatedRef = useRef(false);
  useLayoutEffect(() => {
    if (!org.data || navigatedRef.current) return;
    navigatedRef.current = true;

    let orgInstances = org.data.instances || [];
    let instance = orgInstances[0];

    if (instance) {
      navigate(Paths.instance(org.data, instance.project, instance), { replace: true });
    } else {
      createProject(org.data);
    }
  }, [org.data]);

  return null;
};
