import { useParams } from 'react-router-dom';
import { CallbackEventsList } from '../../scenes/callbacks/events';

export let CallbackEventsPage = () => {
  let { callbackId } = useParams();

  return <CallbackEventsList callbackId={callbackId} />;
};
