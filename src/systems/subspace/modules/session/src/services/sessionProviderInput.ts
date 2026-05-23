import { badRequestError, notFoundError, ServiceError } from '@mtsrc/error';
import { generatePlainId } from '@mtsrc/id';
import { Service } from '@mtsrc/service';
import {
  addAfterTransactionHook,
  type Environment,
  getId,
  type Session,
  type SessionTemplate,
  type SessionTemplateProvider,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
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

let providerMismatchError = badRequestError({
  message: 'Provider session inputs have mismatched providers'
});

class sessionProviderInputServiceImpl {
  async createProviderSessionInput(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    providers: SessionProviderInput[];

    allowEphemeral?: boolean;
  }) {
    return withTransaction(
      async db => {
        let ts = {
          solutionOid: d.solution.oid,
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

        let normalizedProviders = (
          await Promise.all(
            d.providers.map(async s => {
              if (s.sessionTemplateId) {
                let template =
                  s.__sessionTemplate ??
                  (await db.sessionTemplate.findFirst({
                    where: { ...ts, id: s.sessionTemplateId, status: 'active' as const },
                    include: {
                      providers: {
                        where: { status: 'active' as const },
                        include: {
                          deployment: true,
                          config: true,
                          authConfig: true
                        }
                      }
                    }
                  }));
                if (!template) {
                  throw new ServiceError(
                    notFoundError('session.template', s.sessionTemplateId)
                  );
                }
                if (template.status !== 'active') {
                  throw new ServiceError(
                    notFoundError('session.template', s.sessionTemplateId)
                  );
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

              return {
                ...s,
                template: null,
                templateProvider: null
              };
            })
          )
        ).flat();

        if (normalizedProviders.length > 100) {
          throw new ServiceError(
            badRequestError({
              message: 'Cannot associate more than 100 providers to a session'
            })
          );
        }

        let inner = await providerCombinationService.getCombinations({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,

          providers: normalizedProviders
        });

        let res = inner.map((s, i) => {
          let normalized = normalizedProviders[i];

          return {
            ...s,
            template: normalized.template,
            templateProvider: normalized.templateProvider,
            toolFilters: normalized.toolFilters
          };
        });

        return res;
      },
      { ifExists: true }
    );
  }

  async createSessionProvidersForInput(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    providers: SessionProviderInput[];
    session: Session;
  }) {
    let providerSessions = await this.createProviderSessionInput({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      providers: d.providers
    });

    return withTransaction(async db => {
      let existingProviderCount = await db.sessionProvider.count({
        where: {
          sessionOid: d.session.oid,
          status: 'active' as const
        }
      });
      if (providerSessions.length + existingProviderCount > 100) {
        throw new ServiceError(
          badRequestError({ message: 'Cannot associate more than 100 providers to a session' })
        );
      }

      let sessionProviders = await db.sessionProvider.createManyAndReturn({
        data: await Promise.all(
          providerSessions.map(async ps => ({
            ...getId('sessionProvider'),

            tag: generatePlainId(4).toLowerCase(),
            status: 'active' as const,
            isEphemeral: d.session.isEphemeral,

            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,

            sessionOid: d.session.oid,
            providerOid: ps.provider.oid,
            deploymentOid: ps.deployment.oid,
            configOid: ps.config.oid,
            authConfigOid: ps.authConfig?.oid,

            fromTemplateOid: ps.template?.oid,
            fromTemplateProviderOid: ps.templateProvider?.oid,

            toolFilter: ps.toolFilters ?? { type: 'v1.allow_all' }
          }))
        ),
        include: sessionProviderInclude
      });

      for (let sp of sessionProviders) {
        await addAfterTransactionHook(async () =>
          sessionProviderCreatedQueue.add({ sessionProviderId: sp.id })
        );
      }

      return sessionProviders;
    });
  }

  async createSessionTemplateProvidersForInput(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    providers: SessionProviderInput[];
    template: SessionTemplate;
  }) {
    let providerSessions = await this.createProviderSessionInput({
      tenant: d.tenant,
      solution: d.solution,
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
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,

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
