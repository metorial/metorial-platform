import { useCurrentInstance, useServerDeployment } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { CallbackOverview } from '../../../../scenes/callbacks/overview';

export let ServerDeploymentCallbackOverviewPage = () => {
  let instance = useCurrentInstance();
  let { serverDeploymentId } = useParams();
  let deployment = useServerDeployment(instance.data?.id, serverDeploymentId);

  return <CallbackOverview callbackId={deployment.data?.callback?.id} />;
};
