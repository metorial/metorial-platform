import { Paths } from '@metorial/frontend-config';
import { useCurrentProject } from '@metorial/state';
import { useLayoutEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export let ProjectRedirect = () => {
  let project = useCurrentProject();
  let navigate = useNavigate();

  let [search] = useSearchParams();
  let path = search.get('path');

  let navigatedRef = useRef(false);
  useLayoutEffect(() => {
    if (!project.data || navigatedRef.current) return;

    navigatedRef.current = true;

    let instance = project.data.instances.find(i => i.type == 'development');
    if (!instance) instance = project.data.instances[0];
    if (!instance) return navigate('/');

    navigate(Paths.instance(project.data.organization, instance.project, instance, path), {
      replace: true
    });
  }, [project.data]);

  return null;
};
