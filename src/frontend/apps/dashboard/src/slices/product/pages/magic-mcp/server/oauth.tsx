import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useMagicMcpServer,
  useProviderConnection,
  useServerDeployment
} from '@metorial/state';
import { Button, Callout, Spacer, toast } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { FormPage } from '../../../scenes/form/page';
import { ProviderConnectionUpdateForm } from '../../../scenes/providerConnection/updateForm';
import { authenticateWithOauth } from '../../explorer/state';

export let MagicMcpServerOauthPage = () => {
  let instance = useCurrentInstance();

  let { magicMcpServerId } = useParams();
  let magicMcpServer = useMagicMcpServer(instance.data?.id, magicMcpServerId);
  let updateMutation = magicMcpServer.useUpdateMutator();
  let deployment = useServerDeployment(
    instance.data?.id,
    magicMcpServer.data?.serverDeployments[0]?.id
  );
  let oauthConnection = useProviderConnection(
    instance.data?.id,
    deployment.data?.oauthConnection?.id
  );

  return renderWithLoader({ deployment, oauthConnection })(
    ({ deployment, oauthConnection }) => (
      <>
        <FormPage>
          <MagicMcpServerOauthCallout />

          <ProviderConnectionUpdateForm providerConnection={oauthConnection.data} hideDelete />
        </FormPage>
      </>
    )
  );
};

export let MagicMcpServerOauthCallout = ({ noSpacer }: { noSpacer?: boolean }) => {
  let instance = useCurrentInstance();

  let { magicMcpServerId } = useParams();
  let magicMcpServer = useMagicMcpServer(instance.data?.id, magicMcpServerId);
  let updateMutation = magicMcpServer.useUpdateMutator();
  let deployment = useServerDeployment(
    instance.data?.id,
    magicMcpServer.data?.serverDeployments[0]?.id
  );

  if (!deployment.data?.oauthConnection) return;

  return (
    <>
      {noSpacer && <Spacer height={15} />}

      <Box
        title="Default OAuth Connection"
        description={
          <>
            Set up a default oauth connection for this Magic MCP server. This connection will
            be used for all sessions created without an explicit OAuth session. You can also
            pass an <code style={{ fontSize: '14px' }}>oauth_session_id</code> query parameter
            to the MCP request to use a specific OAuth session.
          </>
        }
      >
        {magicMcpServer.data?.needsDefaultOauthSession && (
          <>
            <Callout color="red">
              You don't have a default OAuth connection set up for this Magic MCP server. This
              means that you will need to pass an OAuth connection id to every MCP request.
            </Callout>
            <Spacer size={15} />
          </>
        )}

        <Button
          onClick={async () => {
            try {
              let oauthSessionId = await authenticateWithOauth({
                instanceId: instance.data?.id!,
                serverDeploymentId: deployment.data?.id!
              });

              await updateMutation.mutate({
                defaultOauthSessionId: oauthSessionId
              });

              toast.success('OAuth connection set as default for this Magic MCP server.');
            } catch (e) {
              toast.error('OAuth authentication failed. Please try again.');
            }
          }}
          size="2"
        >
          {magicMcpServer.data?.needsDefaultOauthSession
            ? 'Set up OAuth Connection'
            : 'Update OAuth Connection'}
        </Button>
      </Box>
    </>
  );
};
