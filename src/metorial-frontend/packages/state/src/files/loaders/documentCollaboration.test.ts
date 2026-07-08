import { setConfig } from '@metorial/frontend-config';
import { describe, expect, it } from 'vitest';
import { __documentCollaborationTestUtils } from './documentCollaboration';

describe('document collaboration protocol helpers', () => {
  it('round-trips binary updates through base64 JSON payloads', () => {
    let update = new Uint8Array([0, 1, 2, 127, 128, 255]);
    let encoded = __documentCollaborationTestUtils.encodeBase64(update);
    let decoded = __documentCollaborationTestUtils.decodeBase64(encoded);

    expect([...decoded]).toEqual([...update]);
  });

  it('builds websocket URLs against the API host', () => {
    setConfig({
      apiUrl: 'https://api.example.test',
      filesUrl: 'https://files.example.test/root',
      publicApiUrl: 'https://public.example.test',
      environment: 'development'
    });

    let url = new URL(
      __documentCollaborationTestUtils.getDocumentLiveUrl({
        instanceId: 'inst_123',
        documentId: 'doc_123',
        organizationId: 'org_123'
      })
    );

    expect(url.protocol).toBe('wss:');
    expect(url.host).toBe('api.example.test');
    expect(url.pathname).toBe('/documents-live');
    expect(url.searchParams.get('instanceId')).toBe('inst_123');
    expect(url.searchParams.get('documentId')).toBe('doc_123');
    expect(url.searchParams.get('organizationId')).toBe('org_123');
    expect(url.searchParams.get('protocol')).toBe('yjs');
    expect(url.searchParams.get('edit_token')).toBe(null);
  });

  it('includes edit tokens in websocket URLs when provided', () => {
    setConfig({
      apiUrl: 'https://api.example.test',
      filesUrl: 'https://files.example.test/root',
      publicApiUrl: 'https://public.example.test',
      environment: 'development'
    });

    let url = new URL(
      __documentCollaborationTestUtils.getDocumentLiveUrl({
        instanceId: 'inst_123',
        documentId: 'doc_123',
        editToken: 'edit_token_123'
      })
    );

    expect(url.searchParams.get('edit_token')).toBe('edit_token_123');
  });

  it('seeds saved markdown when no initial Yjs body exists', () => {
    expect(
      __documentCollaborationTestUtils.shouldSeedInitialBody({
        bodyStateReceived: false,
        initialMarkdown: '# Existing document'
      })
    ).toBe(true);
  });

  it('does not seed saved markdown over an existing Yjs body', () => {
    expect(
      __documentCollaborationTestUtils.shouldSeedInitialBody({
        bodyStateReceived: true,
        initialMarkdown: '# Existing document'
      })
    ).toBe(false);
  });

  it('does not seed empty saved markdown', () => {
    expect(
      __documentCollaborationTestUtils.shouldSeedInitialBody({
        bodyStateReceived: false,
        initialMarkdown: '   '
      })
    ).toBe(false);
  });
});
