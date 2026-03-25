import { useParams } from 'react-router-dom';
import { CallbackDestinationsList } from '../../scenes/callbacks/destinations';

export let CallbackDestinationsPage = () => {
  let { callbackId } = useParams();

  return <CallbackDestinationsList callbackId={callbackId} />;
};
