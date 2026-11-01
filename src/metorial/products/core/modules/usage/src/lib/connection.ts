import { checkEdition } from '@metorial/editions';

let cloud = checkEdition('cloud') ? await import('./connectionCloud') : undefined;

export let isUsageEnabled = () => (cloud ? cloud.isUsageEnabled() : true);

export let usageDbConnect = async () => (cloud ? cloud.usageDbConnect() : undefined);
