import { eventually } from '@metorial/e2e';
import { getStore } from '@mtsrc/ai-gateway-store';
import { catalogModels } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import {
  chat,
  createConnection,
  createTenant,
  createToken,
  useCatalog,
  useUpstream
} from '../support/fixtures';

describe('ai-gateway logs module', () => {
  useCatalog();
  useUpstream();

  let documentOf = async (instanceId: string) => {
    let store = getStore();
    await store.ready();

    let document: Awaited<ReturnType<typeof find>> = null;
    let find = () => store.inferenceLogs.findOne({ instanceId }).lean();

    await eventually(async () => {
      document = await find();
      expect(document).toBeTruthy();
    });

    return document!;
  };

  it('indexes logs so they expire on their own', async () => {
    let store = getStore();
    await store.ready();

    let indexes = await store.inferenceLogs.collection.indexes();
    let contentIndexes = await store.inferenceContents.collection.indexes();

    for (let list of [indexes, contentIndexes]) {
      expect(
        list.some(index => index.key.expiresAt == 1 && index.expireAfterSeconds === 0)
      ).toBe(true);
    }
  });

  it('stores one document per request with the scope that made it', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant);

    await chat(token.secret, catalogModels.haiku);
    let document = await documentOf(tenant.instance.id);

    expect(document).toMatchObject({
      organizationId: tenant.organization.id,
      projectId: tenant.project.id,
      instanceId: tenant.instance.id,
      tokenId: token.id,
      status: 'succeeded',
      hasContent: false
    });
    expect(document.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('never persists secrets', async () => {
    let tenant = await createTenant({ settings: { contentLogging: { enabled: true } } });
    await createConnection(tenant, { credentials: { apiKey: 'customer-secret-key' } });
    let token = await createToken(tenant);

    await chat(token.secret, catalogModels.haiku);
    let document = await documentOf(tenant.instance.id);
    let content = await getStore().inferenceContents.findOne({ _id: document._id }).lean();

    for (let stored of [document, content]) {
      let json = JSON.stringify(stored);
      expect(json).not.toContain('customer-secret-key');
      expect(json).not.toContain(token.secret);
    }
  });

  it('keeps content in its own collection with its own retention', async () => {
    let tenant = await createTenant({
      logRetentionDays: 10,
      settings: { contentLogging: { enabled: true, retentionDays: 2 } }
    });
    let token = await createToken(tenant);

    await chat(token.secret, catalogModels.haiku, {
      messages: [{ role: 'user', content: 'Remember this prompt' }]
    });
    let document = await documentOf(tenant.instance.id);
    let content = await getStore().inferenceContents.findOne({ _id: document._id }).lean();

    expect(document.hasContent).toBe(true);
    expect(JSON.stringify(document)).not.toContain('Remember this prompt');
    expect(JSON.stringify(content!.request)).toContain('Remember this prompt');
    expect(content).toMatchObject({
      organizationId: tenant.organization.id,
      instanceId: tenant.instance.id
    });

    let days = (date: Date) => (date.getTime() - Date.now()) / 86_400_000;
    expect(days(document.expiresAt)).toBeGreaterThan(9.9);
    expect(days(content!.expiresAt)).toBeGreaterThan(1.9);
    expect(days(content!.expiresAt)).toBeLessThan(2.1);
  });

  it('writes no content when content logging is off', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant);

    await chat(token.secret, catalogModels.haiku);
    let document = await documentOf(tenant.instance.id);

    expect(
      await getStore().inferenceContents.findOne({ _id: document._id }).lean()
    ).toBeNull();
  });

  it('does not log requests that fail authentication', async () => {
    let tenant = await createTenant();

    await chat('mt_gw_unknown_secret', catalogModels.haiku);
    await new Promise(resolve => setTimeout(resolve, 2500));

    let store = getStore();
    expect(await store.inferenceLogs.countDocuments({ instanceId: tenant.instance.id })).toBe(
      0
    );
  });
});
