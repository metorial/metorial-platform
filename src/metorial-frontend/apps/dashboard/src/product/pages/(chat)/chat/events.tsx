import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsTableLayout } from '@metorial/details-layout';
import { useChat, useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ChatEventsTable } from '../../../scenes/chat/eventsTable';

export let ChatEventsPage = () => {
  let instance = useCurrentInstance();
  let { chatId } = useParams();
  let chat = useChat(instance.data?.id, chatId);

  return renderWithLoader({ chat })(({ chat }) => (
    <DetailsTableLayout
      title="Events"
      description="Everything the chat provider has reported for this chat, newest first."
    >
      <ChatEventsTable instanceId={instance.data!.id} chatId={chat.data.id} />
    </DetailsTableLayout>
  ));
};
