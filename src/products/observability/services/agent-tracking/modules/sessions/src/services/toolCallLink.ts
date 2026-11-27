import { badRequestError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Instance, Organization, Project } from '@mtsrc/agent-tracking-db';
import { isStoreConfigured } from '@mtsrc/agent-tracking-store';
import { queueSessionSettle } from '../queues/sessionSettle';
import { toolCallRecordReader } from '../lib/records';
import {
  maxToolCallLinks,
  writeToolCallLinks,
  type ToolCallLinkInput
} from '../lib/toolCallLinks';
import { resolveToolCallSessions } from '../lib/toolCalls';

export { maxToolCallLinks, type ToolCallLinkInput } from '../lib/toolCallLinks';

class ToolCallLinkServiceImpl {
  async upsertToolCallLinks(d: {
    organization: Organization;
    instance: Instance & { project: Project };
    links: ToolCallLinkInput[];
  }) {
    if (d.links.length > maxToolCallLinks) {
      throw new ServiceError(
        badRequestError({ message: `Link at most ${maxToolCallLinks} tool calls at once.` })
      );
    }
    if (!isStoreConfigured()) {
      throw new ServiceError(
        preconditionFailedError({ message: 'Tool call links need the record store.' })
      );
    }
    if (!d.links.length) return { written: 0, sessionKeys: [] };

    let scope = { organizationId: d.organization.id, instanceId: d.instance.id };

    let written = await writeToolCallLinks({
      scope: {
        ...scope,
        projectId: d.instance.project.id,
        recordRetentionDays: d.instance.recordRetentionDays
      },
      links: d.links
    });

    let resolved = await resolveToolCallSessions({
      ...scope,
      calls: d.links.map(link => ({
        clientFamily: link.clientFamily,
        toolCallId: link.toolCallId
      })),
      read: await toolCallRecordReader(scope)
    });

    let sessionKeys = [...new Set(resolved.items.map(item => item.sessionKey))];
    await queueSessionSettle(sessionKeys);

    return { written, sessionKeys };
  }
}

export let toolCallLinkService = Service.create(
  'toolCallLinkService',
  () => new ToolCallLinkServiceImpl()
).build();
