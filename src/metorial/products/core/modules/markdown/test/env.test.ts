import { afterEach, describe, expect, it, vi } from 'vitest';

let load = async () => {
  vi.resetModules();
  return (await import('../src/env')).env;
};

afterEach(() => {
  delete process.env.METORIAL_EDITION;
  delete process.env.MARKDOWN_FIRST_PARTY_DOMAINS;
});

describe('markdown settings', () => {
  it('treats metorial.com as first party in the cloud edition', async () => {
    expect((await load()).links.MARKDOWN_FIRST_PARTY_DOMAINS).toEqual(['metorial.com']);
  });

  it('has no first party domains by default on-prem', async () => {
    process.env.METORIAL_EDITION = 'on-prem';

    expect((await load()).links.MARKDOWN_FIRST_PARTY_DOMAINS).toEqual([]);
  });

  it('accepts a configured list', async () => {
    process.env.MARKDOWN_FIRST_PARTY_DOMAINS = 'example.com, docs.example.com';

    expect((await load()).links.MARKDOWN_FIRST_PARTY_DOMAINS).toEqual([
      'example.com',
      'docs.example.com'
    ]);
  });
});
