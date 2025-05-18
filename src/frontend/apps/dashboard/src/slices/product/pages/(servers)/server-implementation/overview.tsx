import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useServerImplementation } from '@metorial/state';
import { Attributes, RenderDate, Spacer } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { UsageScene } from '../../../scenes/usage/usage';

export let ServerImplementationOverviewPage = () => {
  let instance = useCurrentInstance();

  let { serverImplementationId } = useParams();
  let implementation = useServerImplementation(instance.data?.id, serverImplementationId);

  return renderWithLoader({ implementation })(({ implementation }) => (
    <>
      <Attributes
        attributes={[
          {
            label: 'Name',
            content: implementation.data.name ?? implementation.data.server.name
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

      <UsageScene
        title="Usage"
        description="See how this server implementation is being used in your project."
        entities={[{ type: 'implementation', id: implementation.data.id }]}
        entityNames={{ [implementation.data.id]: implementation.data.name! }}
      />
    </>
  ));
};
