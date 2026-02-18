import { renderWithLoader } from '@metorial/data-hooks';
import { useCallback, useCurrentInstance } from '@metorial/state';
import { Attributes, Copy, RenderDate, Spacer } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { UsageScene } from '../usage/usage';

export let CallbackOverview = (p: { callbackId: string | undefined }) => {
  let instance = useCurrentInstance();
  let callback = useCallback(instance.data?.id, p.callbackId);

  return renderWithLoader({ callback })(({ callback }) => (
    <>
      <Attributes
        itemWidth="300px"
        attributes={[
          {
            label: 'Type',
            content: {
              webhook_managed: 'Webhook',
              polling: 'Polling',
              webhook_manual: 'Webhook'
            }[callback.data.type]
          },

          {
            label: 'Next Poll At',
            content: callback.data.schedule.nextRunAt ? (
              <RenderDate date={callback.data.schedule.nextRunAt} />
            ) : (
              'N/A'
            )
          },

          {
            label: 'ID',
            content: <ID id={callback.data.id} />
          }
        ]}
      />

      <Spacer height={15} />

      {callback.data?.url && (
        <Box
          title="Callback URL"
          description="Register this URL with the external provider to receive Metorial callbacks."
        >
          <Copy value={callback.data?.url ?? ''} />
        </Box>
      )}

      <Spacer height={15} />

      <UsageScene
        title="Usage"
        description="Events received for this callback."
        entities={[{ type: 'callback', id: callback.data.id }]}
        entityNames={{ [callback.data.id]: 'Callback' }}
      />
    </>
  ));
};
