import { restServer } from './rest';
import { apiVersions } from './versions';

export let apiServer = restServer.launch(apiVersions);
