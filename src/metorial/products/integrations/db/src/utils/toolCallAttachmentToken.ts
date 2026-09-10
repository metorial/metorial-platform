import { Tokens } from '@lowerdeck/tokens';
import { env } from '../env';

let TOOL_CALL_ATTACHMENT_TOKEN_TYPE = 'tool_call_attachment';
let TOOL_CALL_ATTACHMENT_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 5;

let toolCallAttachmentTokens = new Tokens({
  secret: env.secrets.SLATE_ATTACHMENT_SIGNING_SECRET
});

type ToolCallAttachmentTokenData = {
  urlKey: string;
};

export let getToolCallAttachmentTokenExpiresAt = () =>
  new Date(Date.now() + TOOL_CALL_ATTACHMENT_TOKEN_TTL_MS);

export let mintToolCallAttachmentToken = async (urlKey: string, expiresAt: Date) =>
  await toolCallAttachmentTokens.sign({
    type: TOOL_CALL_ATTACHMENT_TOKEN_TYPE,
    expiresAt,
    data: { urlKey } satisfies ToolCallAttachmentTokenData
  });

export let verifyToolCallAttachmentToken = async (d: { urlKey: string; token: string }) => {
  try {
    let result = await toolCallAttachmentTokens.verify({
      token: d.token,
      expectedType: TOOL_CALL_ATTACHMENT_TOKEN_TYPE
    });
    if (!result.verified) return false;

    let data = result.data as Partial<ToolCallAttachmentTokenData>;
    return data.urlKey === d.urlKey;
  } catch {
    return false;
  }
};
