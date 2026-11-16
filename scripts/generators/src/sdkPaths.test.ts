import { describe, expect, test } from 'bun:test';
import { findSdkPathCollisions } from './sdkPaths';

let endpoint = (...sdkPaths: string[]) => ({
  allPaths: sdkPaths.map(sdkPath => ({ path: `/${sdkPath}`, sdkPath }))
});

describe('findSdkPathCollisions', () => {
  test('reports SDK paths that only differ in how they are split', () => {
    expect(
      findSdkPathCollisions([
        endpoint('consumer.devices.list'),
        endpoint('consumerDevices.list', 'management.instance.consumerDevices.list'),
        endpoint('consumers.devices.get')
      ])
    ).toEqual([['consumer.devices.list', 'consumerDevices.list']]);
  });

  test('allows several endpoints to share one SDK path', () => {
    expect(
      findSdkPathCollisions([endpoint('sessions.get'), endpoint('sessions.get')])
    ).toEqual([]);
  });
});
