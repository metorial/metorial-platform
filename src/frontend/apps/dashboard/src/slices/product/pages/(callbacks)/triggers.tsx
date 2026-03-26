import { useParams } from 'react-router-dom';
import { CallbackTriggersList } from '../../scenes/callbacks/triggers';

export let CallbackTriggersPage = () => {
  let { callbackId } = useParams();

  return <CallbackTriggersList callbackId={callbackId} />;
};
