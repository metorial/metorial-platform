import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { useCallback, useCurrentInstance } from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let CallbackLayout = () => {
  let instance = useCurrentInstance();
  let { callbackId } = useParams();
  let pathname = useLocation().pathname;
  let callback = useCallback(instance.data?.id, callbackId);

  let pathParams = [
    instance.data?.organization,
    instance.data?.project,
    instance.data,
    callbackId
  ] as const;

  console.log('Rendering CallbackLayout for callbackId:', callbackId, callback);

  return (
    <ContentLayout>
      {renderWithLoader({ callback })(({ callback }) => (
        <>
          <PageHeader
            title={callback.data?.name ?? callback.data.id}
            pagination={[
              {
                label: 'Callbacks',
                href: Paths.instance.callbacks(
                  instance.data?.organization,
                  instance.data?.project,
                  instance.data
                )
              },
              {
                label: callback.data?.name ?? callback.data.id,
                href: Paths.instance.callback(...pathParams)
              }
            ]}
          />

          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.instance.callback(...pathParams)
              },
              {
                label: 'Events',
                to: Paths.instance.callback(...pathParams, 'events')
              },
              {
                label: 'Logs',
                to: Paths.instance.callback(...pathParams, 'logs')
              },
              {
                label: 'Destinations',
                to: Paths.instance.callback(...pathParams, 'destinations')
              }
            ]}
          />

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
