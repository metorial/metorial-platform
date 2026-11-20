import { checkEdition } from '@metorial/editions';
import { egressSettings } from '../env';

// The cloud edition always connects directly; only on-prem routes through the egress gateway.
export let isGatewayEgress = () => checkEdition('on-prem') && egressSettings.mode == 'gateway';
