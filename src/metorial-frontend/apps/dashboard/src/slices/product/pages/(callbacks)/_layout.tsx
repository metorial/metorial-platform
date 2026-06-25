import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCallback,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let CallbackLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let { callbackId } = useParams();
  let pathname = useLocation().pathname;
  let callback = useCallback(instance.data?.id, callbackId);

  let callbackPathParams = [
    organization.data,
    project.data,
    instance.data,
    callback.data?.id ?? callbackId
  ] as const;
  let activeCallbackId = callback.data?.id ?? callbackId;
  let callbackTitle =
    callback.data?.name ??
    (activeCallbackId ? `Callback ${activeCallbackId.slice(0, 8)}...` : '...');

  return (
    <ContentLayout>
      <PageHeader
        title={callbackTitle}
        description={callback.data?.description ?? undefined}
        pagination={[
          {
            label: 'Callbacks',
            href: Paths.instance.callbacks(organization.data, project.data, instance.data)
          },
          {
            label: callback.data?.name ?? activeCallbackId ?? '...',
            href: Paths.instance.callback(...callbackPathParams)
          }
        ]}
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Overview',
            to: Paths.instance.callback(...callbackPathParams)
          },
          {
            label: 'Events',
            to: Paths.instance.callback(...callbackPathParams, 'events')
          },
          {
            label: 'Logs',
            to: Paths.instance.callback(...callbackPathParams, 'logs')
          },
          {
            label: 'Triggers',
            to: Paths.instance.callback(...callbackPathParams, 'triggers')
          },
          {
            label: 'Destinations',
            to: Paths.instance.callback(...callbackPathParams, 'destinations')
          }
        ]}
      />

      {renderWithLoader({ callback })(() => (
        <InitialLoadBoundary>
          <Outlet />
        </InitialLoadBoundary>
      ))}
    </ContentLayout>
  );
};
