import { expectServiceError, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { createResourceAuthorization } from '@metorial/module-access';
import {
  __documentEditTokenTestUtils,
  documentEditTokenService,
  documentService
} from '@metorial/module-documents';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDocumentsLiveApi, websocket } from '../src';
import { resolveDocumentsLiveToken } from '../src/documentsLiveAuth';

type LiveMessage = { type: string; data: any };

let createDocument = async (fixture: OrganizationFixture) =>
  await documentService.createDocument({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: {
      title: uniqueId('live-doc'),
      content: '# Live\n\nfrom the api-files e2e suite',
      authorization: createResourceAuthorization({ restricted: false })
    }
  });

let issueToken = async (
  fixture: OrganizationFixture,
  documentId: string,
  input: Partial<Parameters<typeof documentEditTokenService.issueDocumentEditToken>[0]> = {}
) =>
  (
    await documentEditTokenService.issueDocumentEditToken({
      documentId,
      instanceId: fixture.instance.id,
      organizationId: fixture.organization.id,
      accessActor: { name: 'E2E live editor', organizationActorOid: fixture.actor.oid },
      permissions: ['content_read', 'content_write'],
      ...input
    })
  ).token;

let tamper = (token: string) => {
  let middle = Math.floor(token.length / 2);
  return `${token.slice(0, middle)}${token[middle] === 'a' ? 'b' : 'a'}${token.slice(middle + 1)}`;
};

describe('api-files documents live', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server: ReturnType<typeof Bun.serve> | undefined;

  beforeAll(() => {
    let api = createDocumentsLiveApi();
    server = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      fetch: (request, bunServer) => api.fetch(request, bunServer),
      websocket
    });
  });

  afterAll(async () => {
    await server?.stop(true);
  });

  let liveUrl = (query: Record<string, string | undefined>) => {
    let url = new URL(`http://127.0.0.1:${server!.port}/documents-live`);
    for (let [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
    return url;
  };

  let getLive = async (query: Record<string, string | undefined>) => {
    let response = await fetch(liveUrl(query));
    let text = await response.text();
    return { status: response.status, message: text ? JSON.parse(text).message : undefined };
  };

  let connectLive = (query: Record<string, string | undefined>) =>
    new Promise<{ opened: boolean; messages: LiveMessage[] }>(resolve => {
      let url = liveUrl(query);
      url.protocol = 'ws:';
      let socket = new WebSocket(url);
      let messages: LiveMessage[] = [];
      let opened = false;
      let settled = false;

      let finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.close();
        resolve({ opened, messages });
      };
      let timer = setTimeout(finish, 30_000);

      socket.addEventListener('open', () => {
        opened = true;
      });
      socket.addEventListener('message', event => {
        messages.push(JSON.parse(String(event.data)));
        if (messages.some(message => message.type === 'collaboration_snapshot')) finish();
      });
      socket.addEventListener('close', finish);
      socket.addEventListener('error', finish);
    });

  it('opens a live session for a valid edit token and sends the document snapshot', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let document = await createDocument(fixture);
    let token = await issueToken(fixture, document.id);

    let live = await connectLive({
      document_id: document.id,
      edit_token: token,
      instance_id: fixture.instance.id,
      organization_id: fixture.organization.id
    });
    expect(live.opened).toBe(true);

    let snapshot = live.messages.find(message => message.type === 'document_snapshot');
    expect(snapshot?.data).toMatchObject({ object: 'cargo#document', id: document.id });

    let collaboration = live.messages.find(
      message => message.type === 'collaboration_snapshot'
    );
    expect(collaboration?.data).toMatchObject({
      document: { id: document.id },
      access: { permissions: ['content_read', 'content_write'] }
    });

    let readOnly = await connectLive({
      documentId: document.id,
      editToken: await issueToken(fixture, document.id, { permissions: ['content_read'] })
    });
    expect(readOnly.opened).toBe(true);
    expect(
      readOnly.messages.find(message => message.type === 'collaboration_snapshot')?.data.access
        .permissions
    ).toEqual(['content_read']);

    let plainRequest = await getLive({ document_id: document.id, edit_token: token });
    expect(plainRequest.status).toBe(404);
  });

  it('requires a document id and an edit token', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let document = await createDocument(fixture);
    let token = await issueToken(fixture, document.id);

    expect(await getLive({ edit_token: token })).toEqual({
      status: 400,
      message: 'Missing documentId query parameter'
    });
    expect(await getLive({ document_id: document.id })).toEqual({
      status: 400,
      message: 'Missing edit_token query parameter'
    });

    let live = await connectLive({ document_id: document.id });
    expect(live).toEqual({ opened: false, messages: [] });
  });

  it('rejects invalid, tampered, expired and mismatched edit tokens', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let document = await createDocument(fixture);
    let otherDocument = await createDocument(fixture);
    let token = await issueToken(fixture, document.id);
    let expired = await __documentEditTokenTestUtils.createToken({
      claims: {
        documentId: document.id,
        instanceId: fixture.instance.id,
        organizationId: fixture.organization.id,
        accessActor: {
          name: 'E2E live editor',
          organizationActorOid: fixture.actor.oid.toString()
        }
      },
      expiresAt: new Date(Date.now() - 1000)
    });

    let attempts = [
      {
        name: 'garbage',
        query: { document_id: document.id, edit_token: uniqueId('garbage') }
      },
      { name: 'tampered', query: { document_id: document.id, edit_token: tamper(token) } },
      { name: 'expired', query: { document_id: document.id, edit_token: expired } },
      { name: 'other document', query: { document_id: otherDocument.id, edit_token: token } },
      {
        name: 'other organization',
        query: {
          document_id: document.id,
          edit_token: token,
          organization_id: otherFixture.organization.id
        }
      },
      {
        name: 'other instance',
        query: {
          document_id: document.id,
          edit_token: token,
          instance_id: otherFixture.instance.id
        }
      }
    ];

    let results = [];
    for (let attempt of attempts) {
      results.push({ name: attempt.name, ...(await getLive(attempt.query)) });
    }
    expect(results).toEqual(
      attempts.map(attempt => ({
        name: attempt.name,
        status: 403,
        message: 'Invalid document edit token'
      }))
    );

    let live = await connectLive(attempts[0]!.query);
    expect(live).toEqual({ opened: false, messages: [] });
  });

  it('does not open documents outside the tenant the token was issued for', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let document = await createDocument(fixture);
    let foreignToken = await issueToken(otherFixture, document.id);

    let live = await connectLive({ document_id: document.id, edit_token: foreignToken });
    expect(live).toEqual({ opened: false, messages: [] });

    await expectServiceError(
      resolveDocumentsLiveToken({
        editToken: foreignToken,
        documentId: document.id,
        context: { ip: '127.0.0.1', ua: 'e2e' }
      }),
      'not_found'
    );
  });
});
