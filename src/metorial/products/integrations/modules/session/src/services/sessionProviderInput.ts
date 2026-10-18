import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db as defaultDb,
  dbPrimary,
  type Environment,
  getId,
  type Session,
  type SessionTemplate,
  type SessionTemplateProvider,
  type Tenant,
  type TransactionDB,
  withTransaction
} from '@metorial-subspace/db';
import { getMetorialSolution } from '@metorial-subspace/module-tenant';
import { providerCombinationService } from '@metorial-subspace/module-provider-internal';
import { sessionProviderCreatedQueue } from '../queues/lifecycle/sessionProvider';
import {
  enqueueSessionTemplateProviderCreated,
  enqueueSessionTemplateSyncHash
} from '../queues/lifecycle/sessionTemplateProvider';
import { sessionProviderInclude } from './sessionProvider';
import { sessionTemplateProviderInclude } from './sessionTemplateProvider';

export type SessionProviderInputToolFilters = PrismaJson.ToolFilter | null;

export type SessionProviderTemplateInput = SessionTemplate & {
  providers: (SessionTemplateProvider & {
    deployment: { id: string };
    config: { id: string } | null;
    authConfig: { id: string } | null;
  })[];
};

export type SessionProviderInput = {
  sessionTemplateId?: string;

  deploymentId?: string;
  configId?: string;
  authConfigId?: string;

  toolFilters?: SessionProviderInputToolFilters;

  __allowEphemeral?: boolean;
  __sessionTemplate?: SessionProviderTemplateInput;
};

type NormalizedProviderInput = {
  deploymentId?: string;
  configId?: string;
  authConfigId?: string;
  toolFilters?: SessionProviderInputToolFilters | SessionTemplateProvider['toolFilter'];
  __allowEphemeral?: boolean;
  template: SessionProviderTemplateInput | null;
  templateProvider: SessionProviderTemplateInput['providers'][number] | null;
};

let sessionTemplateInclude = {
  providers: {
    where: { status: 'active' as const },
    include: {
      deployment: true,
      config: true,
      authConfig: true
    }
  }
};

class sessionProviderInputServiceImpl {
  async resolveProviderSessionInput(d: {
    tenant: Tenant;
    environment: Environment;

    providers: SessionProviderInput[];

    allowEphemeral?: boolean;
  }) {
    let solution = await getMetorialSolution();

    return withTransaction(
      async tdb => {
        // Without an enclosing transaction withTransaction hands back the replica-routed
        // client; templates created moments ago must be visible, so read from the primary.
        let db = (tdb === defaultDb ? dbPrimary : tdb) as TransactionDB;

        let ts = {
          solutionOid: solution.oid,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        };

        for (let s of d.providers) {
          if (!s.sessionTemplateId && !s.configId && !s.deploymentId && !s.authConfigId) {
            throw new ServiceError(
              badRequestError({
                message:
                  'Please provide at least a provider config, auth config, or deployment'
              })
            );
          }
        }

        let templates = new Map<string, SessionProviderTemplateInput>();
        for (let s of d.providers) {
          if (s.sessionTemplateId && s.__sessionTemplate) {
            templates.set(s.sessionTemplateId, s.__sessionTemplate);
          }
        }

        let templateIdsToLoad = [
          ...new Set(
            d.providers.flatMap(s =>
              s.sessionTemplateId && !s.__sessionTemplate ? [s.sessionTemplateId] : []
            )
          )
        ].filter(id => !templates.has(id));
        if (templateIdsToLoad.length) {
          let loaded = await db.sessionTemplate.findMany({
            where: { ...ts, id: { in: templateIdsToLoad }, status: 'active' as const },
            include: sessionTemplateInclude
          });
          for (let template of loaded) templates.set(template.id, template);
        }

        let normalizedProviders = d.providers.flatMap((s): NormalizedProviderInput[] => {
          if (s.sessionTemplateId) {
            let template = s.__sessionTemplate ?? templates.get(s.sessionTemplateId);
            if (!template || template.status !== 'active') {
              throw new ServiceError(notFoundError('session.template', s.sessionTemplateId));
            }

            return template.providers.map(tp => ({
              deploymentId: tp.deployment.id,
              configId: tp.config?.id,
              authConfigId: tp.authConfig?.id,
              toolFilters: s.toolFilters ?? tp.toolFilter,
              template,
              templateProvider: tp
            }));
          }

          return [
            {
              ...s,
              template: null,
              templateProvider: null
            }
          ];
        });

        if (normalizedProviders.length > 100) {
          throw new ServiceError(
            badRequestError({
              message: 'Cannot associate more than 100 providers to a session'
            })
          );
        }

        let inner = await providerCombinationService.getCombinationsInternal({
          tenant: d.tenant,
          environment: d.environment,

          providers: normalizedProviders
        });

        let providers = inner.map((s, i) => {
          let normalized = normalizedProviders[i]!;

          return {
            ...s,
            template: normalized.template,
            templateProvider: normalized.templateProvider,
            toolFilters: normalized.toolFilters
          };
        });

        return { templates, providers };
      },
      { ifExists: true }
    );
  }

  async createSessionProvidersForInput(d: {
    tenant: Tenant;
    environment: Environment;

    providers: SessionProviderInput[];
    resolvedProviders?: ResolvedSessionProviderInput[];
    session: Session;
    isNewSession?: boolean;
  }) {
    let solution = await getMetorialSolution();

    let providerSessions =
      d.resolvedProviders ??
      (
        await this.resolveProviderSessionInput({
          tenant: d.tenant,
          environment: d.environment,
          providers: d.providers
        })
      ).providers;

    return withTransaction(async db => {
      if (!d.isNewSession) {
        let existingProviderCount = await db.sessionProvider.count({
          where: {
            sessionOid: d.session.oid,
            status: 'active' as const
          }
        });
        if (providerSessions.length + existingProviderCount > 100) {
          throw new ServiceError(
            badRequestError({
              message: 'Cannot associate more than 100 providers to a session'
            })
          );
        }
      }

      let rows = providerSessions.map(ps => ({
        resolved: ps,
        data: {
          ...getId('sessionProvider'),

          tag: generatePlainId(4).toLowerCase(),
          status: 'active' as const,
          isEphemeral: d.session.isEphemeral,

          tenantOid: d.tenant.oid,
          projectOid: d.tenant.projectOid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid,
          instanceOid: d.environment.instanceOid,

          sessionOid: d.session.oid,
          providerOid: ps.provider.oid,
          deploymentOid: ps.deployment.oid,
          configOid: ps.config.oid,
          authConfigOid: ps.authConfig?.oid,

          fromTemplateOid: ps.template?.oid,
          fromTemplateProviderOid: ps.templateProvider?.oid,

          toolFilter: ps.toolFilters ?? { type: 'v1.allow_all' as const }
        }
      }));

      let created = await db.sessionProvider.createManyAndReturn({
        data: rows.map(row => row.data)
      });

      // Every relation is already in memory from the resolution step, so reloading the
      // seven-relation include for each new row would only repeat those reads.
      let resolvedById = new Map(rows.map(row => [row.data.id, row.resolved]));
      let sessionProviders = created.map(sp => {
        let resolved = resolvedById.get(sp.id)!;

        return {
          ...sp,
          provider: resolved.provider,
          deployment: resolved.deployment,
          config: resolved.config,
          authConfig: resolved.authConfig ?? null,
          session: d.session,
          fromTemplate: resolved.template ?? null,
          fromTemplateProvider: resolved.templateProvider ?? null
        };
      });

      if (sessionProviders.length) {
        await addAfterTransactionHook(async () =>
          sessionProviderCreatedQueue.addMany(
            sessionProviders.map(sp => ({ sessionProviderId: sp.id }))
          )
        );
      }

      return sessionProviders;
    });
  }

  async createSessionTemplateProvidersForInput(d: {
    tenant: Tenant;
    environment: Environment;

    providers: SessionProviderInput[];
    template: SessionTemplate;
  }) {
    let solution = await getMetorialSolution();

    let { providers: providerSessions } = await this.resolveProviderSessionInput({
      tenant: d.tenant,
      environment: d.environment,
      providers: d.providers
    });

    return withTransaction(async db => {
      let existingProviderCount = await db.sessionTemplateProvider.count({
        where: {
          sessionTemplateOid: d.template.oid,
          status: 'active' as const
        }
      });
      if (providerSessions.length + existingProviderCount > 100) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot associate more than 100 providers to a session template'
          })
        );
      }

      let sessionTemplateProviders = await db.sessionTemplateProvider.createManyAndReturn({
        data: await Promise.all(
          providerSessions.map(async ps => ({
            ...getId('sessionTemplateProvider'),

            status: 'active' as const,

            tenantOid: d.tenant.oid,
            projectOid: d.tenant.projectOid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid,
            instanceOid: d.environment.instanceOid,

            sessionTemplateOid: d.template.oid,
            providerOid: ps.provider.oid,
            deploymentOid: ps.deployment.oid,
            configOid: ps.config.oid,
            authConfigOid: ps.authConfig?.oid,

            toolFilter: ps.toolFilters ?? { type: 'v1.allow_all' }
          }))
        ),
        include: sessionTemplateProviderInclude
      });

      for (let stp of sessionTemplateProviders) {
        await addAfterTransactionHook(async () =>
          enqueueSessionTemplateProviderCreated(stp.id)
        );
      }

      await addAfterTransactionHook(async () => enqueueSessionTemplateSyncHash(d.template.id));

      return sessionTemplateProviders;
    });
  }
}

export let sessionProviderInputService = Service.create(
  'sessionProviderInputService',
  () => new sessionProviderInputServiceImpl()
).build();

export type ResolvedSessionProviderInput = Awaited<
  ReturnType<typeof sessionProviderInputService.resolveProviderSessionInput>
>['providers'][number];
