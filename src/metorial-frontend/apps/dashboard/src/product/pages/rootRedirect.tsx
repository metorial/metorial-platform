import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout } from '@metorial/layout';
import {
  lastProductPaneByInstanceStore,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  type LastProductPane
} from '@metorial/state';
import { Spinner } from '@metorial/ui';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

export let getHomePathForProductPane = (
  pane: LastProductPane | null | undefined,
  organization: Parameters<typeof Paths.instance.home>[0],
  project: Parameters<typeof Paths.instance.home>[1],
  instance: Parameters<typeof Paths.instance.home>[2]
) => {
  if (pane === 'integrations') {
    return Paths.instance.integrationsOverview(organization, project, instance);
  }

  if (pane === 'skills') {
    return Paths.instance.skills(organization, project, instance);
  }

  if (pane === 'workforce') {
    return Paths.instance.workforce(organization, project, instance);
  }

  return Paths.instance.home(organization, project, instance);
};

export let InstanceRootRedirectPage = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let [pane, setPane] = useState<LastProductPane | null | undefined>(undefined);

  useEffect(() => {
    if (!instance.data?.id) return;

    let active = true;

    lastProductPaneByInstanceStore.get(instance.data.id).then(stored => {
      if (active) setPane(stored ?? null);
    });

    return () => {
      active = false;
    };
  }, [instance.data?.id]);

  return renderWithLoader({ organization, project, instance })(
    ({ organization, project, instance }) => {
      if (pane === undefined) {
        return (
          <ContentLayout>
            <Spinner />
          </ContentLayout>
        );
      }

      return (
        <Navigate
          replace
          to={getHomePathForProductPane(pane, organization.data, project.data, instance.data)}
        />
      );
    }
  );
};
