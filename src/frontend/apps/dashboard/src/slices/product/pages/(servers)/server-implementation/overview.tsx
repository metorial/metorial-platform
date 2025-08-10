import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useServerImplementation } from '@metorial/state';
import { Attributes, Button, RenderDate, Spacer } from '@metorial/ui';
import { ID, SideBox } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { UsageScene } from '../../../scenes/usage/usage';

export let ServerImplementationOverviewPage = () => {
  let instance = useCurrentInstance();

  let { serverImplementationId } = useParams();
  let implementation = useServerImplementation(instance.data?.id, serverImplementationId);

  return renderWithLoader({ implementation })(({ implementation }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'Name',
            content: implementation.data.name ?? implementation.data.server.name
          },
          {
            label: 'Server',
            content: implementation.data.server.name
          },
          {
            label: 'ID',
            content: <ID id={implementation.data.id} />
          },
          {
            label: 'Created At',
            content: <RenderDate date={implementation.data.createdAt!} />
          }
        ]}
      />

      <Spacer height={15} />

      <SideBox
        title="Test your implementation"
        description="Use the Metorial Explorer to test your server implementation."
      >
        <Link
          to={Paths.instance.explorer(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            {
              server_implementation_id: implementation.data?.id,
              server_id: implementation.data.server.id
            }
          )}
        >
          <Button as="span" size="2">
            Open Explorer
          </Button>
        </Link>
      </SideBox>

      <Spacer height={15} />

      <UsageScene
        title="Usage"
        description="See how this server implementation is being used in your project."
        entities={[{ type: 'server_implementation', id: implementation.data.id }]}
        entityNames={{ [implementation.data.id]: implementation.data.name! }}
      />
    </>
  ));
};
