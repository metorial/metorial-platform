import { Paths } from '@metorial/frontend-config';
import { lastProjectIdStore, useBoot } from '@metorial/state';
import { useLayoutEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export let RootRedirect = () => {
  let boot = useBoot();
  let navigate = useNavigate();
  let [params] = useSearchParams();
  let organizationId = params.get('organization_id') ?? params.get('organizationId');

  let navigatedRef = useRef(false);
  useLayoutEffect(() => {
    if (!boot.data) return;

    lastProjectIdStore.get().then(lastProjectId => {
      if (navigatedRef.current || !boot.data) return;

      if (organizationId) {
        let org = boot.data.organizations.find(
          o => o.id === organizationId || o.slug === organizationId
        );
        let orgProjects = boot.data.projects.filter(i => i.organizationId === org?.id);

        let project = orgProjects.find(i => i.id === lastProjectId);
        if (!project) project = orgProjects[0];

        if (project && org) {
          navigate(Paths.project(org, project), { replace: true });
          navigatedRef.current = true;
          return;
        }
      }

      let project = boot.data.projects.find(i => i.id === lastProjectId);

      if (project) {
        navigate(Paths.project(project.organization, project), { replace: true });
      } else {
        let anyProject = boot.data.projects[0];

        if (anyProject) {
          navigate(Paths.project(anyProject.organization, anyProject), { replace: true });
        } else {
          navigate(Paths.welcome(), { replace: true });
        }
      }

      navigatedRef.current = true;
    });
  }, [boot.data]);

  return null;
};
