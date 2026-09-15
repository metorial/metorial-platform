import { PaginationSearchParamsProvider } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button } from '@metorial/ui';
import { Outlet, useNavigate } from 'react-router-dom';
import { showCreateChatConnectionFlow } from '../../../scenes/chat/connectionPanelFlow';

export let ChatListLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();

  return (
    <ContentLayout>
      <PageHeader
        title="Chat"
        description="Connect Metorial to chat providers like Slack, then connect agents to send and receive messages."
        actions={
          <Button
            size="2"
            onClick={() =>
              instance.data &&
              showCreateChatConnectionFlow({
                onCreate: chatConnection =>
                  navigate(
                    Paths.instance.chatConnection(
                      organization.data,
                      project.data,
                      instance.data,
                      chatConnection.id
                    )
                  )
              })
            }
          >
            Create Chat Connection
          </Button>
        }
      />

      <PaginationSearchParamsProvider enabled={true}>
        <Outlet />
      </PaginationSearchParamsProvider>
    </ContentLayout>
  );
};
