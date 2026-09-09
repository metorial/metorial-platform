import { generateCustomId } from '@lowerdeck/id';
import {
  getToolCallAttachmentTokenExpiresAt,
  mintToolCallAttachmentToken
} from './toolCallAttachmentToken';

let isObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export let getToolCallAttachmentPath = (urlKey: string) => `/tool-call-attachments/${urlKey}`;

export let getToolCallAttachmentRouterPath = (urlKey: string) => `/attachments/${urlKey}`;

export let getToolCallAttachmentPublicUrl = async (urlKey: string, tokenExpiresAt: Date) => {
  let routerUrl = process.env.TOOL_CALL_ROUTER_URL;
  let path = routerUrl
    ? getToolCallAttachmentRouterPath(urlKey)
    : getToolCallAttachmentPath(urlKey);
  let baseUrl = routerUrl || process.env.INTEGRATIONS_API_URL;
  let token = await mintToolCallAttachmentToken(urlKey, tokenExpiresAt);

  if (!baseUrl) return `${path}?token=${encodeURIComponent(token)}`;

  try {
    let url = new URL(path, baseUrl);
    url.searchParams.set('token', token);
    return url.toString();
  } catch {
    return `${path}?token=${encodeURIComponent(token)}`;
  }
};

export let getToolCallAttachmentUrlKey = () => {
  let random = generateCustomId('tca_link_', 50);
  let region = process.env.METORIAL_REGION;
  return region ? `${random}_${region}` : random;
};

export let presentToolCallAttachment = async (attachment: {
  urlKey: string;
  mimeType?: string | null;
  expiresAt?: Date | null;
}) => {
  let tokenExpiresAt = getToolCallAttachmentTokenExpiresAt();
  let urlExpiresAt =
    attachment.expiresAt && attachment.expiresAt < tokenExpiresAt
      ? attachment.expiresAt
      : tokenExpiresAt;

  return {
    type: 'url' as const,
    url: await getToolCallAttachmentPublicUrl(attachment.urlKey, urlExpiresAt),
    mimeType: attachment.mimeType ?? undefined,
    urlExpiresAt
  };
};

export let getRawToolCallAttachmentsFromOutput = (output: PrismaJson.SessionMessageOutput) => {
  if (output.type !== 'tool.result' || !isObject(output.data)) return [];

  let attachments = output.data.$attachments;
  if (!Array.isArray(attachments)) return [];

  return attachments.flatMap(attachment => {
    if (!isObject(attachment)) return [];
    if (attachment.type !== 'url' || typeof attachment.url !== 'string') return [];
    if (typeof attachment.attachmentId !== 'string' || !attachment.attachmentId) return [];

    let expiresAt =
      typeof attachment.urlExpiresAt === 'string' || attachment.urlExpiresAt instanceof Date
        ? new Date(attachment.urlExpiresAt)
        : null;

    return [
      {
        slateAttachmentId: attachment.attachmentId,
        mimeType: typeof attachment.mimeType === 'string' ? attachment.mimeType : null,
        expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null
      }
    ];
  });
};

export let replaceToolCallAttachmentsInOutput = (
  output: PrismaJson.SessionMessageOutput,
  attachments: Array<Awaited<ReturnType<typeof presentToolCallAttachment>>>
) => {
  if (output.type !== 'tool.result' || !isObject(output.data)) return output;
  if (!Array.isArray(output.data.$attachments)) return output;

  return {
    ...output,
    data: {
      ...output.data,
      $attachments: attachments
    }
  } satisfies PrismaJson.SessionMessageOutput;
};
