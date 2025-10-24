import { useCurrentInstance, useServerDeployment } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { CallbackDestinationsList } from '../../../../scenes/callbacks/destinations';

export let ServerDeploymentCallbackDestinationsPage = () => {
  let instance = useCurrentInstance();

  let { serverDeploymentId } = useParams();
  let deployment = useServerDeployment(instance.data?.id, serverDeploymentId);

  return <CallbackDestinationsList callbackId={deployment.data?.callback?.id} />;
};
