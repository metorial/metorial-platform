import { describe, expect, test } from 'bun:test';
import { prepareCompose } from './images';

let revision = 'a'.repeat(40);
let digest = 'b'.repeat(64);
let fixture = () => ({
  services: {
    postgres: { image: 'postgres:16-alpine', profiles: ['infra'], volumes: ['data:/data'] },
    forge: {
      build: { dockerfile: 'dev.Dockerfile' },
      profiles: ['service'],
      container_name: 'forge-service',
      volumes: ['./src:/app/src'],
      command: 'bun --watch src/server.ts',
      restart: 'unless-stopped',
      ports: [{ target: 52020, published: '55020' }],
      environment: { DATABASE_URL: 'postgresql://forge:forge@postgres:5432/forge-test' }
    },
    admin: { build: { dockerfile: 'admin.Dockerfile' }, profiles: ['admin'] }
  }
});
let options = () => ({
  config: fixture(),
  suite: 'forge',
  profiles: ['infra', 'service'],
  revision,
  readArtifact: (name: string) => ({
    name,
    image: `ghcr.io/metorial/${name}@sha256:${digest}`,
    sourceRevision: revision
  })
});

describe('image-only E2E Compose', () => {
  test('pins images and isolates fixture databases from workers', () => {
    let original = fixture();
    let { config, applications } = prepareCompose({ ...options(), config: original });
    expect(applications).toEqual(['forge']);
    expect(config.services.forge.image).toBe(`ghcr.io/metorial/forge@sha256:${digest}`);
    for (let field of [
      'build',
      'volumes',
      'command',
      'entrypoint',
      'container_name',
      'profiles',
      'restart'
    ]) {
      expect(config.services.forge[field]).toBeUndefined();
    }
    expect(config.services.admin).toBeUndefined();
    expect(config.services.postgres.volumes).toEqual(['data:/data']);
    expect(new URL(config.services.forge.environment.DATABASE_URL).pathname).toBe(
      '/forge-test-runtime'
    );
    expect(original.services.forge.build).toBeDefined();
  });

  test('rejects unavailable images instead of rebuilding', () => {
    expect(() => prepareCompose({ ...options(), readArtifact: () => undefined })).toThrow(
      'Invalid image artifact'
    );
  });

  test('rejects wrong revisions, wrong services and mutable tags', () => {
    for (let patch of [
      { sourceRevision: 'c'.repeat(40) },
      { name: 'nebula' },
      { image: 'ghcr.io/metorial/forge:latest' }
    ]) {
      let base = options();
      expect(() =>
        prepareCompose({
          ...base,
          readArtifact: name => ({ ...base.readArtifact(name), ...patch })
        })
      ).toThrow('does not match');
    }
  });

  test('requires the requested application and pins dependency images', () => {
    let base = options();
    base.config.services.forge = {
      ...base.config.services.forge,
      image: 'ghcr.io/metorial/forge:latest'
    } as any;
    delete (base.config.services.forge as any).build;
    expect(prepareCompose(base).config.services.forge.image).toContain('@sha256:');
    expect(() => prepareCompose({ ...base, suite: 'nebula' })).toThrow('No compiled image');
  });
});
