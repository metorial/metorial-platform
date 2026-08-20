import { useParams } from 'react-router-dom';
import { CallbackSettings } from '../../scenes/callbacks/settings';

export let CallbackSettingsPage = () => {
  let { callbackId } = useParams();

  return <CallbackSettings callbackId={callbackId} />;
};
