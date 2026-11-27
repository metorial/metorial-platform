import {
  badRequestError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Instance, Organization } from '@mtsrc/agent-tracking-db';
import { getStore, isStoreConfigured } from '@mtsrc/agent-tracking-store';
import { sessionMcpToolCallRecords, toolCallRecordReader } from '../lib/records';
import {
  collectSessionMcpToolCalls,
  maxSessionToolCalls,
  maxToolCallLookups,
  resolveToolCallSessions,
  type ToolCallRef
} from '../lib/toolCalls';

export {
  maxRecordsPerToolCall,
  maxSessionToolCalls,
  maxToolCallLookups,
  type SessionMcpToolCall,
  type ToolCallRef,
  type ToolCallSession
} from '../lib/toolCalls';

class SessionToolCallServiceImpl {
  private async collections() {
    if (!isStoreConfigured()) {
      throw new ServiceError(
        preconditionFailedError({ message: 'Sessions need the record store.' })
      );
    }

    let store = getStore();
    await store.ready();

    return store.collections();
  }

  async listSessionMcpToolCalls(d: { organization: Organization; sessionKey: string }) {
    let { sessions } = await this.collections();

    let session = await sessions.findOne(
      { _id: d.sessionKey, organizationId: d.organization.id },
      { projection: { _id: 1, instanceId: 1 } }
    );
    if (!session) throw new ServiceError(notFoundError('session', d.sessionKey));

    let records = await sessionMcpToolCallRecords({
      organizationId: d.organization.id,
      sessionKey: session._id
    });
    let calls = await collectSessionMcpToolCalls({ records, limit: maxSessionToolCalls });

    return { session, ...calls };
  }

  async findSessionsForToolCalls(d: {
    organization: Organization;
    instance: Instance;
    calls: ToolCallRef[];
  }) {
    if (d.calls.length > maxToolCallLookups) {
      throw new ServiceError(
        badRequestError({ message: `Look up at most ${maxToolCallLookups} tool calls.` })
      );
    }
    if (!d.calls.length) return { items: [], ambiguous: [], sessions: [] };

    let { sessions } = await this.collections();

    let scope = { organizationId: d.organization.id, instanceId: d.instance.id };
    let resolved = await resolveToolCallSessions({
      ...scope,
      calls: d.calls,
      read: await toolCallRecordReader(scope)
    });
    if (!resolved.items.length)
      return { items: [], ambiguous: resolved.ambiguous, sessions: [] };

    let sessionKeys = [...new Set(resolved.items.map(item => item.sessionKey))];
    let documents = await sessions
      .find({ _id: { $in: sessionKeys }, ...scope }, { limit: sessionKeys.length })
      .toArray();
    let known = new Set(documents.map(document => document._id));

    return {
      items: resolved.items.filter(item => known.has(item.sessionKey)),
      ambiguous: resolved.ambiguous,
      sessions: documents
    };
  }
}

export let sessionToolCallService = Service.create(
  'sessionToolCallService',
  () => new SessionToolCallServiceImpl()
).build();
