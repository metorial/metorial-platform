import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { webhookRegistrationService } from '@metorial-subspace/module-callback';
import { webhookRegistrationPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import {
  getRequiredParam,
  stringOrArray,
  webhookRegistrationStatusValidator
} from './_shared';

export let webhookRegistrationGroup = instanceGroup.use(async ctx => {
  let webhookRegistration = await webhookRegistrationService.getWebhookRegistrationById({
    instance: ctx.instance,
    webhookRegistrationId: getRequiredParam(ctx.params, 'webhookRegistrationId'),
    allowDeleted: false
  });

  return { webhookRegistration };
});

export let webhookRegistrationController = Controller.create(
  {
    name: 'Webhook Registrations',
    description:
      'Webhook registrations give you a Metorial-hosted URL to point a provider at, so the provider can deliver webhooks that turn into callback events.'
  },
  {
    list: instanceGroup
      .get(instancePath('webhook-registrations', 'webhookRegistrations.list'), {
        name: 'List webhook registrations',
        description: 'Returns a paginated list of webhook registrations.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .outputList(webhookRegistrationPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(stringOrArray(), {
              description: 'Filter by webhook registration ID(s)'
            }),
            provider_id: v.optional(stringOrArray(), {
              description: 'Filter by provider ID(s)'
            }),
            status: v.optional(
              v.union([
                webhookRegistrationStatusValidator,
                v.array(webhookRegistrationStatusValidator)
              ]),
              { description: 'Filter by webhook registration lifecycle status' }
            ),
            created_at: dateFilterValidator('webhook registration creation time'),
            updated_at: dateFilterValidator('webhook registration last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await webhookRegistrationService.listWebhookRegistrations({
          instance: ctx.instance,
          allowDeleted: false,
          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          status: normalizeArrayParam(ctx.query.status),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        return Paginator.present(await paginator.run(ctx.query), webhookRegistration =>
          webhookRegistrationPresenter.present({ webhookRegistration })
        );
      }),

    get: webhookRegistrationGroup
      .get(
        instancePath(
          'webhook-registrations/:webhookRegistrationId',
          'webhookRegistrations.get'
        ),
        {
          name: 'Get webhook registration',
          description: 'Retrieves a specific webhook registration by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .output(webhookRegistrationPresenter)
      .do(async ctx =>
        webhookRegistrationPresenter.present({
          webhookRegistration: ctx.webhookRegistration
        })
      ),

    create: instanceGroup
      .post(instancePath('webhook-registrations', 'webhookRegistrations.create'), {
        name: 'Create webhook registration',
        description:
          'Creates a webhook registration for a provider. Only providers whose type reports `triggers.webhook_registration.status` as `supported` can receive one. The registration starts out awaiting setup.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .body(
        'default',
        v.object({
          provider_id: v.string({
            description: 'Provider to register the webhook receiver on',
            examples: ['pro_5gHjKlMnPqRsTuVw']
          }),
          name: v.string({
            description: 'Display name for the webhook registration',
            examples: ['Production GitHub Webhook']
          }),
          description: v.optional(
            v.string({
              description: 'Optional webhook registration description',
              examples: ['Receives repository events for the production workspace']
            })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description:
                'Custom key-value pairs for storing additional webhook registration metadata',
              examples: [{ environment: 'production', owner: 'platform-team' }]
            })
          )
        })
      )
      .output(webhookRegistrationPresenter)
      .do(async ctx => {
        let webhookRegistration = await webhookRegistrationService.createWebhookRegistration({
          instance: ctx.instance,
          provider: { id: ctx.body.provider_id },
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          }
        });

        return webhookRegistrationPresenter.present({ webhookRegistration });
      }),

    setup: webhookRegistrationGroup
      .post(
        instancePath(
          'webhook-registrations/:webhookRegistrationId/setup',
          'webhookRegistrations.setup'
        ),
        {
          name: 'Complete webhook registration setup',
          description:
            'Submits the provider-specific configuration described by the registration setup document, activating the registration.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .body(
        'default',
        v.object({
          user_config: v.record(v.any(), {
            description:
              'Provider-specific values collected from the setup document, such as a signing secret copied out of the provider dashboard',
            examples: [{ signing_secret: 'whsec_1aBcDeFgHjKlMnPq' }]
          })
        })
      )
      .output(webhookRegistrationPresenter)
      .do(async ctx => {
        let webhookRegistration =
          await webhookRegistrationService.finishWebhookRegistrationSetup({
            instance: ctx.instance,
            webhookRegistration: ctx.webhookRegistration,
            input: { userConfig: ctx.body.user_config }
          });

        return webhookRegistrationPresenter.present({ webhookRegistration });
      }),

    update: webhookRegistrationGroup
      .patch(
        instancePath(
          'webhook-registrations/:webhookRegistrationId',
          'webhookRegistrations.update'
        ),
        {
          name: 'Update webhook registration',
          description: 'Updates a webhook registration.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(
            v.string({
              description: 'Updated display name',
              examples: ['Staging GitHub Webhook']
            })
          ),
          description: v.optional(
            v.nullable(
              v.string({
                description: 'Updated description',
                examples: ['Receives repository events for the staging workspace']
              })
            )
          ),
          metadata: v.optional(
            v.nullable(
              v.record(v.any(), {
                description: 'Updated custom metadata',
                examples: [{ environment: 'staging', owner: 'qa-team' }]
              })
            )
          )
        })
      )
      .output(webhookRegistrationPresenter)
      .do(async ctx => {
        let webhookRegistration = await webhookRegistrationService.updateWebhookRegistration({
          instance: ctx.instance,
          webhookRegistration: ctx.webhookRegistration,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata
          }
        });

        return webhookRegistrationPresenter.present({ webhookRegistration });
      }),

    delete: webhookRegistrationGroup
      .delete(
        instancePath(
          'webhook-registrations/:webhookRegistrationId',
          'webhookRegistrations.delete'
        ),
        {
          name: 'Delete webhook registration',
          description:
            'Archives a webhook registration. The receiver is torn down on the provider before the record is removed for good.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .output(webhookRegistrationPresenter)
      .do(async ctx => {
        let webhookRegistration = await webhookRegistrationService.archiveWebhookRegistration({
          instance: ctx.instance,
          webhookRegistration: ctx.webhookRegistration
        });

        return webhookRegistrationPresenter.present({ webhookRegistration });
      })
  }
);
