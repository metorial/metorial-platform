import { CodeBlock } from '@metorial/code';
import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { useChatEvent, useCurrentInstance } from '@metorial/state';
import { Spacer, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ProviderInvocationByChatEventId } from '../../../scenes/providerInvocations/details';

export let ChatEventPage = () => {
  let instance = useCurrentInstance();
  let { chatEventId } = useParams();
  let chatEvent = useChatEvent(instance.data?.id, chatEventId);
  let data = useMemo(
    () => JSON.stringify(chatEvent.data?.payload, null, 2),
    [!!chatEvent.data?.payload]
  );

  return renderWithLoader({ chatEvent })(({ chatEvent }) => (
    <DetailsOverviewLayout>
      <Box title="Payload" noPadding>
        {data ? (
          <CodeBlock code={data} language="json" variant="seamless" padding="15px" />
        ) : (
          <Text size="2" color="gray600">
            This event has no payload.
          </Text>
        )}
      </Box>

      <Spacer size={30} />

      {chatEvent.data.type === 'chat.invocation.failed' ? (
        <ProviderInvocationByChatEventId chatEventId={chatEvent.data.id} />
      ) : null}
    </DetailsOverviewLayout>
  ));
};
