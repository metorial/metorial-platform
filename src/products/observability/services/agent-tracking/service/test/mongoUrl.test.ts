import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { buildMongoUrl } from '@metorial/service-init';

let parts = {
  host: 'agent-tracking.cluster-abc.eu-central-1.docdb.amazonaws.com',
  port: 27017,
  username: 'tracker',
  password: 'p@ss:w/rd?',
  database: 'agent-tracking-records',
  readPreference: 'primary' as const
};

let parse = (url: string) => new mongoose.mongo.MongoClient(url).options;

describe('buildMongoUrl', () => {
  it('connects to DocumentDB with the replica set, TLS and no retryable writes', () => {
    let options = parse(buildMongoUrl(parts));

    expect(options.hosts.map(host => host.toString())).toEqual([`${parts.host}:27017`]);
    expect(options.dbName).toBe('agent-tracking-records');
    expect(options.credentials).toMatchObject({
      username: 'tracker',
      password: 'p@ss:w/rd?',
      source: 'admin',
      mechanism: 'SCRAM-SHA-1'
    });
    expect(options.replicaSet).toBe('rs0');
    expect(options.readPreference.mode).toBe('primary');
    expect(options.retryWrites).toBe(false);
    expect(options.tls).toBe(true);
    expect(options.rejectUnauthorized).toBe(false);
  });

  it('verifies the certificate against a CA bundle when one is given', () => {
    let options = parse(
      buildMongoUrl({ ...parts, tlsCAFile: '/etc/ssl/certs/rds-global-bundle.pem' })
    );

    expect(options.tls).toBe(true);
    expect(options.tlsCAFile).toBe('/etc/ssl/certs/rds-global-bundle.pem');
    expect(options.rejectUnauthorized).not.toBe(false);
  });
});
