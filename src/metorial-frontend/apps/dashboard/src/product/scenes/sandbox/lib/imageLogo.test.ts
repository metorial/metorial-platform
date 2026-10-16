import { describe, expect, it } from 'vitest';
import { detectImageLogo, getSandboxImageLogoUrl, tokenizeImageText } from './imageLogo';

let logoName = (input: Parameters<typeof detectImageLogo>[0]) =>
  detectImageLogo(input)?.name ?? null;

describe('detectImageLogo', () => {
  it('strips trailing version digits from tokens', () => {
    expect(logoName('python3')).toBe('python');
    expect(logoName('node22')).toBe('node');
    expect(logoName('Python 3.12')).toBe('python');
  });

  it('matches whole tokens only', () => {
    expect(logoName('ubuntu')).toBe('ubuntu');
    expect(logoName('mongo')).toBeNull();
    expect(logoName('bunker')).toBeNull();
    expect(logoName('django-app')).toBeNull();
  });

  it('prefers runtimes over distributions', () => {
    expect(logoName('Node 22 (Alpine)')).toBe('node');
    expect(logoName('Ubuntu 24.04')).toBe('ubuntu');
    expect(logoName('python-3.12-bookworm')).toBe('python');
    expect(logoName('debian-bookworm')).toBe('debian');
  });

  it('rewrites .NET as dotnet', () => {
    expect(logoName('.NET 8')).toBe('dotnet');
    expect(logoName('ASP.NET Core')).toBe('dotnet');
    expect(logoName('mcr.microsoft.com/dotnet/sdk:8.0')).toBe('dotnet');
    expect(logoName('my.network')).toBeNull();
    expect(tokenizeImageText('.NET 8').has('dotnet')).toBe(true);
  });

  it('recognises aliases', () => {
    expect(logoName('golang:1.23')).toBe('go');
    expect(logoName('eclipse-temurin-21')).toBe('java');
    expect(logoName('Rails app')).toBe('ruby');
    expect(logoName('jammy')).toBe('ubuntu');
    expect(logoName('trixie')).toBe('debian');
  });

  it('runs on name plus identifier', () => {
    expect(logoName({ name: 'My Worker', identifier: 'deno-2' })).toBe('deno');
    expect(logoName({ name: 'Bun Runtime', identifier: null })).toBe('bun');
    expect(logoName({ name: null, identifier: null })).toBeNull();
    expect(logoName(null)).toBeNull();
    expect(logoName('Custom image')).toBeNull();
  });

  it('builds logo urls with the right extension', () => {
    expect(getSandboxImageLogoUrl('debian')).toBe(
      'https://provider-logos.metorial-cdn.com/sandbox/debian.png'
    );
    expect(detectImageLogo('node')?.url).toBe(
      'https://provider-logos.metorial-cdn.com/sandbox/node.svg'
    );
  });
});
