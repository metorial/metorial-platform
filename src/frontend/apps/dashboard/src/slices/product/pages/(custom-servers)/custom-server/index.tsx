import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCustomServer } from '@metorial/state';
import { Attributes, Badge, Button, RenderDate, Spacer } from '@metorial/ui';
import { Box, ID, SideBox } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import { CustomServerEventsTable } from '../../../scenes/customServer/events';

export let CustomServerOverviewPage = () => {
  let instance = useCurrentInstance();

  let navigate = useNavigate();

  let { customServerId } = useParams();
  let customServer = useCustomServer(instance.data?.id, customServerId);

  return renderWithLoader({ customServer })(({ customServer }) => (
    <>
      <Attributes
        itemWidth="380px"
        attributes={[
          {
            label: 'Name',
            content: customServer.data.name
          },
          {
            label: 'Status',
            content: customServer.data.status ? (
              <Badge color={customServer.data.status === 'active' ? 'green' : customServer.data.status === 'archived' ? 'gray' : 'blue'}>
                {customServer.data.status}
              </Badge>
            ) : 'Unknown'
          },
          {
            label: 'Provider ID',
            content: customServer.data.provider ? <ID id={customServer.data.provider.id} /> : 'N/A'
          },
          ...(customServer.data.provider?.currentVersion ? [{
            label: 'Current Version',
            content: customServer.data.provider.currentVersion.version
          }] : []),
          ...(customServer.data.provider?.publisher ? [{
            label: 'Publisher',
            content: customServer.data.provider.publisher.name
          }] : []),
          {
            label: 'Created At',
            content: <RenderDate date={customServer.data.createdAt!} />
          }
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

      <Box title="Provider Events" description="Important events about this provider.">
        <CustomServerEventsTable customServer={customServer.data as any} />
      </Box>
    </>
  ));
};
