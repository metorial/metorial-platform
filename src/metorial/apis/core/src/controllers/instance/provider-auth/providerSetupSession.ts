import { hydrateResourceOwners } from '@metorial/module-resource-actor';
import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import type { Organization, OrganizationMember } from '@metorial/db';
import { accessService, type AuthInfo, type Scope } from '@metorial/module-access';
import {
  providerAuthCredentialsService,
  providerSetupSessionEmailService,
  providerSetupSessionService,
  SETUP_SESSION_EMAIL_MAX_RECIPIENTS,
  SETUP_SESSION_EMAIL_MAX_RECIPIENTS_PER_DAY,
  SETUP_SESSION_EMAIL_MAX_RECIPIENTS_PER_INSTANCE_PER_DAY,
  SETUP_SESSION_EMAIL_THROTTLE_WINDOW_MINUTES
} from '@metorial-subspace/module-auth';
import { providerService } from '@metorial-subspace/module-catalog';
import { providerDeploymentService } from '@metorial-subspace/module-deployment';
import { identityService } from '@metorial-subspace/module-identity';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import {
  providerSetupSessionEmailPresenter,
  providerSetupSessionPresenter
} from '@metorial/presenters';
import { getOwnershipActor, resolveExplorerOwner } from '../../../lib/ownershipActor';

let providerSetupSessionConfigurationValidator = v.optional(
  v.object({
    provider_search: v.optional(
      v.object({
        groups: v.optional(v.array(v.object({ group_id: v.string() }))),
        collections: v.optional(v.array(v.object({ collection_id: v.string() }))),
        categories: v.optional(v.array(v.object({ category_id: v.string() })))
      })
    ),
    tool_filters: v.optional(
      v.object({
        enabled: v.optional(v.boolean())
      })
    ),
    ui: v.optional(
      v.object({
        layout: v.optional(v.enumOf(['box', 'side', 'light']))
      })
    )
  })
);

let providerSetupSessionTypes = [
  'auth_only',
  'config_only',
  'auth_and_config',
  'admin'
] as const;

let providerSetupSessionTypeFilterValidator = v.enumOf([...providerSetupSessionTypes]);

let organizationMemberReadScopes: Scope[] = ['organization.member:read'];

let canReadOrganizationMembers = async (d: {
  authInfo: AuthInfo;
  organization: Organization;
  member?: OrganizationMember;
}) => {
  if (d.authInfo.type == 'fine_grained') return false;
  if (!d.authInfo.orgScopes.some(scope => organizationMemberReadScopes.includes(scope))) {
    return false;
  }

  return await accessService.canAccessTargetScopes({
    ...d,
    possibleScopes: organizationMemberReadScopes
  });
};

let providerSetupSessionGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.providerSetupSessionId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerSetupSessionId is required',
        description: 'The providerSetupSessionId path parameter is required.'
      })
    );
  }

  let setupSession = await providerSetupSessionService.getProviderSetupSessionById({
    instance: ctx.instance,
    organizationActor: getOwnershipActor(ctx),
    providerSetupSessionId: ctx.params.providerSetupSessionId
  });

  return { setupSession };
});

export let providerSetupSessionController = Controller.create(
  {
    name: 'Provider Setup Sessions',
    description:
      "A setup session tracks an in-progress OAuth flow, storing state during the redirect. On success, it creates an auth config with the user's access token."
  },
  {
    list: instanceGroup
      .get(instancePath('provider-setup-sessions', 'providerDeployments.setupSessions.list'), {
        name: 'List provider setup sessions',
        description: 'Returns a paginated list of provider setup sessions.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .outputList(providerSetupSessionPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by setup session ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider deployment ID(s)'
            }),
            provider_auth_method_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by auth method ID(s)'
            }),
            provider_auth_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider auth config ID(s)'
            }),
            provider_auth_credentials_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by provider auth credentials ID(s)' }
            ),
            status: v.optional(
              v.union([
                v.enumOf(['archived', 'failed', 'completed', 'expired', 'pending']),
                v.array(v.enumOf(['archived', 'failed', 'completed', 'expired', 'pending']))
              ]),
              {
                description:
                  'Filter by session status (archived, failed, completed, expired, pending)'
              }
            ),
            type: v.optional(
              v.union([
                providerSetupSessionTypeFilterValidator,
                v.array(providerSetupSessionTypeFilterValidator)
              ]),
              {
                description:
                  'Filter by session type (auth_only, config_only, auth_and_config, admin), matching either the requested or the resolved type'
              }
            ),
            created_at: dateFilterValidator('provider setup session creation time'),
            updated_at: dateFilterValidator('provider setup session last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await providerSetupSessionService.listProviderSetupSessions({
          instance: ctx.instance,
          organizationActor: getOwnershipActor(ctx),
          allowDeleted: false,

          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerAuthMethodIds: normalizeArrayParam(ctx.query.provider_auth_method_id),
          providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
          providerAuthCredentialsIds: normalizeArrayParam(
            ctx.query.provider_auth_credentials_id
          ),
          status: normalizeArrayParam(ctx.query.status),
          types: normalizeArrayParam(ctx.query.type),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);
        let items = await providerSetupSessionService.redactProviderSetupSessionsForCaller({
          instance: ctx.instance,
          organizationActor: getOwnershipActor(ctx),
          setupSessions: list.items
        });

        return Paginator.present(
          await hydrateResourceOwners({ ...list, items }),
          setupSession =>
            providerSetupSessionPresenter.present({
              setupSession
            })
        );
      }),

    get: providerSetupSessionGroup
      .get(
        instancePath(
          'provider-setup-sessions/:providerSetupSessionId',
          'providerDeployments.setupSessions.get'
        ),
        {
          name: 'Get provider setup session',
          description: 'Retrieves a specific provider setup session by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .output(providerSetupSessionPresenter)
      .do(async ctx => {
        let [setupSession] =
          await providerSetupSessionService.redactProviderSetupSessionsForCaller({
            instance: ctx.instance,
            organizationActor: getOwnershipActor(ctx),
            setupSessions: [ctx.setupSession]
          });

        return providerSetupSessionPresenter.present(
          await hydrateResourceOwners({ setupSession: setupSession! })
        );
      }),

    create: instanceGroup
      .post(
        instancePath('provider-setup-sessions', 'providerDeployments.setupSessions.create'),
        {
          name: 'Create provider setup session',
          description: 'Creates a new provider setup session for OAuth authentication.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .body(
        'mt_2026_01_01_magnetar',
        v.object({
          provider_id: v.optional(
            v.string({
              examples: ['pro_5gHjKlMnPqRsTuVw'],
              description: 'The provider ID'
            })
          ),
          provider_deployment_id: v.optional(
            v.string({
              examples: ['pdp_4dEfGhJkLmNpQrSt'],
              description: 'Optional provider deployment ID'
            })
          ),
          name: v.optional(v.string({ examples: ['GitHub OAuth Setup'] })),
          description: v.optional(v.string({ examples: ['Connect your GitHub account'] })),
          metadata: v.optional(
            v.record(v.any(), {
              examples: [{ redirect_uri: 'https://app.example.com/callback' }]
            }),
            { description: 'Custom key-value pairs for storing additional information' }
          ),
          provider_auth_method_id: v.optional(
            v.string({
              examples: ['pam_2mNpQrStUvWxYzAb'],
              description: 'The authentication method to use (e.g., OAuth flow)'
            })
          ),
          provider_auth_credentials_id: v.optional(
            v.string({
              examples: ['pac_3nOpRsTuVwXyZaBc'],
              description: 'Optional OAuth app credentials to use instead of defaults'
            })
          ),
          identity_id: v.optional(
            v.string({
              examples: ['idn_3nOpRsTuVwXyZaBc'],
              description: 'Optional identity to link this setup session to'
            })
          ),
          consumer_id: v.optional(
            v.string({
              examples: ['con_1a2b3c4d5e6f7g8h'],
              description: 'Optional consumer to link this setup session to'
            })
          ),
          redirect_url: v.optional(
            v.string({ examples: ['https://app.example.com/oauth/callback'] })
          ),
          type: v.optional(
            v.enumOf(['auth_only', 'config_only', 'auth_and_config', 'admin', 'auto'], {
              description:
                'The type of setup session, determining the flow and outcome of the session. `admin` creates an admin consent link for auth methods that support it, never creates credentials or configs, and cannot be bound to an identity, consumer, or config.'
            })
          ),
          configuration: providerSetupSessionConfigurationValidator
        }),
        v => v
      )
      .body(
        'default',
        v.object({
          provider_id: v.optional(
            v.string({
              examples: ['pro_5gHjKlMnPqRsTuVw'],
              description: 'The provider ID'
            })
          ),
          provider_deployment_id: v.optional(
            v.string({
              examples: ['pdp_4dEfGhJkLmNpQrSt'],
              description: 'Optional provider deployment ID'
            })
          ),
          name: v.optional(v.string({ examples: ['GitHub OAuth Setup'] })),
          description: v.optional(v.string({ examples: ['Connect your GitHub account'] })),
          metadata: v.optional(
            v.record(v.any(), {
              examples: [{ redirect_uri: 'https://app.example.com/callback' }]
            }),
            { description: 'Custom key-value pairs for storing additional information' }
          ),
          provider_auth_method_id: v.optional(
            v.string({
              examples: ['pam_2mNpQrStUvWxYzAb'],
              description: 'The authentication method to use (e.g., OAuth flow)'
            })
          ),
          provider_auth_credentials_id: v.optional(
            v.string({
              examples: ['pac_3nOpRsTuVwXyZaBc'],
              description: 'Optional OAuth app credentials to use instead of defaults'
            })
          ),
          identity_id: v.optional(
            v.string({
              examples: ['idn_3nOpRsTuVwXyZaBc'],
              description: 'Optional identity to link this setup session to'
            })
          ),
          consumer_id: v.optional(
            v.string({
              examples: ['con_1a2b3c4d5e6f7g8h'],
              description: 'Optional consumer to link this setup session to'
            })
          ),
          redirect_url: v.optional(
            v.string({ examples: ['https://app.example.com/oauth/callback'] })
          ),
          type: v.optional(
            v.enumOf([...providerSetupSessionTypes, 'auto'], {
              description:
                'The type of setup session, determining the flow and outcome of the session. `admin` creates an admin consent link for auth methods that support it, never creates credentials or configs, and cannot be bound to an identity, consumer, or config.'
            })
          ),
          configuration: providerSetupSessionConfigurationValidator,
          source: v.optional(v.enumOf(['explorer']), {
            description:
              'Create an owner-locked resource visible only to the caller from the dashboard explorer.'
          })
        })
      )
      .output(providerSetupSessionPresenter)
      .do(async ctx => {
        let provider = ctx.body.provider_id
          ? await providerService.getProviderById({
              instance: ctx.instance,
              providerId: ctx.body.provider_id
            })
          : undefined;
        let providerDeployment = ctx.body.provider_deployment_id
          ? await providerDeploymentService.getProviderDeploymentById({
              instance: ctx.instance,
              providerDeploymentId: ctx.body.provider_deployment_id
            })
          : undefined;
        let credentials = ctx.body.provider_auth_credentials_id
          ? await providerAuthCredentialsService.getProviderAuthCredentialsById({
              instance: ctx.instance,
              providerAuthCredentialsId: ctx.body.provider_auth_credentials_id
            })
          : undefined;
        let identity = ctx.body.identity_id
          ? await identityService.getIdentityById({
              instance: ctx.instance,
              identityId: ctx.body.identity_id
            })
          : undefined;

        let ownerActorId = await resolveExplorerOwner(ctx, ctx.body.source);

        let setupSession = await providerSetupSessionService.createProviderSetupSession({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          internal: {
            skipConfirmation: ctx.apiVersion === 'mt_2025_01_01_dashboard'
          },
          ownerActorId,
          source: ctx.body.source,
          isOwnerLocked: ctx.body.source === 'explorer' ? true : undefined,
          isOwnerOnlyVisible: ctx.body.source === 'explorer' ? true : undefined,
          provider,
          providerDeployment,
          credentials,
          identity,
          consumerId: ctx.body.consumer_id,
          import: {
            ip: ctx.context.ip,
            ua: ctx.context.ua ?? ''
          },
          input: {
            authMethodId: ctx.body.provider_auth_method_id,
            configuration: (ctx.body.configuration
              ? {
                  providerSearch: ctx.body.configuration.provider_search
                    ? {
                        groups: ctx.body.configuration.provider_search.groups?.map(group => ({
                          groupId: group.group_id
                        })),
                        collections: ctx.body.configuration.provider_search.collections?.map(
                          collection => ({
                            collectionId: collection.collection_id
                          })
                        ),
                        categories: ctx.body.configuration.provider_search.categories?.map(
                          category => ({
                            categoryId: category.category_id
                          })
                        )
                      }
                    : undefined,
                  toolFilters: ctx.body.configuration.tool_filters
                    ? { enabled: ctx.body.configuration.tool_filters.enabled }
                    : undefined,
                  ui: ctx.body.configuration.ui
                    ? {
                        layout: ctx.body.configuration.ui.layout
                      }
                    : undefined
                }
              : undefined) as any,
            name: ctx.body.name ?? 'Setup Session',
            description: ctx.body.description,
            uiMode: 'metorial_elements',
            type:
              ctx.body.type ??
              (ctx.apiVersion === 'mt_2025_01_01_dashboard' ? 'auth_only' : 'auto'),
            redirectUrl: ctx.body.redirect_url,
            metadata: ctx.body.metadata
          }
        });

        return providerSetupSessionPresenter.present(
          await hydrateResourceOwners({
            setupSession
          })
        );
      }),

    update: providerSetupSessionGroup
      .patch(
        instancePath(
          'provider-setup-sessions/:providerSetupSessionId',
          'providerDeployments.setupSessions.update'
        ),
        {
          name: 'Update provider setup session',
          description: 'Updates a specific provider setup session.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ examples: ['Updated Setup Session'] })),
          description: v.optional(
            v.string({ examples: ['Updated setup session description'] })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              examples: [{ redirect_uri: 'https://app.example.com/new-callback' }]
            }),
            { description: 'Custom key-value pairs for storing additional information' }
          ),
          identity_id: v.optional(
            v.string({
              examples: ['idn_3nOpRsTuVwXyZaBc'],
              description: 'Optional identity to link this setup session to'
            })
          )
        })
      )
      .output(providerSetupSessionPresenter)
      .do(async ctx => {
        let identity = ctx.body.identity_id
          ? await identityService.getIdentityById({
              instance: ctx.instance,
              identityId: ctx.body.identity_id
            })
          : undefined;
        let setupSession = await providerSetupSessionService.updateProviderSetupSession({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          providerSetupSession: ctx.setupSession,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            identity
          }
        });
        let [redactedSetupSession] =
          await providerSetupSessionService.redactProviderSetupSessionsForCaller({
            instance: ctx.instance,
            organizationActor: getOwnershipActor(ctx),
            setupSessions: [setupSession]
          });

        return providerSetupSessionPresenter.present(
          await hydrateResourceOwners({
            setupSession: redactedSetupSession!
          })
        );
      }),

    delete: providerSetupSessionGroup
      .delete(
        instancePath(
          'provider-setup-sessions/:providerSetupSessionId',
          'providerDeployments.setupSessions.delete'
        ),
        {
          name: 'Delete provider setup session',
          description: 'Deletes a provider setup session.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .output(providerSetupSessionPresenter)
      .do(async ctx => {
        let setupSession = await providerSetupSessionService.archiveProviderSetupSession({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          providerSetupSession: ctx.setupSession
        });

        return providerSetupSessionPresenter.present(
          await hydrateResourceOwners({ setupSession })
        );
      }),

    createEmails: providerSetupSessionGroup
      .post(
        instancePath(
          'provider-setup-sessions/:providerSetupSessionId/emails',
          'providerDeployments.setupSessions.emails.create'
        ),
        {
          name: 'Email provider setup session link',
          description: `Queues the link of an admin setup session for delivery to up to ${SETUP_SESSION_EMAIL_MAX_RECIPIENTS} recipients in total, given as email addresses and/or organization member IDs. Recipients are deduplicated case-insensitively and processed in order; if a later recipient fails, earlier ones may already have been queued, and retrying the request within the same window does not email them again. A recipient already emailed this setup link in the current fixed ${SETUP_SESSION_EMAIL_THROTTLE_WINDOW_MINUTES}-minute window is not emailed again; their earlier record is returned with \`deduplicated\` set to true. A setup link can be emailed to at most ${SETUP_SESSION_EMAIL_MAX_RECIPIENTS_PER_DAY} different recipients within 24 hours, and the setup links of an instance to at most ${SETUP_SESSION_EMAIL_MAX_RECIPIENTS_PER_INSTANCE_PER_DAY} different recipients combined; a request that would exceed either limit is rejected with \`admin_setup_email_limit_reached\` before any email is queued. Passing \`organization_member_ids\` also requires the \`organization.member:read\` scope, since the response contains the members' email addresses.`
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .body(
        'default',
        v.object({
          emails: v.optional(
            v.array(
              v.string({
                modifiers: [v.email()],
                examples: ['it-admin@example.com'],
                description: 'Email address to send the setup link to'
              }),
              {
                modifiers: [v.maxLength(SETUP_SESSION_EMAIL_MAX_RECIPIENTS)],
                description: `Email addresses to send the setup link to, at most ${SETUP_SESSION_EMAIL_MAX_RECIPIENTS}`
              }
            )
          ),
          organization_member_ids: v.optional(
            v.array(
              v.string({
                examples: ['ome_3nOpRsTuVwXyZaBc'],
                description: 'ID of an active member of the organization'
              }),
              {
                modifiers: [v.maxLength(SETUP_SESSION_EMAIL_MAX_RECIPIENTS)],
                description: `Organization members to send the setup link to, at most ${SETUP_SESSION_EMAIL_MAX_RECIPIENTS}. Each member is emailed at their organization profile email address, falling back to their account email when the profile has none.`
              }
            )
          )
        })
      )
      .outputList(providerSetupSessionEmailPresenter)
      .do(async ctx => {
        if (ctx.body.organization_member_ids?.length) {
          await accessService.checkAccess({
            authInfo: ctx.auth,
            possibleScopes: organizationMemberReadScopes
          });
          await accessService.checkTargetAccess({
            authInfo: ctx.auth,
            organization: ctx.organization,
            member: ctx.member,
            possibleScopes: organizationMemberReadScopes
          });
        }

        let results = await providerSetupSessionEmailService.createProviderSetupSessionEmails({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          organizationActor: getOwnershipActor(ctx),
          providerSetupSession: ctx.setupSession,
          input: {
            emails: ctx.body.emails,
            organizationMemberIds: ctx.body.organization_member_ids
          }
        });

        return Paginator.present(
          { items: results, pagination: { hasNextPage: false, hasPreviousPage: false } },
          result => providerSetupSessionEmailPresenter.present(result)
        );
      }),

    listEmails: providerSetupSessionGroup
      .get(
        instancePath(
          'provider-setup-sessions/:providerSetupSessionId/emails',
          'providerDeployments.setupSessions.emails.list'
        ),
        {
          name: 'List provider setup session emails',
          description:
            'Returns a paginated list of the emails queued for delivery with the link of a provider setup session. Emails addressed to organization members have `recipient_email` set to null unless the caller also has the `organization.member:read` scope.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .outputList(providerSetupSessionEmailPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await providerSetupSessionEmailService.listProviderSetupSessionEmails({
          instance: ctx.instance,
          organizationActor: getOwnershipActor(ctx),
          providerSetupSession: ctx.setupSession
        });

        let list = await paginator.run(ctx.query);

        let hideMemberRecipientEmail = !(await canReadOrganizationMembers({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member
        }));

        return Paginator.present(list, setupSessionEmail =>
          providerSetupSessionEmailPresenter.present({
            setupSessionEmail,
            hideMemberRecipientEmail
          })
        );
      })
  }
);
