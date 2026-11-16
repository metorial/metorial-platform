import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ingestTokenService } from '../src/services/ingestToken';
import { createTestScope } from '@mtsrc/agent-tracking-module-scope/test/scope';
import { cleanDatabase } from '@mtsrc/agent-tracking-db/test/setup';
import { generateIngestToken } from '../src/lib/tokenSecret';
import { ingestCredentialService } from '../src/services/ingestCredential';

vi.mock('../src/lib/tokenSecret', async importOriginal => {
  let original = await importOriginal<typeof import('../src/lib/tokenSecret')>();

  return { ...original, generateIngestToken: vi.fn(original.generateIngestToken) };
});

let generate = vi.mocked(generateIngestToken);

let binding = { userRef: 'consumer_1', deviceRef: 'device_1' };

describe('ingest token prefix collisions', () => {
  beforeEach(async () => {
    await cleanDatabase();
    generate.mockReset();
    generate.mockImplementation(
      (
        await vi.importActual<typeof import('../src/lib/tokenSecret')>(
          '../src/lib/tokenSecret'
        )
      ).generateIngestToken
    );
  });

  it('retries with a fresh token when the prefix is already taken', async () => {
    let scope = await createTestScope();
    let first = await ingestTokenService.createIngestToken({
      ...scope,
      input: { name: 'first', ...binding }
    });

    let original = generate.getMockImplementation()!;
    let collisions = 2;

    generate.mockClear();

    generate.mockImplementation(() => {
      if (collisions-- > 0) {
        return { ...original(), prefix: first.ingestToken.prefix };
      }

      return original();
    });

    let second = await ingestTokenService.createIngestToken({
      ...scope,
      input: { name: 'second', ...binding }
    });

    expect(generate).toHaveBeenCalledTimes(3);
    expect(second.ingestToken.prefix).not.toBe(first.ingestToken.prefix);
    await expect(
      ingestCredentialService.verify({ credential: second.secret })
    ).resolves.toBeDefined();
    await expect(
      ingestCredentialService.verify({ credential: first.secret })
    ).resolves.toBeDefined();
  });

  it('gives up with the original error after the maximum number of attempts', async () => {
    let scope = await createTestScope();
    let first = await ingestTokenService.createIngestToken({
      ...scope,
      input: { name: 'first', ...binding }
    });

    let original = generate.getMockImplementation()!;
    generate.mockClear();
    generate.mockImplementation(() => ({ ...original(), prefix: first.ingestToken.prefix }));

    await expect(
      ingestTokenService.createIngestToken({ ...scope, input: { name: 'second', ...binding } })
    ).rejects.toMatchObject({ code: 'P2002' });

    expect(generate).toHaveBeenCalledTimes(5);
  });
});
