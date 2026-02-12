import {
  Instance,
  Organization,
  ServerDeployment,
  ServerSession,
  ServerVariant,
  SessionMessageType
} from '@metorial/db';
import { createUuidTranslator } from '@metorial/id';
import { JSONRPCMessage } from '@metorial/mcp-utils';
import { BaseConnectionHandler, ConnectionMessage } from './base';

let translator = createUuidTranslator('msge_');

export class EngineConnectionHandler extends BaseConnectionHandler {
  private constructor(
    session: ServerSession & {
      serverDeployment: ServerDeployment & {
        serverVariant: ServerVariant;
      };
    },
    instance: Instance & { organization: Organization }
  ) {
    super(session, instance);
  }

  static async create(
    session: ServerSession & {
      serverDeployment: ServerDeployment & {
        serverVariant: ServerVariant;
      };
    },
    instance: Instance & { organization: Organization }
  ) {
    return new EngineConnectionHandler(session, instance);
  }

  get mode() {
    return 'send-and-receive' as const;
  }

  async sendMessage(
    message: JSONRPCMessage[],
    opts: {
      includeResponses?: boolean;
      onResponse?: (message: ConnectionMessage) => void;
    }
  ) {
    // let stream = this.connection.sendMcpMessageStream(message, {
    //   includeResponses: opts.includeResponses
    // });

    let responses: ConnectionMessage[] = [];

    // for await (let msg of stream) {
    //   // let connectionMessage = this.toConnectionMessage(msg);
    //   // responses.push(connectionMessage);
    //   // if (opts.onResponse) opts.onResponse(connectionMessage);
    // }

    return { responses };
  }

  async onMessage(
    opts: {
      type: SessionMessageType[];
      ids?: string[];
      replayAfterTrackingId?: string;
    },
    handler: (message: ConnectionMessage) => void
  ) {
    // let stream = this.connection.getMcpStream({
    //   onlyMessageTypes: opts.type,
    //   onlyIds: opts.ids,
    //   replayAfterUuid: opts.replayAfterTrackingId
    //     ? translator.toUUID(opts.replayAfterTrackingId)
    //     : undefined
    // });
    // for await (let msg of stream) {
    //   // handler(this.toConnectionMessage(msg));
    // }
  }

  async close() {
    // this.connection.close();
  }
}
