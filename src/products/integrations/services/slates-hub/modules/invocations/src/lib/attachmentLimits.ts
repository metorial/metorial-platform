import { env } from '@mtsrc/slates-hub-env/env';

// Slates that can't upload in parts hold the whole attachment in function memory first.
let MAX_SINGLE_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024;

export let MAX_ATTACHMENTS_PER_INVOCATION = 50;

export let maxAttachmentSizeBytes = (d: { multipart: boolean }) =>
  d.multipart
    ? env.storage.MAX_ATTACHMENT_SIZE_BYTES
    : Math.min(env.storage.MAX_ATTACHMENT_SIZE_BYTES, MAX_SINGLE_UPLOAD_SIZE_BYTES);

export let maxTotalAttachmentBytesPerInvocation = () =>
  env.storage.MAX_ATTACHMENT_SIZE_BYTES * 5;
