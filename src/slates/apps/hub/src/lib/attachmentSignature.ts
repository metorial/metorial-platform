import { StampedSignature } from '@lowerdeck/tokens';
import { env } from '../env';

export let ATTACHMENT_SIGNATURE_MAX_AGE_MS = 5 * 60_000;

let stamp = new StampedSignature({ secret: env.secrets.SLATE_ATTACHMENT_SIGNING_SECRET });

export let signAttachmentId = (attachmentId: string) => stamp.sign(attachmentId);

export let verifyAttachmentSignature = (attachmentId: string, ts: number, sig: string) =>
  stamp.verify(attachmentId, ts, sig, ATTACHMENT_SIGNATURE_MAX_AGE_MS);
