import type { EphemeralManagedSession, Session, SessionTemplate } from '@metorial-subspace/db';

export let ephemeralManagedSessionPresenter = (
  ephemeralManagedSession: EphemeralManagedSession & {
    sessionTemplate: SessionTemplate;
    currentSession: Session | null;
  }
) => ({
  object: 'ephemeral_managed_session',

  id: ephemeralManagedSession.id,
  status: ephemeralManagedSession.status,

  sessionTemplateId: ephemeralManagedSession.sessionTemplate.id,
  currentSessionId: ephemeralManagedSession.currentSession?.id ?? null,

  maxSessionDurationInMinutes: ephemeralManagedSession.maxSessionDurationInMinutes,

  createdAt: ephemeralManagedSession.createdAt,
  updatedAt: ephemeralManagedSession.updatedAt,
  archivedAt: ephemeralManagedSession.archivedAt
});
