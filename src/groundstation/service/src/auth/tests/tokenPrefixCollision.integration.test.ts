import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ingestTokenService, tenantService } from '../../services';
import { cleanDatabase } from '../../test/setup';
import { generateIngestToken } from '../tokenSecret';
import { verifyIngestCredential } from '../verify';

vi.mock('../tokenSecret', async importOriginal => {
  let original = await importOriginal<typeof import('../tokenSecret')>();

  return { ...original, generateIngestToken: vi.fn(original.generateIngestToken) };
});

let generate = vi.mocked(generateIngestToken);

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
    let tenant = await tenantService.upsertTenant({ input: { ref: 'org_collision' } });
    let first = await ingestTokenService.createIngestToken({
      tenant,
      input: { name: 'first' }
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
      tenant,
      input: { name: 'second' }
    });

    expect(generate).toHaveBeenCalledTimes(3);
    expect(second.ingestToken.prefix).not.toBe(first.ingestToken.prefix);
    await expect(verifyIngestCredential(second.secret)).resolves.toBeDefined();
    await expect(verifyIngestCredential(first.secret)).resolves.toBeDefined();
  });

  it('gives up with the original error after the maximum number of attempts', async () => {
    let tenant = await tenantService.upsertTenant({ input: { ref: 'org_collision_limit' } });
    let first = await ingestTokenService.createIngestToken({
      tenant,
      input: { name: 'first' }
    });

    let original = generate.getMockImplementation()!;
    generate.mockClear();
    generate.mockImplementation(() => ({ ...original(), prefix: first.ingestToken.prefix }));

    await expect(
      ingestTokenService.createIngestToken({ tenant, input: { name: 'second' } })
    ).rejects.toMatchObject({ code: 'P2002' });

    expect(generate).toHaveBeenCalledTimes(5);
  });
});
