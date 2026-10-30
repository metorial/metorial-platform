import { v } from '@lowerdeck/validation';
import { setting } from '@metorial/settings';

export let serviceUrlEnvs = {
  voyager: 'VOYAGER_URL',
  nebula: 'NEBULA_API_URL',
  relay: 'RELAY_URL',
  shuttle: 'SHUTTLE_URL',
  origin: 'ORIGIN_URL',
  functionBay: 'FUNCTION_BAY_API_URL',
  slatesHub: 'SLATES_HUB_URL'
} as const;

export type ServiceName = keyof typeof serviceUrlEnvs;

export let serviceUrl = (name: ServiceName) =>
  setting(v.string(), {
    env: serviceUrlEnvs[name],
    audience: 'deployment',
    description: `Internal URL of the ${name} service`
  });
