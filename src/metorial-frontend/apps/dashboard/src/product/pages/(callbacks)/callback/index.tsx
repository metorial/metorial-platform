import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCallbackById,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDashboardFlags
} from '@metorial/state';
import { Attributes, Spacer } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { CallbackEventsTable } from '../../../scenes/callbacks/callbackEventsTable';
import { CallbackDeliveryBox } from '../../../scenes/callbacks/listenersBox';
import {
  CallbackPendingCallout,
  CallbackSyncErrorCallout
} from '../../../scenes/callbacks/shared';
import { CallbackWebhookRegistrationsBox } from '../../../scenes/callbacks/webhookRegistrationsBox';

export let CallbackOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let flags = useDashboardFlags();
  let { callbackId } = useParams();
  let callback = useCallbackById(instance.data?.id, callbackId);

  return renderWithLoader({ callback, instance, organization, project })(
    ({ callback, instance, organization, project }) => (
      <>
        <CallbackSyncErrorCallout sync={callback.data.sync} />
        <CallbackPendingCallout sync={callback.data.sync} />

        <Attributes
          itemWidth="300px"
          attributes={[
            { label: 'ID', content: <ID id={callback.data.id} /> },
            { label: 'Provider', content: callback.data.provider.name },
            {
              label: 'Integration ID',
              content: <ID id={callback.data.integrationId} />
            }
          ]}
        />

        <Spacer height={20} />

        <CallbackWebhookRegistrationsBox
          instanceId={instance.data.id}
          providerId={callback.data.provider.id}
        />

        {flags.data?.flags['webhooks-enabled'] ? (
          <>
            <CallbackDeliveryBox
              organizationId={organization.data.id}
              instanceId={instance.data.id}
              callbackIds={[callback.data.id]}
              defaultCallbackId={callback.data.id}
              description="Event destinations subscribed to this callback's triggers."
            />
            <Spacer height={20} />
          </>
        ) : null}

        <Box
          title="Recent Events"
          description="The latest provider events recorded for this callback."
        >
          <CallbackEventsTable
            instanceId={instance.data.id}
            filters={{ callbackId: callback.data.id }}
            emptyState="No events recorded for this callback yet."
          />
        </Box>
      </>
    )
  );
};
