import { describe, expect, it } from 'vitest';
import { consumerConsumerDevicePresenter, v1ConsumerDevicePresenter } from './consumerDevice';

let context = {
  apiVersion: 'mt_2026_04_01_consumer',
  accessType: 'user_auth_token'
} as const;

let consumerDevice = {
  id: 'codv_1',
  status: 'active',
  name: "Ada's MacBook Pro",
  os: 'macos',
  arch: 'aarch64',
  appVersion: '0.2.0',
  clients: [],
  consumerProfile: { id: 'cpr_1' },
  lastSeenAt: new Date(),
  revokedAt: null,
  createdAt: new Date(),
  updatedAt: new Date()
} as any;

describe('consumer device telemetry', () => {
  it('shows the telemetry state to the consumer', async () => {
    let device = await consumerConsumerDevicePresenter
      .present({ consumerDevice, telemetry: { enabled: true, tokenId: 'git_1' } }, context)
      .run();

    expect(device).toMatchObject({
      object: 'consumer.device',
      id: 'codv_1',
      telemetry: { enabled: true, token_id: 'git_1' }
    });
  });

  it('keeps the telemetry state out of the public and dashboard device', async () => {
    let device = await v1ConsumerDevicePresenter
      .present(
        { consumerDevice, telemetry: { enabled: true, tokenId: 'git_1' } },
        { ...context, apiVersion: 'mt_2026_01_01_magnetar' }
      )
      .run();

    expect(device).not.toHaveProperty('telemetry');
  });

  it('refuses to present a consumer device without its telemetry state', async () => {
    await expect(
      consumerConsumerDevicePresenter.present({ consumerDevice }, context).run()
    ).rejects.toThrow('telemetry state');
  });
});
