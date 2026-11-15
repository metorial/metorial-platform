import { afterEach, describe, expect, it, vi } from 'vitest';

let load = async () => {
  vi.resetModules();
  return (await import('../src')).branding;
};

afterEach(() => {
  delete process.env.METORIAL_EDITION;
  delete process.env.METORIAL_PUBLIC_URL;
  delete process.env.METORIAL_LOGO_URL;
});

describe('branding', () => {
  it('keeps the cloud URLs unchanged', async () => {
    let branding = await load();

    expect(branding.logoUrl).toBe(
      'https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg'
    );
    expect(branding.monoLogoUrl).toBe('https://cdn.metorial.com/metorial-bw.svg');
    expect(branding.avatarUrl('aimg_123')).toBe('https://avatar-cdn.metorial.com/aimg_123');
  });

  it('serves on-prem assets from the app host', async () => {
    process.env.METORIAL_EDITION = 'on-prem';
    process.env.METORIAL_PUBLIC_URL = 'https://metorial.example.com';

    let branding = await load();

    expect(branding.logoUrl).toBe(
      'https://metorial.example.com/assets/logos/metorial/primary_logo/raw.svg'
    );
    expect(branding.avatarUrl('aimg_123')).toBe(
      'https://metorial.example.com/assets/avatars/aimg_123'
    );
  });

  it('lets operators override a single URL', async () => {
    process.env.METORIAL_LOGO_URL = 'https://assets.example.com/logo.svg';

    let branding = await load();

    expect(branding.logoUrl).toBe('https://assets.example.com/logo.svg');
  });
});
