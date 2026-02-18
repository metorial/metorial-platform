import { Paths } from '@metorial/frontend-config';
import { lastInstanceIdStore, useBoot } from '@metorial/state';
import { useLayoutEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export let RootRedirect = () => {
  let boot = useBoot();
  let navigate = useNavigate();
  let [params] = useSearchParams();
  let organizationId = params.get('organization_id') ?? params.get('organizationId');
  let path = params.get('path');

  let navigatedRef = useRef(false);
  useLayoutEffect(() => {
    if (!boot.data) return;

    lastInstanceIdStore.get().then(lastInstanceId => {
      if (navigatedRef.current || !boot.data) return;

      if (organizationId) {
        let org = boot.data.organizations.find(
          o => o.id === organizationId || o.slug === organizationId
        );
        let orgInstances = boot.data.instances.filter(i => i.organizationId === org?.id);

        let instance = orgInstances.find(i => i.id === lastInstanceId);
        if (!instance) instance = orgInstances[0];

        if (instance && org) {
          navigate(Paths.instance(org, instance.project, instance, path), { replace: true });
          navigatedRef.current = true;
          return;
        }
      }

      let instance = boot.data.instances.find(i => i.id === lastInstanceId);

      if (instance) {
        navigate(Paths.instance(instance.organization, instance.project, instance, path), {
          replace: true
        });
      } else {
        let anyInstance = boot.data.instances[0];

        if (anyInstance) {
          navigate(
            Paths.instance(anyInstance.organization, anyInstance.project, anyInstance, path),
            { replace: true }
          );
        } else {
          navigate(Paths.welcome(), { replace: true });
        }
      }

      navigatedRef.current = true;
    });
  }, [boot.data]);

  return null;
};
