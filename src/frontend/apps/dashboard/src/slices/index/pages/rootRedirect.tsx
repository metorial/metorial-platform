import { Paths } from '@metorial/frontend-config';
import { lastInstanceIdStore, useBoot } from '@metorial/state';
import { useLayoutEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export let RootRedirect = () => {
  let boot = useBoot();
  let navigate = useNavigate();
  let [params] = useSearchParams();
  let organizationId = params.get('organization_id');
  let path = params.get('path');
  let intent = params.get('intent');

  let navigatedRef = useRef(false);
  useLayoutEffect(() => {
    if (!boot.data) return;

    lastInstanceIdStore
      .get()
      .then(async lastInstanceId => {
        if (navigatedRef.current || !boot.data) return;

        if (organizationId) {
          let org = boot.data.organizations.find(
            o => o.id === organizationId || o.slug === organizationId
          );
          let orgInstances = boot.data.instances.filter(i => i.organizationId === org?.id);

          let instance = orgInstances.find(i => i.id === lastInstanceId);
          if (!instance) instance = orgInstances[0];

          if (instance && org) {
            return {
              instance,
              organization: org,
              project: instance.project
            };
          }
        }

        let instance = boot.data.instances.find(i => i.id === lastInstanceId);

        if (instance) {
          return {
            instance,
            organization: instance.organization,
            project: instance.project
          };
        } else {
          let anyInstance = boot.data.instances[0];

          if (anyInstance) {
            return {
              instance: anyInstance,
              organization: anyInstance.organization,
              project: anyInstance.project
            };
          } else {
            return null;
          }
        }
      })
      .then(async res => {
        if (!res) return Paths.welcome();

        let { instance, organization, project } = res;

        if (intent === 'organization_settings')
          return Paths.organization.settings(organization);

        return Paths.instance.home(organization, project, instance);
      })
      .then(async path => {
        if (navigatedRef.current) return;
        navigatedRef.current = true;

        navigate(path, { replace: true });
      });
  }, [boot.data, path, intent]);

  return null;
};
