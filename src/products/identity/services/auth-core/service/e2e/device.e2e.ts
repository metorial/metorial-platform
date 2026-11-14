import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { anonymousAuth } from './client';
import { createApp, createDevice } from './fixtures';

describe('ares device', () => {
  it('creates a new device when none is provided', async () => {
    let device = await anonymousAuth.device.ensure({});

    expect(device.deviceId).toBeTruthy();
    expect(device.clientSecret).toBeTruthy();

    let row = await db.authDevice.findUniqueOrThrow({ where: { id: device.deviceId } });
    expect(row.clientSecret).toBe(device.clientSecret);
  });

  it('reuses a device when the secret matches', async () => {
    let device = await createDevice();

    let again = await anonymousAuth.device.ensure({
      deviceId: device.deviceId,
      clientSecret: device.clientSecret
    });

    expect(again).toEqual({ deviceId: device.deviceId, clientSecret: device.clientSecret });
  });

  it('issues a new device when the secret is wrong', async () => {
    let device = await createDevice();

    let other = await anonymousAuth.device.ensure({
      deviceId: device.deviceId,
      clientSecret: 'not-the-secret'
    });

    expect(other.deviceId).not.toBe(device.deviceId);
    expect(other.clientSecret).not.toBe(device.clientSecret);
  });

  it('lists no logged-in users for a fresh device', async () => {
    let app = await createApp();
    let device = await createDevice();

    let users = await device.auth.device.getLoggedInUsers({
      clientId: app.clientId,
      deviceId: device.deviceId,
      clientSecret: device.clientSecret
    });

    expect(users).toEqual([]);
  });

  it('boots with the app auth options and no users', async () => {
    let app = await createApp();
    let device = await createDevice();

    let boot = await device.auth.authentication.boot({ clientId: app.clientId });

    expect(boot.client).toMatchObject({ type: 'app', clientId: app.clientId, account: null });
    expect(boot.defaultRedirectUrl).toBe(app.defaultRedirectUrl);
    expect(boot.users).toEqual([]);
    expect(boot.options.length).toBeGreaterThan(0);
  });

  it('rejects boot for an unknown client', async () => {
    let device = await createDevice();
    await expect(
      device.auth.authentication.boot({ clientId: 'unknown_client' })
    ).rejects.toThrow();
  });
});
