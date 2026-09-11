import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCallbackById,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';

export let CallbackLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { callbackId } = useParams();
  let callback = useCallbackById(instance.data?.id, callbackId);
  let pathname = useLocation().pathname;

  let params = [
    organization.data,
    project.data,
    instance.data,
    callback.data?.id ?? callbackId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={callback.data?.name ?? '...'}
        pagination={[
          {
            label: 'Callbacks',
            href: Paths.instance.callbacks(organization.data, project.data, instance.data)
          },
          {
            label: callback.data?.name,
            href: Paths.instance.callback(...params)
          }
        ]}
      />

      <InitialLoadBoundary>
        {renderWithLoader({ callback })(({ callback }) => (
          <>
            <DeletedRecordCallout status={callback.data.status} />

            <LinkTabs
              current={pathname}
              links={[
                { label: 'Overview', to: Paths.instance.callback(...params) },
                { label: 'Events', to: Paths.instance.callback(...params, 'events') },
                { label: 'Settings', to: Paths.instance.callback(...params, 'settings') }
              ]}
            />

            <Outlet />
          </>
        ))}
      </InitialLoadBoundary>
    </ContentLayout>
  );
};
