import { delay } from '@lowerdeck/delay';
import type { SessionMessage } from '@metorial-subspace/db';
import { sessionMessageBucketRecord, storage } from './storage';

let BACKGROUND_OFFLOAD_ATTEMPTS = 3;
let BACKGROUND_OFFLOAD_RETRY_DELAY_MS = 500;

export interface OffloadedSessionMessage {
  v: 1;
  messageId: string;
  input: PrismaJson.SessionMessageInput | null;
  output: PrismaJson.SessionMessageOutput | null;
}

export let offload = {
  offloadSessionMessage: async (message: Pick<SessionMessage, 'id' | 'input' | 'output'>) => {
    let offloaded: OffloadedSessionMessage = {
      v: 1,
      messageId: message.id,
      input: message.input,
      output: message.output
    };

    await storage.putObject(
      sessionMessageBucketRecord.bucket,
      `msg/${message.id}/data`,
      JSON.stringify(offloaded)
    );
  },

  offloadSessionMessageWithRetry: async (
    message: Pick<SessionMessage, 'id' | 'input' | 'output'>
  ) => {
    for (let attempt = 1; ; attempt++) {
      try {
        await offload.offloadSessionMessage(message);
        return;
      } catch (e) {
        if (attempt >= BACKGROUND_OFFLOAD_ATTEMPTS) throw e;
        await delay(BACKGROUND_OFFLOAD_RETRY_DELAY_MS * attempt);
      }
    }
  },

  getOffloadedSessionMessageSize: async (message: Pick<SessionMessage, 'id'>) => {
    try {
      let res = await storage.headObject(
        sessionMessageBucketRecord.bucket,
        `msg/${message.id}/data`
      );
      return res.size;
    } catch (e) {
      return null;
    }
  },

  getOffloadedSessionMessage: async (message: Pick<SessionMessage, 'id'>) => {
    try {
      let res = await storage.getObject(
        sessionMessageBucketRecord.bucket,
        `msg/${message.id}/data`
      );
      let str = res.data.toString('utf-8');
      return JSON.parse(str) as OffloadedSessionMessage;
    } catch (e) {
      return null;
    }
  }
};

export let getOffloadedSessionMessage = offload.getOffloadedSessionMessage;
export let getOffloadedSessionMessageSize = offload.getOffloadedSessionMessageSize;
