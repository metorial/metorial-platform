import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useCustomServer } from '@metorial/state';
import { Attributes, RenderDate, Spacer } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { CustomServerEventsTable } from '../../../scenes/customServer/events';
import { UsageScene } from '../../../scenes/usage/usage';

export let CustomServerOverviewPage = () => {
  let instance = useCurrentInstance();

  let { customServerId } = useParams();
  let customServer = useCustomServer(instance.data?.id, customServerId);

  return renderWithLoader({ customServer })(({ customServer }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'Name',
            content: customServer.data.name
          },
          {
            label: 'Type',
            content: {
              remote: 'Remote Server'
            }[customServer.data.type]
          },
          {
            label: 'ID',
            content: <ID id={customServer.data.id} />
          },
          {
            label: 'Created At',
            content: <RenderDate date={customServer.data.createdAt!} />
          }
        ]}
      />

      <Spacer height={15} />

      <UsageScene
        title="Usage"
        description="See how often this custom server is used."
        entities={[{ type: 'server', id: customServer.data.server.id }]}
        entityNames={{ [customServer.data.server.id]: customServer.data.name! }}
      />

      <Spacer height={15} />

      <Box title="Server Events" description="Important events about this custom server.">
        <CustomServerEventsTable customServer={customServer.data} />
      </Box>
    </>
  ));
};
