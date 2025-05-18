import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useServerDeployment } from '@metorial/state';
import { Attributes, RenderDate, Spacer } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { UsageScene } from '../../../scenes/usage/usage';

export let ServerDeploymentOverviewPage = () => {
  let instance = useCurrentInstance();

  let { serverDeploymentId } = useParams();
  let deployment = useServerDeployment(instance.data?.id, serverDeploymentId);

  return renderWithLoader({ deployment })(({ deployment }) => (
    <>
      <Attributes
        attributes={[
          {
            label: 'Name',
            content: deployment.data.name ?? deployment.data.server.name
          },
          {
            label: 'ID',
            content: <ID id={deployment.data.id} />
          },
          {
            label: 'Created At',
            content: <RenderDate date={deployment.data.createdAt!} />
          }
        ]}
      />

      <Spacer height={15} />

      <UsageScene
        title="Usage"
        description="See how this server deployment is being used in your project."
        entities={[{ type: 'deployment', id: deployment.data.id }]}
        entityNames={{ [deployment.data.id]: deployment.data.name! }}
      />
    </>
  ));
};
