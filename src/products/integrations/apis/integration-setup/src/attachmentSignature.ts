import { StampedSignature } from '@lowerdeck/tokens';
import { env } from './env';

let stamp = new StampedSignature({ secret: env.secrets.SLATE_ATTACHMENT_SIGNING_SECRET });

export let signSlateAttachmentId = (attachmentId: string) => stamp.sign(attachmentId);
