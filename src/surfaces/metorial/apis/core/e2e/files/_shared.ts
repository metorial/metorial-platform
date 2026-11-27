import {
  API_VERSIONS,
  authClients,
  authHeaders,
  expectOk,
  metorialEndpoints,
  rest,
  uniqueEmail,
  uniqueId,
  type BootstrappedOrganization,
  type RestClient
} from '@metorial/e2e';
import { db } from '@metorial/e2e/db';
import { flushDocumentDraft } from '@metorial/module-documents';

let dashboardCredentials = ['session', 'member', 'otherSession'];
let managementCredentials = ['management', 'otherManagement', 'consumer'];

export let readStatuses = {
  none: 401,
  session: 200,
  member: 200,
  management: 200,
  instance: 200,
  publishable: 403,
  otherSession: 404,
  otherManagement: 404
};

export let ownResourceStatuses = { ...readStatuses, otherInstance: 404 };

/** Session credentials use the dashboard alias, management keys the `/instances/:id` alias. */
export let routeFor = (org: BootstrappedOrganization, credential: string, path: string) => {
  if (dashboardCredentials.includes(credential)) {
    return `/dashboard/instances/${org.ids.instanceId}${path}`;
  }
  if (managementCredentials.includes(credential)) {
    return `/instances/${org.ids.instanceId}${path}`;
  }
  return path;
};

export let createPublishableClient = async (org: BootstrappedOrganization) => {
  let key = expectOk(
    await org.clients.rest.post(
      `/dashboard/organizations/${org.ids.organizationId}/api-keys`,
      {
        type: 'instance_access_token_publishable',
        instance_id: org.ids.instanceId,
        name: uniqueId('e2e-publishable')
      }
    )
  );

  return rest(metorialEndpoints().api, {
    apiKey: key.secret,
    version: API_VERSIONS.magnetar
  });
};

export let tenantClients = <Extra extends Record<string, RestClient>>(
  org: BootstrappedOrganization,
  otherOrg: BootstrappedOrganization,
  extra: Extra
) =>
  authClients(org, {
    otherSession: rest(metorialEndpoints().api, { session: otherOrg.session }),
    otherManagement: otherOrg.clients.management,
    otherInstance: otherOrg.clients.instance,
    ...extra
  });

export let uploadFile = async (
  org: BootstrappedOrganization,
  input: { content?: string; fileName?: string; type?: string; purpose?: string } = {}
) => {
  let form = new FormData();
  form.set(
    'file',
    new File(
      [input.content ?? uniqueId('content')],
      input.fileName ?? `${uniqueId('file')}.txt`,
      {
        type: input.type ?? 'text/plain'
      }
    )
  );
  form.set('purpose', input.purpose ?? 'generic');

  let response = await fetch(new URL('/files', metorialEndpoints().api), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      ...authHeaders({ apiKey: org.keys.instanceSecret })
    },
    body: form
  });
  let text = await response.text();
  if (!response.ok) throw new Error(`Upload failed with ${response.status}: ${text}`);

  return JSON.parse(text) as { id: string; file_name: string; status: string };
};

export let createStore = async (
  org: BootstrappedOrganization,
  input: { name?: string; access?: string } = {}
) =>
  expectOk(
    await org.clients.instance.post('/stores', {
      name: input.name ?? uniqueId('e2e-store'),
      access: input.access
    })
  );

export let createDocument = async (
  org: BootstrappedOrganization,
  input: { title?: string; content?: string } = {}
) =>
  expectOk(
    await org.clients.instance.post('/documents', {
      title: input.title ?? uniqueId('e2e-document'),
      content: input.content ?? '# Draft'
    })
  );

export let editDocument = async (client: RestClient, documentId: string, content: string) => {
  let updated = expectOk(await client.patch(`/documents/${documentId}`, { content }));
  await flushDocumentDraft({ documentId, force: true });

  return updated;
};

/** Edits only become a new version once the draft window has passed and the draft is flushed. */
export let commitDocumentVersion = async (
  client: RestClient,
  documentId: string,
  content: string
) => {
  await db.document.update({
    where: { id: documentId },
    data: { draftVersionExpiresAt: new Date(Date.now() - 60_000) }
  });

  return await editDocument(client, documentId, content);
};

/** A management client acting as a portal consumer through `metorial-consumer-profile-id`. */
export let createConsumerClient = async (org: BootstrappedOrganization) => {
  let base = `/instances/${org.ids.instanceId}/portals`;
  let portal = expectOk(
    await org.clients.management.post(base, { name: uniqueId('e2e-portal') })
  );
  let profile = expectOk(
    await org.clients.management.post(`${base}/${portal.id}/consumer-profile`, {
      email: uniqueEmail('consumer'),
      name: 'E2E Consumer'
    })
  );

  return rest(metorialEndpoints().api, {
    apiKey: org.keys.management,
    headers: { 'metorial-consumer-profile-id': profile.id }
  });
};
