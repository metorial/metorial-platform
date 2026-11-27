import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsTableLayout } from '@metorial/details-layout';
import { useChatConnection, useCurrentInstance } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { ChatInstancesTable } from '../../../scenes/chat/instancesTable';

export let ChatConnectionInstancesPage = () => {
  let instance = useCurrentInstance();
  let { chatConnectionId } = useParams();
  let chatConnection = useChatConnection(instance.data?.id, chatConnectionId);

  return renderWithLoader({ chatConnection })(({ chatConnection }) => (
    <DetailsTableLayout
      title="Instances"
      description="Instance are chat accounts or identities that this connection can use."
    >
      <ChatInstancesTable
        instanceId={instance.data!.id}
        chatConnectionId={chatConnection.data.id}
      />
    </DetailsTableLayout>
  ));
};
