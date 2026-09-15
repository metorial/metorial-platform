import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { JsonViewer } from '@metorial/json-viewer';
import { useChatEvent, useCurrentInstance } from '@metorial/state';
import { Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

export let ChatEventPage = () => {
  let instance = useCurrentInstance();
  let { chatEventId } = useParams();
  let chatEvent = useChatEvent(instance.data?.id, chatEventId);

  return renderWithLoader({ chatEvent })(({ chatEvent }) => (
    <DetailsOverviewLayout>
      <Box title="Payload" description="The raw payload the provider sent for this event.">
        {chatEvent.data.payload ? (
          <JsonViewer value={chatEvent.data.payload as any} />
        ) : (
          <Text size="2" color="gray600">
            This event has no payload.
          </Text>
        )}
      </Box>
    </DetailsOverviewLayout>
  ));
};
