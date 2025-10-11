import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useCustomServer } from '@metorial/state';
import { Attributes, Button, RenderDate, Spacer } from '@metorial/ui';
import { Box, ID, SideBox } from '@metorial/ui-product';
import { RiExternalLinkLine } from '@remixicon/react';
import { useNavigate, useParams } from 'react-router-dom';
import { CustomServerEventsTable } from '../../../scenes/customServer/events';
import { UsageScene } from '../../../scenes/usage/usage';

export let CustomServerOverviewPage = () => {
  let instance = useCurrentInstance();

  let navigate = useNavigate();

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
              remote: 'Remote Server',
              managed: 'Managed Server'
            }[customServer.data.type]
          },
          {
            label: 'Server ID',
            content: <ID id={customServer.data.server.id} />
          },

          ...(customServer.data.repository
            ? [
                {
                  label: 'Repository',
                  content: (
                    <a
                      href={customServer.data.repository.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'unset' }}
                    >
                      {customServer.data.repository.owner}/{customServer.data.repository.name}
                      <RiExternalLinkLine size={18} />
                    </a>
                  )
                }
              ]
            : [
                {
                  label: 'Created At',
                  content: <RenderDate date={customServer.data.createdAt!} />
                }
              ])
        ]}
      />

      <Spacer height={15} />

      <SideBox
        title="Test Server"
        description="Use the Metorial Explorer to test your custom server."
      >
        <Button
          as="span"
          size="2"
          onClick={async () => {
            navigate(
              Paths.instance.explorer(
                instance.data?.organization,
                instance.data?.project,
                instance.data,
                { server_id: customServer.data.server.id }
              )
            );
          }}
        >
          Test Server
        </Button>
      </SideBox>

      <Spacer height={15} />

      <UsageScene
        title="Usage"
        description="See how often this custom server is used."
        entities={[{ type: 'server', id: customServer.data.server.id }]}
        entityNames={{ [customServer.data.server.id]: customServer.data.name! }}
      />

      <Spacer height={15} />

      <Box title="Server Events" description="Important events about this custom server.">
        <CustomServerEventsTable customServer={customServer.data as any} />
      </Box>
    </>
  ));
};
