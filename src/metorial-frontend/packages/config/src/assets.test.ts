import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAvatarUrl,
  getFaviconUrl,
  getMetorialLogoUrl,
  getProviderLogoUrl,
  isGeneratedAvatarUrl,
  resolveImageUrl
} from './assets';
import { loadRuntimeConfig } from './runtime';

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({})));
  await loadRuntimeConfig();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('frontend assets', () => {
  it('preserves cloud image URLs', () => {
    vi.stubEnv('METORIAL_EDITION', 'cloud');

    expect(getAvatarUrl('ptl_123')).toBe('https://avatar-cdn.metorial.com/ptl_123');
    expect(getProviderLogoUrl('slack.svg')).toBe(
      'https://provider-logos.metorial-cdn.com/slack.svg'
    );
    expect(getFaviconUrl('https://example.com')).toBe(
      'https://favicons.metorial-cdn.com/?url=https%3A%2F%2Fexample.com'
    );
    expect(resolveImageUrl('https://provider-logos.metorial-cdn.com/slack.svg')).toBe(
      'https://provider-logos.metorial-cdn.com/slack.svg'
    );
  });

  it('uses local avatars on-prem, including legacy API image URLs', () => {
    vi.stubEnv('METORIAL_EDITION', 'on-prem');

    expect(getAvatarUrl('ptl_123')).toBe('/assets/avatars/ptl_123');
    for (let host of ['avatar-cdn.metorial.com', 'avatar.metorial-cdn.com']) {
      expect(resolveImageUrl(`https://${host}/ptl_123`)).toBe('/assets/avatars/ptl_123');
    }
  });

  it('uses embedded branding and stable local placeholders for hosted images', () => {
    vi.stubEnv('METORIAL_EDITION', 'on-prem');

    expect(
      resolveImageUrl('https://cdn.metorial.com/2025/logos/metorial/primary_logo/raw.svg')
    ).toMatch(/^data:image\/svg\+xml,/);

    expect(getMetorialLogoUrl()).toMatch(/^data:image\/svg\+xml,/);
    expect(getProviderLogoUrl('slack.svg')).toBe(
      'https://provider-logos.metorial-cdn.com/slack.svg'
    );

    let images = [
      'https://cdn.metorial.com/provider-one.png',
      'https://cdn.metorial.com/provider-two.png'
    ];
    let resolved = images.map(resolveImageUrl);
    expect(resolved.every(url => url.startsWith('/assets/avatars/image_'))).toBe(true);
    expect(new Set(resolved).size).toBe(2);
    expect(images.map(resolveImageUrl)).toEqual(resolved);
  });

  it('preserves local uploads, customer images, and empty values', () => {
    vi.stubEnv('METORIAL_EDITION', 'on-prem');

    for (let value of [
      null,
      undefined,
      '',
      '/object-storage/upload.png',
      'blob:local-upload',
      'data:image/png;base64,abc',
      'https://customer.example/logo.png',
      'https://avatar.metorial-cdn.com.customer.example/logo.png'
    ]) {
      expect(resolveImageUrl(value)).toBe(value);
    }
  });

  it('recognizes generated avatars in upload controls on both editions', () => {
    for (let url of [
      '/assets/avatars/ptl_123',
      'https://install.example/assets/avatars/ptl_123',
      'https://avatar-cdn.metorial.com/ptl_123',
      'https://avatar.metorial-cdn.com/ptl_123'
    ]) {
      expect(isGeneratedAvatarUrl(url)).toBe(true);
    }

    expect(isGeneratedAvatarUrl('/object-storage/upload.png')).toBe(false);
    expect(isGeneratedAvatarUrl(null)).toBe(false);
  });

  it('reads the gateway avatar base from runtime config', async () => {
    vi.stubEnv('METORIAL_EDITION', 'on-prem');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          VITE_AVATAR_BASE_URL: 'https://install.example/assets/avatars/'
        })
      )
    );
    await loadRuntimeConfig();

    expect(getAvatarUrl('ptl_123')).toBe('https://install.example/assets/avatars/ptl_123');
    expect(resolveImageUrl('https://avatar.metorial-cdn.com/ptl_123')).toBe(
      'https://install.example/assets/avatars/ptl_123'
    );
  });

  it('proxies external images through the gateway when enabled', async () => {
    vi.stubEnv('METORIAL_EDITION', 'on-prem');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ VITE_CAMO_BASE_URL: 'https://install.example/assets/camo' })
        )
    );
    await loadRuntimeConfig();

    expect(resolveImageUrl('https://customer.example/logo.png')).toBe(
      'https://install.example/assets/camo?url=https%3A%2F%2Fcustomer.example%2Flogo.png'
    );
    expect(resolveImageUrl('https://provider-logos.metorial-cdn.com/slack.svg')).toBe(
      'https://provider-logos.metorial-cdn.com/slack.svg'
    );

    let faviconUrl = 'https://favicons.metorial-cdn.com/?url=https%3A%2F%2Fexample.com';
    expect(getFaviconUrl('https://example.com')).toBe(faviconUrl);
    expect(resolveImageUrl(faviconUrl)).toBe(faviconUrl);

    for (let value of [
      null,
      '',
      '/object-storage/upload.png',
      'blob:local-upload',
      'data:image/png;base64,abc',
      'https://install.example/object-storage/upload.png'
    ]) {
      expect(resolveImageUrl(value)).toBe(value);
    }
  });
});
