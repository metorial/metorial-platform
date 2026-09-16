import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCallbackById,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiBroadcastLine } from '@remixicon/react';
import { Outlet, useParams } from 'react-router-dom';
import { DeletedRecordCallout } from '../../../scenes/deletedRecordCallout';

export let CallbackLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { callbackId } = useParams();
  let callback = useCallbackById(instance.data?.id, callbackId);

  let callbackPath = (...subPages: string[]) =>
    Paths.instance.callback(
      organization.data,
      project.data,
      instance.data,
      callback.data?.id ?? callbackId,
      ...subPages
    );

  return (
    <DetailsLayout
      entity={callback.data}
      icon={<RiBroadcastLine />}
      breadcrumbs={[
        {
          label: 'Callbacks',
          to: Paths.instance.callbacks(organization.data, project.data, instance.data)
        },
        {
          label: callback.data?.name,
          to: callbackPath()
        }
      ]}
      tabs={[
        { label: 'Overview', to: callbackPath() },
        { label: 'Events', to: callbackPath('events') },
        { label: 'Registrations', to: callbackPath('instances') },
        { label: 'Settings', to: callbackPath('settings') }
      ]}
      attributes={
        callback.data
          ? [
              { label: 'ID', value: <ID id={callback.data.id} /> },
              { label: 'Integration ID', value: <ID id={callback.data.integrationId} /> },
              { label: 'Provider', value: callback.data.provider.name },
              { label: 'Created', value: <RenderDate date={callback.data.createdAt} /> }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ callback })(({ callback }) => (
          <>
            <DeletedRecordCallout status={callback.data.status} />
            <Outlet />
          </>
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};
