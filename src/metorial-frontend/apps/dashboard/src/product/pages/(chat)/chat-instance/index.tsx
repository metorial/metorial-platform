import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import { useChatInstance, useChatInstanceProvider, useCurrentInstance } from '@metorial/state';
import { Button, Datalist, Spacer } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import {
  ChatInstanceConnectedAsSection,
  showChatInstanceProviderConfigPanelFlow
} from '../../../scenes/chat/instanceConfigPanel';

export let ChatInstanceOverviewPage = () => {
  let instance = useCurrentInstance();
  let { chatInstanceId } = useParams();
  let chatInstance = useChatInstance(instance.data?.id, chatInstanceId);
  let chatInstanceProvider = useChatInstanceProvider(instance.data?.id, chatInstance.data?.id);

  return renderWithLoader({ chatInstance })(({ chatInstance }) => (
    <DetailsOverviewLayout>
      <ChatInstanceConnectedAsSection
        instanceId={instance.data!.id}
        chatInstanceId={chatInstance.data.id}
      />

      <Spacer height={20} />

      <Box
        title="Configuration"
        description="The provider config and chat account auth this instance uses."
        rightActions={
          <Button
            size="2"
            onClick={() =>
              showChatInstanceProviderConfigPanelFlow({
                instanceId: instance.data!.id,
                chatInstanceId: chatInstance.data.id
              })
            }
          >
            Change Configuration
          </Button>
        }
      >
        <Datalist
          items={[
            {
              label: 'Config',
              value: chatInstanceProvider.data?.config ? (
                <ID id={chatInstanceProvider.data.config.id} />
              ) : (
                <>-</>
              )
            },
            {
              label: 'Auth Config',
              value: chatInstanceProvider.data?.authConfig ? (
                <ID id={chatInstanceProvider.data.authConfig.id} />
              ) : (
                <>-</>
              )
            }
          ]}
        />
      </Box>
    </DetailsOverviewLayout>
  ));
};
