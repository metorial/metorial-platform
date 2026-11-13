import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ingestTokenService } from '../../services';
import { createTestScope } from '../../test/scope';
import { cleanDatabase } from '../../test/setup';
import { generateIngestToken } from '../tokenSecret';
import { verifyIngestCredential } from '../verify';

vi.mock('../tokenSecret', async importOriginal => {
  let original = await importOriginal<typeof import('../tokenSecret')>();

  return { ...original, generateIngestToken: vi.fn(original.generateIngestToken) };
});

let generate = vi.mocked(generateIngestToken);

let binding = { userRef: 'consumer_1', deviceRef: 'device_1' };

describe('ingest token prefix collisions', () => {
  beforeEach(async () => {
    await cleanDatabase();
    generate.mockReset();
    generate.mockImplementation(
      (await vi.importActual<typeof import('../tokenSecret')>('../tokenSecret'))
        .generateIngestToken
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
    await expect(verifyIngestCredential(second.secret)).resolves.toBeDefined();
    await expect(verifyIngestCredential(first.secret)).resolves.toBeDefined();
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
