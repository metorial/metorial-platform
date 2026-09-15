import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsTableLayout } from '@metorial/details-layout';
import { useChatInstance, useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ChatEventsTable } from '../../../scenes/chat/eventsTable';

export let ChatInstanceEventsPage = () => {
  let instance = useCurrentInstance();
  let { chatInstanceId } = useParams();
  let chatInstance = useChatInstance(instance.data?.id, chatInstanceId);

  return renderWithLoader({ chatInstance })(({ chatInstance }) => (
    <DetailsTableLayout
      title="Events"
      description="Everything the chat provider has reported for this instance, newest first."
    >
      <ChatEventsTable instanceId={instance.data!.id} chatInstanceId={chatInstance.data.id} />
    </DetailsTableLayout>
  ));
};
