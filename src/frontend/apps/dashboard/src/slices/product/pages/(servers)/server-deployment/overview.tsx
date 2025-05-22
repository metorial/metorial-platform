import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useServerDeployment } from '@metorial/state';
import { Attributes, Button, RenderDate, Spacer } from '@metorial/ui';
import { ID, SideBox } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
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

      <SideBox
        title="Test your deployment"
        description="Use the Metorial Explorer to test your server deployment."
      >
        <Link
          to={Paths.instance.explorer(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            { server_deployment_id: deployment.data?.id }
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
        description="See how this server deployment is being used in your project."
        entities={[{ type: 'server_deployment', id: deployment.data.id }]}
        entityNames={{ [deployment.data.id]: deployment.data.name! }}
      />
    </>
  ));
};
