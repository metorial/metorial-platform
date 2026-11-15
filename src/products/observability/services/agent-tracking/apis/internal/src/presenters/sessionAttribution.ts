import type { SessionDocument } from '@mtsrc/agent-tracking-store';

export let sessionAttributionPresenter = (session: SessionDocument) => ({
  object: 'agent_tracking#session_attribution',

  sessionKey: session._id,
  entries: session.attribution?.entries ?? [],
  manual: (session.manual ?? []).map(assignment => ({
    kind: assignment.kind,
    entityId: assignment.entityId,
    at: assignment.at
  })),
  fullyAttributed: session.coverage?.fullyAttributed ?? null,

  version: session.attribution?.version ?? null,
  computedAt: session.attribution?.computedAt ?? null
});
