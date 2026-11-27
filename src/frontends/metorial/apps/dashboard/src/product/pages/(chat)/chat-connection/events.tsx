import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsTableLayout } from '@metorial/details-layout';
import { useChatConnection, useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ChatEventsTable } from '../../../scenes/chat/eventsTable';

export let ChatConnectionEventsPage = () => {
  let instance = useCurrentInstance();
  let { chatConnectionId } = useParams();
  let chatConnection = useChatConnection(instance.data?.id, chatConnectionId);

  return renderWithLoader({ chatConnection })(({ chatConnection }) => (
    <DetailsTableLayout
      title="Events"
      description="The events that have been sent or received through this chat connection."
    >
      <ChatEventsTable
        instanceId={instance.data!.id}
        chatConnectionId={chatConnection.data.id}
      />
    </DetailsTableLayout>
  ));
};
