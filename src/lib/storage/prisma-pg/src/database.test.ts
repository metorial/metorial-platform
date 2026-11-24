import { describe, expect, it } from 'vitest';
import { DatabaseConfigError, resolveDatabaseUrls } from './database';

let primary = 'postgresql://app:secret@writer.internal:5432/core?schema=public';
let reader = 'postgresql://app:secret@reader.internal:5432/core?schema=public';

describe('resolveDatabaseUrls', () => {
  it('reads the reader from the resolved primary key only', () => {
    let urls = resolveDatabaseUrls({
      name: 'integrations',
      url: ['SUBSPACE_DATABASE_URL', 'DATABASE_URL'],
      env: {
        SUBSPACE_DATABASE_URL: primary,
        DATABASE_URL: 'postgresql://app:secret@writer.internal:5432/other',
        DATABASE_URL_READER: 'postgresql://app:secret@reader.internal:5432/other'
      }
    });

    expect(urls).toMatchObject({
      urlKey: 'SUBSPACE_DATABASE_URL',
      primaryUrl: primary,
      replicaUrl: undefined
    });
  });

  it('falls back to later keys in order', () => {
    let urls = resolveDatabaseUrls({
      name: 'integrations',
      url: ['SUBSPACE_DATABASE_URL', 'DATABASE_URL'],
      env: { DATABASE_URL: primary, DATABASE_URL_READER: reader }
    });

    expect(urls).toMatchObject({ urlKey: 'DATABASE_URL', replicaUrl: reader });
  });

  it('allows a missing primary when no reader is configured', () => {
    expect(resolveDatabaseUrls({ name: 'core', url: 'DATABASE_URL', env: {} })).toMatchObject({
      urlKey: 'DATABASE_URL',
      primaryUrl: undefined,
      replicaUrl: undefined
    });
  });

  it('rejects a reader for another database', () => {
    expect(() =>
      resolveDatabaseUrls({
        name: 'core',
        url: 'DATABASE_URL',
        env: {
          DATABASE_URL: primary,
          DATABASE_URL_READER: 'postgresql://app:secret@reader.internal:5432/subspace'
        }
      })
    ).toThrow(DatabaseConfigError);
  });

  it('rejects a reader with another user', () => {
    expect(() =>
      resolveDatabaseUrls({
        name: 'core',
        url: 'DATABASE_URL',
        env: {
          DATABASE_URL: primary,
          DATABASE_URL_READER: 'postgresql://other:secret@reader.internal:5432/core'
        }
      })
    ).toThrow(/same database/);
  });

  it('rejects a reader without a primary', () => {
    expect(() =>
      resolveDatabaseUrls({
        name: 'core',
        url: 'DATABASE_URL',
        env: { DATABASE_URL_READER: reader }
      })
    ).toThrow(DatabaseConfigError);
  });
});
