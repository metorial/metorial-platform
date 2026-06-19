import type {
  Environment,
  Provider,
  ProviderRun,
  Session,
  SessionError,
  SessionErrorGroup,
  SessionErrorGroupOccurrencePeriod,
  Tenant
} from '@metorial-subspace/db';

export type AdminProviderTelemetryErrorGroupPresenterProps = SessionErrorGroup & {
  provider: Provider | null;
  tenant: Tenant;
  environment: Environment;
  firstOccurrence:
    | (SessionError & {
        session: Session;
        providerRun: ProviderRun | null;
      })
    | null;
  sessionErrorGroupOccurrencePeriods: SessionErrorGroupOccurrencePeriod[];
};

export let adminProviderTelemetryErrorGroupPresenter = (
  group: AdminProviderTelemetryErrorGroupPresenterProps
) => ({
  object: 'admin.provider_error_group',
  id: group.id,
  type: group.type,
  code: group.code,
  message: group.message,
  hash: group.hash,
  occurrence_count: group.occurrenceCount,
  provider: group.provider
    ? {
        id: group.provider.id,
        name: group.provider.name,
        slug: group.provider.slug
      }
    : null,
  first_occurrence_id: group.firstOccurrence?.id ?? null,
  first_session_id: group.firstOccurrence?.session?.id ?? null,
  first_provider_run_id: group.firstOccurrence?.providerRun?.id ?? null,
  tenant_id: group.tenant.id,
  environment_id: group.environment.id,
  periods: group.sessionErrorGroupOccurrencePeriods.map(period => ({
    starts_at: period.startsAt,
    ends_at: period.endsAt,
    occurrence_count: period.occurrenceCount
  })),
  created_at: group.createdAt
});
