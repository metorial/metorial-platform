import {
  connectSession,
  createProviderSession,
  createRemoteProvider,
  eventually,
  expectOk,
  findTool,
  metorialEndpoints,
  rest,
  type BootstrappedOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import {
  getId,
  getToolCallAttachmentUrlKey,
  mintToolCallAttachmentToken
} from '@metorial-subspace/db';

export let integrationsApi = () => rest(metorialEndpoints().integrations);

export let integrationsUiUrl = () => {
  let url = process.env.INTEGRATIONS_UI_URL;
  if (!url) throw new Error('INTEGRATIONS_UI_URL is not set in the e2e environment');
  return url.replace(/\/+$/, '');
};

export let createToolCall = async (org: BootstrappedOrganization, mcpServerUrl: string) => {
  let { providerId } = await createRemoteProvider(org.clients.instance, { url: mcpServerUrl });
  let session = await createProviderSession(org.clients.instance, [providerId]);
  let client = connectSession(session.id, org.keys.instanceSecret);

  await client.initialize();
  let tools = await client.listTools();
  let echo = findTool(tools.result.tools, 'echo');
  await client.request('tools/call', { name: echo.name, arguments: { text: 'attachment' } });

  let item = await eventually(async () => {
    let page = expectOk(
      await org.clients.instance.get('/tool-calls', { query: { session_id: session.id } })
    );
    if (!page.items?.length) throw new Error('Tool call not recorded yet');
    return page.items[0];
  });

  return await subspaceDb.toolCall.findUniqueOrThrow({ where: { id: item.id } });
};

export let createAttachment = async (
  toolCall: { oid: bigint },
  data: {
    url?: string | null;
    slateAttachmentId?: string | null;
    mimeType?: string | null;
    expiresAt?: Date | null;
  }
) =>
  await subspaceDb.toolCallAttachment.create({
    data: {
      ...getId('toolCallAttachment'),
      urlKey: getToolCallAttachmentUrlKey(),
      toolCallOid: toolCall.oid,
      ...data
    }
  });

export let attachmentToken = (
  urlKey: string,
  expiresAt = new Date(Date.now() + 60 * 60 * 1000)
) => mintToolCallAttachmentToken(urlKey, expiresAt);
