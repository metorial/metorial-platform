import { request } from './request';
import { clientBuilder } from './shared/clientBuilder';

export type { ClientOpts } from './shared/clientBuilder';
export { getRpcRequestDiagnostics } from './request';

export let createClient = clientBuilder(request);
