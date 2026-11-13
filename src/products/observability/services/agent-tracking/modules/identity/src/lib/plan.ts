import type {
  NormalizedRecord,
  RecordAttribution,
  SessionContextData
} from '@mtsrc/agent-tracking-spec';
import type { IngestPrincipal } from '@mtsrc/agent-tracking-records-model';
import { sessionContextType } from '@mtsrc/agent-tracking-records-model';
import { repoIdentifier } from '@mtsrc/agent-tracking-records-model';
import type { LinkType } from '@mtsrc/agent-tracking-module-entities';
import type { EntityRequest } from './resolver';

let maxIdentifierLength = 512;

let emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type AttributionField = keyof RecordAttribution;

export type EntityRef = { id: string } | { request: string };

export type PlannedLink = { from: EntityRef; to: EntityRef; type: LinkType };

export type RecordPlan = {
  slots: Partial<Record<AttributionField, EntityRef>>;
  clientEmail?: string;
};

export type AttributionPlan = {
  requests: EntityRequest[];
  records: RecordPlan[];
  links: PlannedLink[];
};

let cleanValue = (value: string | undefined) => {
  let trimmed = value?.trim();
  return trimmed && trimmed.length <= maxIdentifierLength ? trimmed : undefined;
};

let cleanEmail = (value: string | undefined) => {
  let email = cleanValue(value)?.toLowerCase();
  return email && emailPattern.test(email) ? email : undefined;
};

let familyOf = (record: NormalizedRecord) => {
  let family = record.client.family.trim().toLowerCase();
  return family && family != 'unknown' ? family : undefined;
};

export let emailDomainAllowed = (email: string, allowedDomains: string[] | undefined) => {
  if (!allowedDomains?.length) return true;

  let domain = email.slice(email.lastIndexOf('@') + 1);
  return allowedDomains.some(allowed => allowed.trim().toLowerCase() == domain);
};

let contextOf = (record: NormalizedRecord) =>
  record.type == sessionContextType ? (record.data as Partial<SessionContextData>) : undefined;

export let planAttribution = (d: {
  principal: IngestPrincipal;
  records: NormalizedRecord[];
  clientIp?: string;
}): AttributionPlan => {
  let { principal } = d;
  let { binding, credential } = principal;

  let requests = new Map<string, EntityRequest>();
  let links = new Map<string, PlannedLink>();

  let request = (entry: EntityRequest): EntityRef => {
    if (!requests.has(entry.key)) requests.set(entry.key, entry);
    return { request: entry.key };
  };

  let refKey = (ref: EntityRef) => ('id' in ref ? `id:${ref.id}` : `req:${ref.request}`);

  let link = (from: EntityRef | undefined, to: EntityRef | undefined, type: LinkType) => {
    if (!from || !to) return;
    links.set(`${refKey(from)}|${type}|${refKey(to)}`, { from, to, type });
  };

  let isVendor = binding.deviceMode == 'vendor';
  let tokenUser: EntityRef | undefined = binding.userId ? { id: binding.userId } : undefined;

  let ephemeralDevice =
    binding.deviceMode == 'ephemeral' && d.clientIp && credential.kind == 'token'
      ? request({
          key: `device|ip|${credential.id}|${d.clientIp}`,
          kind: 'device',
          identifiers: [{ type: 'ip', value: `${credential.id}:${d.clientIp}` }],
          name: d.clientIp,
          attributes: { ephemeral: true, ip: d.clientIp, tokenId: credential.id }
        })
      : undefined;

  link(ephemeralDevice, tokenUser, 'owned_by');

  let records = d.records.map((record): RecordPlan => {
    let slots: RecordPlan['slots'] = {};
    let family = familyOf(record);
    let actor = record.actor;

    let accountId = cleanValue(actor?.user?.id);
    let email = cleanEmail(actor?.user?.email);
    let installId = cleanValue(actor?.install_id);

    if (isVendor) {
      let identifiers = [
        ...(email ? [{ type: 'email', value: email }] : []),
        ...(accountId && family ? [{ type: `account:${family}`, value: accountId }] : [])
      ];

      if (identifiers.length) {
        slots.user_id = request({
          key: `user|${identifiers[0]!.type}|${identifiers[0]!.value}`,
          kind: 'user',
          identifiers,
          needsReview: email
            ? !emailDomainAllowed(email, principal.organization.settings.allowedEmailDomains)
            : false,
          ...(principal.newUserLimitPerDay !== undefined
            ? {
                newUser: { sourceId: credential.id, limitPerDay: principal.newUserLimitPerDay }
              }
            : {})
        });
      }

      if (installId && family) {
        slots.device_id = request({
          key: `device|install:${family}|${installId}`,
          kind: 'device',
          identifiers: [{ type: `install:${family}`, value: installId }]
        });
      }
    } else {
      slots.user_id = tokenUser;
      slots.device_id = binding.deviceId ? { id: binding.deviceId } : ephemeralDevice;
    }

    if (binding.agentId) {
      slots.agent_id = { id: binding.agentId };
    } else if (family) {
      slots.agent_id = request({
        key: `agent|client_family|${family}`,
        kind: 'agent',
        identifiers: [{ type: 'client_family', value: family }],
        name: record.client.family
      });
    }

    if (family && (accountId || email)) {
      let identifiers = [
        ...(accountId ? [{ type: `account:${family}`, value: accountId }] : []),
        ...(email ? [{ type: `email:${family}`, value: email }] : [])
      ];

      slots.client_user_id = request({
        key: `client_user|${identifiers[0]!.type}|${identifiers[0]!.value}`,
        kind: 'client_user',
        identifiers,
        name: email ?? null
      });

      link(slots.client_user_id, slots.user_id, 'owned_by');
    }

    if (family && installId) {
      slots.client_installation_id = request({
        key: `client_installation|install:${family}|${installId}`,
        kind: 'client_installation',
        identifiers: [{ type: `install:${family}`, value: installId }]
      });

      link(slots.client_installation_id, slots.device_id, 'part_of');
    }

    let context = contextOf(record);

    if (context?.repo?.owner && context.repo.name && context.repo.provider) {
      let remote = repoIdentifier(context.repo);

      slots.repo_id = request({
        key: `repo|remote|${remote}`,
        kind: 'repo',
        identifiers: [{ type: 'remote', value: remote }],
        name: `${context.repo.owner}/${context.repo.name}`,
        attributes: {
          provider: context.repo.provider,
          owner: context.repo.owner,
          name: context.repo.name,
          ...(context.repo.url ? { url: context.repo.url } : {})
        }
      });
    }

    if (context?.workspace?.root_hash) {
      slots.workspace_id = request({
        key: `workspace|root|${context.workspace.root_hash}`,
        kind: 'workspace',
        identifiers: [{ type: 'root', value: context.workspace.root_hash }],
        name: context.workspace.label ?? null
      });

      link(slots.workspace_id, slots.repo_id, 'part_of');
    }

    return {
      slots,
      ...(!isVendor && email ? { clientEmail: email } : {})
    };
  });

  return { requests: [...requests.values()], records, links: [...links.values()] };
};
