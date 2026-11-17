import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sdkBuilder as consumerBuilder } from '../../metorial-consumer/src/builder';
import { sdkBuilder as dashboardBuilder } from './builder';

let token: string = JSON.parse(
  readFileSync(join(__dirname, '../../metorial-node/testdata/api-key-hosts.json'), 'utf8')
)[0].token;

let dashboard = dashboardBuilder.build((config: { apiHost?: string; apiKey?: string }) => ({
  ...config,
  apiVersion: '2025-01-01-dashboard'
}))(() => ({}));

let consumer = consumerBuilder.build((config: { apiHost?: string; apiKey?: string }) => ({
  ...config,
  apiVersion: '2026-04-01-consumer'
}))(() => ({}));

describe.each([
  { name: 'dashboard', create: dashboard },
  { name: 'consumer', create: consumer }
])('$name API host selection', ({ create }) => {
  it('uses the token host and records it in the resolved config', () => {
    expect(create({ apiKey: token })._config.apiHost).toBe('https://metorial.test/v1');
    expect(create({ apiKey: token, apiHost: undefined })._config.apiHost).toBe(
      'https://metorial.test/v1'
    );
  });

  it('preserves explicit overrides, including the cloud host', () => {
    for (let apiHost of ['https://override.test', 'https://api.metorial.com', '']) {
      expect(create({ apiKey: token, apiHost })._config.apiHost).toBe(apiHost);
    }
  });

  it('falls back for missing and opaque tokens', () => {
    expect(create({})._config.apiHost).toBe('https://api.metorial.com');
    expect(create({ apiKey: 'opaque' })._config.apiHost).toBe('https://api.metorial.com');
  });
});
