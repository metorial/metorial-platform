let isObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export let getToolCallAttachmentPath = (urlKey: string) => `/tool-call-artifacts/${urlKey}`;

export let getToolCallAttachmentPublicUrl = (urlKey: string) => {
  let path = getToolCallAttachmentPath(urlKey);
  let baseUrl = process.env.PUBLIC_SERVICE_URL;

  if (!baseUrl) return path;

  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return path;
  }
};

export let presentToolCallAttachment = (attachment: {
  urlKey: string;
  mimeType?: string | null;
  expiresAt?: Date | null;
}) => ({
  type: 'url' as const,
  url: getToolCallAttachmentPublicUrl(attachment.urlKey),
  mimeType: attachment.mimeType ?? undefined,
  urlExpiresAt: attachment.expiresAt ?? undefined
});

export let getRawToolCallAttachmentsFromOutput = (output: PrismaJson.SessionMessageOutput) => {
  if (output.type !== 'tool.result' || !isObject(output.data)) return [];

  let attachments = output.data.$attachments;
  if (!Array.isArray(attachments)) return [];

  return attachments.flatMap(attachment => {
    if (!isObject(attachment)) return [];
    if (attachment.type !== 'url' || typeof attachment.url !== 'string') return [];

    let expiresAt =
      typeof attachment.urlExpiresAt === 'string' || attachment.urlExpiresAt instanceof Date
        ? new Date(attachment.urlExpiresAt)
        : null;

    return [
      {
        url: attachment.url,
        mimeType: typeof attachment.mimeType === 'string' ? attachment.mimeType : null,
        expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null
      }
    ];
  });
};

export let replaceToolCallAttachmentsInOutput = (
  output: PrismaJson.SessionMessageOutput,
  attachments: Array<ReturnType<typeof presentToolCallAttachment>>
) => {
  if (output.type !== 'tool.result' || !isObject(output.data)) return output;

  return {
    ...output,
    data: {
      ...output.data,
      $attachments: attachments
    }
  } satisfies PrismaJson.SessionMessageOutput;
};
