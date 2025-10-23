import { renderWithLoader } from '@metorial/data-hooks';
import { useCallback, useCurrentInstance, useServerDeployment } from '@metorial/state';
import { Attributes, Copy, RenderDate, Spacer } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

export let CallbackOverviewPage = () => {
  let instance = useCurrentInstance();

  let { serverDeploymentId } = useParams();
  let deployment = useServerDeployment(instance.data?.id, serverDeploymentId);
  let callback = useCallback(instance.data?.id, deployment.data?.callback?.id);

  return renderWithLoader({ callback })(({ callback }) => (
    <>
      <Attributes
        itemWidth="250px"
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
          <Copy label="Callback ID" value={callback.data?.url ?? ''} />
        </Box>
      )}
    </>
  ));
};
