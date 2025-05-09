import { Paths } from '@metorial/frontend-config';
import { createProject } from '@metorial/layout';
import { lastProjectIdStore, useCurrentOrganization } from '@metorial/state';
import { useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export let OrganizationRedirect = () => {
  let org = useCurrentOrganization();
  let navigate = useNavigate();

  let navigatedRef = useRef(false);
  useLayoutEffect(() => {
    if (!org.data || navigatedRef.current) return;

    navigatedRef.current = true;

    lastProjectIdStore.get().then(lastProjectId => {
      if (navigatedRef.current || !org.data) return;

      let orgProjects = org.data.projects || [];

      let project = orgProjects.find(i => i.id === lastProjectId);
      if (!project) project = orgProjects[0];

      if (project) {
        navigate(Paths.project(org.data, project), { replace: true });
      } else {
        createProject(org.data);
      }

      navigatedRef.current = true;
    });
  }, [org.data]);

  return null;
};
