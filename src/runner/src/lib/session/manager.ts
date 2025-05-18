import { generateCustomId } from '@metorial/id';
import { CloseEventPayload } from '../docker/containerManager';
import { McpSession, McpSessionOpts } from './session';

class McpSessionManagerImpl {
  #sessionManager = new Map<string, McpSession>();
  #sessions = new Map<
    string,
    {
      id: string;
      status: 'active' | 'stopped';
      createdAt: Date;
      stopped: {
        at: Date;
        reason: CloseEventPayload['reason'] | 'unknown';
      } | null;
    }
  >();

  constructor() {
    setInterval(() => {
      for (let [id, session] of this.#sessions.entries()) {
        if (!session.stopped) continue;

        let now = new Date();
        let diff = now.getTime() - session.stopped.at.getTime();
        if (diff > 1000 * 60 * 5) {
          this.#sessions.delete(id);
          this.#sessionManager.delete(id);
        }
      }
    }, 1000);
  }

  createSession(opts: McpSessionOpts) {
    let id = generateCustomId('mcp_session_');
    let session = new McpSession(id, opts);

    this.#sessionManager.set(id, session);
    this.#sessions.set(id, {
      id,
      status: 'active',
      createdAt: new Date(),
      stopped: null
    });

    session.onClose(() => {
      this.#sessionManager.delete(id);

      let info = this.#sessions.get(id);
      if (!info) return;

      this.#sessions.set(id, {
        ...info,
        status: 'stopped',
        stopped: {
          at: new Date(),
          reason: info.stopped?.reason ?? 'unknown'
        }
      });
    });

    return {
      info: this.#sessions.get(id)!,
      session
    };
  }

  getSession(id: string) {
    let info = this.#sessions.get(id);
    if (!info) throw new Error(`Session ${id} not found`);

    if (info.status === 'stopped') {
      return {
        type: 'stopped' as const,
        info
      };
    }

    return {
      type: 'active' as const,
      info,
      session: this.#sessionManager.get(id)!
    };
  }
}

export let McpSessionManager = new McpSessionManagerImpl();
