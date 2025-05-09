import { describe, expect, test } from 'vitest';
import { ipInfo } from './ip';

describe('ipInfo', () => {
  test('getMany returns correct IP info', async () => {
    let ips = ['8.8.8.8', '1.1.1.1'];
    let expected = [
      {
        ip: '8.8.8.8',
        country: 'US',
        countryName: 'United States',
        asn: 'AS15169',
        organization: 'GOOGLE',
        timezone: 'America/Chicago'
      },
      {
        ip: '1.1.1.1',
        asn: 'AS13335',
        organization: 'CLOUDFLARENET'
      }
    ];
    let result = await ipInfo.getMany(ips);
    expect(result).toMatchObject(expected);
  });

  test('get returns correct IP info', async () => {
    let ip = '8.8.8.8';
    let expected = {
      ip: '8.8.8.8',
      country: 'US',
      asn: 'AS15169',
      organization: 'GOOGLE',
      countryName: 'United States',
      timezone: 'America/Chicago'
    };
    let result = await ipInfo.get(ip);
    expect(result).toMatchObject(expected);
  });
});
