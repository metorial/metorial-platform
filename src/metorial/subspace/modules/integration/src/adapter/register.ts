import { registerIntegrationTransactionListener } from '../listeners';
import { adapterCoordinationListener } from './listener';

let registered = false;

export let registerAdapterCoordinationListener = () => {
  if (registered) return;
  registered = true;
  registerIntegrationTransactionListener(adapterCoordinationListener);
};

registerAdapterCoordinationListener();
