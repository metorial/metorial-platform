import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsTableLayout } from '@metorial/details-layout';
import { useChatConnection, useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ChatsTable } from '../../../scenes/chat/chatsTable';

export let ChatConnectionChatsPage = () => {
  let instance = useCurrentInstance();
  let { chatConnectionId } = useParams();
  let chatConnection = useChatConnection(instance.data?.id, chatConnectionId);

  return renderWithLoader({ chatConnection })(({ chatConnection }) => (
    <DetailsTableLayout
      title="Chats"
      description="The chats that are connected to this chat connection."
    >
      <ChatsTable instanceId={instance.data!.id} chatConnectionId={chatConnection.data.id} />
    </DetailsTableLayout>
  ));
};
