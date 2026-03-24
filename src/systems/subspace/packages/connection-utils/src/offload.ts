import type { SessionMessage } from '@metorial-subspace/db';
import { sessionMessageBucketRecord, storage } from './storage';

export interface OffloadedSessionMessage {
  v: 1;
  messageId: string;
  input: PrismaJson.SessionMessageInput | null;
  output: PrismaJson.SessionMessageOutput | null;
}

export let offload = {
  offloadSessionMessage: async (message: SessionMessage) => {
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

  getOffloadedSessionMessage: async (message: SessionMessage) => {
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
