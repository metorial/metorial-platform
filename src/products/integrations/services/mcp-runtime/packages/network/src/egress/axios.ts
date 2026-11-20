import { getAxiosSsrfFilter } from '../http/axiosSsrf';
import type { EgressContext } from './context';
import { getGatewayAxiosAgents } from './gateway';
import { isGatewayEgress } from './mode';

export let getAxiosEgressOptions = (url: string, egress: EgressContext) =>
  isGatewayEgress() ? getGatewayAxiosAgents(egress) : getAxiosSsrfFilter(url);
