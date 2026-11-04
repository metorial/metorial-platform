import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { createTenant, groundstation, rpcErrorCode } from './support';

describe('tenants', () => {
  it('creates a tenant with defaults', async () => {
    let tenant = await createTenant();

    expect(tenant.object).toBe('groundstation#tenant');
    expect(tenant.skewBoundSeconds).toBe(86400);
    expect(tenant.backfillMaxAgeDays).toBeNull();
    expect(tenant.hashKeyVersion).toBe(1);
  });

  it('updates a tenant by ref without losing untouched settings', async () => {
    let created = await createTenant({ skewBoundSeconds: 600, backfillMaxAgeDays: 30 });

    let untouched = await groundstation().tenant.upsert({ ref: created.ref });
    expect(untouched.id).toBe(created.id);
    expect(untouched.skewBoundSeconds).toBe(600);
    expect(untouched.backfillMaxAgeDays).toBe(30);

    let cleared = await groundstation().tenant.upsert({
      ref: created.ref,
      backfillMaxAgeDays: null
    });
    expect(cleared.backfillMaxAgeDays).toBeNull();
    expect(cleared.skewBoundSeconds).toBe(600);
  });

  it('finds a tenant by id or ref', async () => {
    let tenant = await createTenant();

    let byId = await groundstation().tenant.get({ tenantId: tenant.id });
    let byRef = await groundstation().tenant.get({ tenantId: tenant.ref });

    expect(byId.id).toBe(tenant.id);
    expect(byRef.id).toBe(tenant.id);
  });

  it('does not find unknown tenants', async () => {
    let code = await rpcErrorCode(
      groundstation().tenant.get({ tenantId: uniqueId('missing') })
    );

    expect(code).toBe('not_found');
  });

  it('rejects invalid settings', async () => {
    let negative = await rpcErrorCode(
      groundstation().tenant.upsert({ ref: uniqueId('org'), skewBoundSeconds: -1 })
    );
    let fractional = await rpcErrorCode(
      groundstation().tenant.upsert({ ref: uniqueId('org'), backfillMaxAgeDays: 1.5 })
    );

    expect(negative).toBe('invalid_data');
    expect(fractional).toBe('invalid_data');
  });
});
