import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCustomProvider } from '@metorial/state';
import { Attributes, Badge, Button, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, ID, SideBox } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import { CustomServerEventsTable } from '../../../scenes/customProvider/events';

export let CustomProviderOverviewPage = () => {
  let instance = useCurrentInstance();

  let navigate = useNavigate();

  let { customServerId } = useParams();
  let customServer = useCustomProvider(instance.data?.id, customServerId);
  let isExternalProvider = Boolean(customServer.data?.draft?.remoteMcpServer);

  return renderWithLoader({ customServer })(({ customServer }) => (
    <>
      <Attributes
        columns={3}
        attributes={[
          {
            label: 'Name',
            content: customServer.data.name
          },
          {
            label: 'Status',
            content: customServer.data.status ? (
              <Badge
                color={
                  customServer.data.status === 'active'
                    ? 'green'
                    : customServer.data.status === 'archived'
                      ? 'gray'
                      : 'blue'
                }
              >
                {customServer.data.status}
              </Badge>
            ) : (
              'Unknown'
            )
          },
          {
            label: 'Provider ID',
            content: customServer.data.provider ? (
              <ID id={customServer.data.provider.id} />
            ) : (
              'N/A'
            )
          },
          {
            label: 'Current Version',
            content: customServer.data.provider?.currentVersion?.version ?? 'N/A'
          },
          {
            label: 'Publisher',
            content: customServer.data.provider?.publisher?.name ?? 'N/A'
          },
          {
            label: 'Created At',
            content: <RenderDate date={customServer.data.createdAt!} />
          },
          ...(isExternalProvider
            ? [
                {
                  label: 'Remote URL',
                  content: (
                    <Text size="2" style={{ overflowWrap: 'anywhere' }}>
                      {customServer.data.draft?.remoteMcpServer?.url ?? 'N/A'}
                    </Text>
                  )
                },
                {
                  label: 'Transport',
                  content: customServer.data.draft?.remoteMcpServer?.transport ?? 'N/A'
                }
              ]
            : [])
        ]}
      />

      <Spacer height={15} />

      <SideBox
        title="Test Provider"
        description="Use the Metorial Explorer to test your custom provider."
      >
        <Button
          as="span"
          size="2"
          disabled={!customServer.data.provider?.id}
          onClick={async () => {
            navigate(
              Paths.instance.explorer(
                instance.data?.organization,
                instance.data?.project,
                instance.data,
                { provider_id: customServer.data.provider?.id }
              )
            );
          }}
        >
          Test Provider
        </Button>
      </SideBox>

      <Spacer height={15} />

      <Box
        title="Provider Commits"
        description="Recent commit/apply history for this provider."
      >
        <CustomServerEventsTable customServer={customServer.data} />
      </Box>
    </>
  ));
};
