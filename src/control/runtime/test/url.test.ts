import { describe, expect, it } from 'bun:test';
import type { DatabaseConfig } from '../src/config';
import { composeFromParts, redactUrl, resolveDatabaseUrl } from '../src/url';

let db: DatabaseConfig = {
  name: 'core',
  schema: '/app/db/core/schema',
  env: 'DATABASE_URL',
  parts: 'CORE_DB',
  query: 'schema=public&sslmode=no-verify'
};

let parts = {
  CORE_DB_USERNAME: 'user',
  CORE_DB_PASSWORD: 'secret',
  CORE_DB_HOST: 'db.internal',
  CORE_DB_PORT: '5432',
  CORE_DB_NAME: 'core'
};

describe('database urls', () => {
  it('composes a url from parts', () => {
    expect(composeFromParts(db, parts)).toBe(
      'postgres://user:secret@db.internal:5432/core?schema=public&sslmode=no-verify'
    );
  });

  it('returns nothing when a part is missing', () => {
    expect(composeFromParts(db, { ...parts, CORE_DB_HOST: undefined })).toBeUndefined();
  });

  it('prefers the url outside AWS mode', () => {
    expect(resolveDatabaseUrl(db, { ...parts, DATABASE_URL: 'postgres://explicit' })).toBe(
      'postgres://explicit'
    );
  });

  it('prefers the parts in AWS mode', () => {
    expect(
      resolveDatabaseUrl(db, {
        ...parts,
        AWS_MODE: 'true',
        DATABASE_URL: 'postgres://explicit'
      })
    ).toContain('db.internal');
  });

  it('keeps the url first when precedence is url', () => {
    expect(
      resolveDatabaseUrl(
        { ...db, precedence: 'url' },
        { ...parts, AWS_MODE: 'true', DATABASE_URL: 'postgres://explicit' }
      )
    ).toBe('postgres://explicit');
  });

  it('prefers the parts when precedence is parts', () => {
    expect(
      resolveDatabaseUrl(
        { ...db, precedence: 'parts' },
        { ...parts, DATABASE_URL: 'postgres://explicit' }
      )
    ).toContain('db.internal');
  });

  it('reads the first defined url and the first complete parts', () => {
    let multi: DatabaseConfig = {
      ...db,
      env: ['SERVICE_DATABASE_URL', 'DATABASE_URL'],
      parts: ['SERVICE_DB', 'CORE_DB']
    };

    expect(resolveDatabaseUrl(multi, { DATABASE_URL: 'postgres://shared' })).toBe(
      'postgres://shared'
    );
    expect(composeFromParts(multi, parts)).toContain('db.internal');
  });

  it('falls back to the url in AWS mode without parts', () => {
    expect(
      resolveDatabaseUrl(db, { AWS_MODE: 'true', DATABASE_URL: 'postgres://explicit' })
    ).toBe('postgres://explicit');
  });

  it('applies defaults and encoding', () => {
    let genesis: DatabaseConfig = {
      name: 'genesis',
      schema: '/app/db/genesis/schema',
      env: 'GENESIS_DATABASE_URL',
      parts: 'GENESIS_DB',
      defaults: { port: '5432', name: 'genesis' },
      encode: true,
      query: 'sslmode=require'
    };

    expect(
      composeFromParts(genesis, {
        GENESIS_DB_USERNAME: 'a@b',
        GENESIS_DB_PASSWORD: 'p/w',
        GENESIS_DB_HOST: 'host'
      })
    ).toBe('postgres://a%40b:p%2Fw@host:5432/genesis?sslmode=require');
  });

  it('redacts passwords', () => {
    expect(redactUrl('postgres://user:secret@host/db')).not.toContain('secret');
  });
});
