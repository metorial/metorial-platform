import { ipInfo as geoIpInfo, type IPInfo } from '@lowerdeck/ip-info';
import { checkEdition } from '@metorial/editions';

export type { IPInfo };

export let ipInfo = {
  getMany: async (ips: string[]): Promise<IPInfo[]> =>
    checkEdition('cloud') ? await geoIpInfo.getMany(ips) : [],

  get: async (ip: string): Promise<IPInfo | undefined> =>
    checkEdition('cloud') ? await geoIpInfo.get(ip) : undefined,

  getSafe: async (ip: string): Promise<IPInfo | undefined> =>
    checkEdition('cloud') ? await geoIpInfo.getSafe(ip) : undefined
};
