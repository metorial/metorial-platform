import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsSettingsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useChatInstance,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, confirm, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import { ChatInstanceSettingsSection } from '../../../scenes/chat/instanceConfigPanel';

export let ChatInstanceSettingsPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { chatInstanceId } = useParams();
  let chatInstance = useChatInstance(instance.data?.id, chatInstanceId);
  let navigate = useNavigate();
  let deleteMutator = chatInstance.useDeleteMutator();

  return renderWithLoader({ chatInstance })(({ chatInstance }) => (
    <DetailsSettingsLayout>
      <ChatInstanceSettingsSection
        instanceId={instance.data!.id}
        chatInstance={chatInstance.data}
      />

      <Spacer height={20} />

      <Box
        title="Danger Zone"
        description="Delete this instance and disconnect its chat account."
      >
        <Button
          size="2"
          color="red"
          loading={deleteMutator.isLoading}
          success={deleteMutator.isSuccess}
          onClick={() =>
            confirm({
              title: `Delete ${chatInstance.data.name}?`,
              description: `Are you sure you want to delete ${chatInstance.data.name}?`,
              onConfirm: async () => {
                let [res] = await deleteMutator.mutate(undefined as never);
                if (res) {
                  navigate(
                    Paths.instance.chatConnection(
                      organization.data,
                      project.data,
                      instance.data,
                      chatInstance.data.chatConnectionId,
                      'instances'
                    )
                  );
                }
              }
            })
          }
        >
          Delete Instance
        </Button>
      </Box>
    </DetailsSettingsLayout>
  ));
};
