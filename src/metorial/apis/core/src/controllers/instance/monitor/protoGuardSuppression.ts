import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { protoGuardSuppressionService } from '@metorial-subspace/module-monitor';
import { protoGuardSuppressionPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { getRequiredParam, stringOrArray } from './_shared';

let suppressionStatusValidator = v.enumOf(['active', 'archived'] as const);

export let protoGuardSuppressionController = Controller.create(
  {
    name: 'ProtoGuard Suppression',
    description:
      'ProtoGuard suppressions mark known-benign findings so they no longer raise alerts.'
  },
  {
    list: instanceGroup
      .get(instancePath('protoguard-suppressions', 'protoGuardSuppressions.list'), {
        name: 'List ProtoGuard suppressions',
        description: 'Returns the ProtoGuard suppressions of this instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:read'] }))
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([suppressionStatusValidator, v.array(suppressionStatusValidator)]),
              {
                name: 'status',
                description:
                  'Only return suppressions with these statuses. Defaults to active.'
              }
            ),
            filter_id: v.optional(stringOrArray(), {
              name: 'filter_id',
              description: 'Only return suppressions of these filters, by id or key.'
            }),
            provider_id: v.optional(stringOrArray(), {
              name: 'provider_id',
              description: 'Only return suppressions scoped to these providers.'
            })
          })
        )
      )
      .outputList(protoGuardSuppressionPresenter)
      .do(async ctx => {
        let paginator = await protoGuardSuppressionService.listSuppressions({
          instance: ctx.instance,
          statuses: normalizeArrayParam(ctx.query.status),
          filterIds: normalizeArrayParam(ctx.query.filter_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, suppression =>
          protoGuardSuppressionPresenter.present({ suppression })
        );
      }),

    get: instanceGroup
      .get(
        instancePath('protoguard-suppressions/:suppressionId', 'protoGuardSuppressions.get'),
        {
          name: 'Get ProtoGuard suppression',
          description: 'Retrieves a ProtoGuard suppression.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.monitor:read'] }))
      .output(protoGuardSuppressionPresenter)
      .do(async ctx => {
        let suppression = await protoGuardSuppressionService.getSuppressionById({
          instance: ctx.instance,
          suppressionId: getRequiredParam(ctx.params, 'suppressionId')
        });

        return protoGuardSuppressionPresenter.present({ suppression });
      }),

    create: instanceGroup
      .post(instancePath('protoguard-suppressions', 'protoGuardSuppressions.create'), {
        name: 'Create ProtoGuard suppression',
        description:
          'Suppresses future findings of a filter, optionally narrowed to a provider, tool, or specific matched content.'
      })
      .use(checkAccess({ possibleScopes: ['instance.monitor:manage'] }))
      .body(
        'default',
        v.object({
          filter_id: v.string({
            name: 'filter_id',
            description: 'The filter to suppress, by id or key.',
            examples: ['instruction_override']
          }),
          provider_id: v.optional(
            v.nullable(
              v.string({
                name: 'provider_id',
                description: 'Only suppress findings from this provider.'
              })
            )
          ),
          tool_key: v.optional(
            v.nullable(
              v.string({
                name: 'tool_key',
                description: 'Only suppress findings from this tool.'
              })
            )
          ),
          content_hash: v.optional(
            v.nullable(
              v.string({
                name: 'content_hash',
                description:
                  'Only suppress findings with this content hash, as reported on a ProtoGuard alert finding.'
              })
            )
          ),
          reason: v.optional(
            v.nullable(
              v.string({
                name: 'reason',
                description: 'Why the findings are considered benign.'
              })
            )
          ),
          expires_at: v.optional(
            v.nullable(
              v.date({
                name: 'expires_at',
                description: 'When the suppression stops applying. Omit to never expire.'
              })
            )
          )
        })
      )
      .output(protoGuardSuppressionPresenter)
      .do(async ctx => {
        let suppression = await protoGuardSuppressionService.createSuppression({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          input: {
            filterId: ctx.body.filter_id,
            providerId: ctx.body.provider_id,
            toolKey: ctx.body.tool_key,
            contentHmac: ctx.body.content_hash,
            reason: ctx.body.reason,
            expiresAt: ctx.body.expires_at
          }
        });

        return protoGuardSuppressionPresenter.present({ suppression });
      }),

    archive: instanceGroup
      .post(
        instancePath(
          'protoguard-suppressions/:suppressionId/archive',
          'protoGuardSuppressions.archive'
        ),
        {
          name: 'Archive ProtoGuard suppression',
          description: 'Archives a ProtoGuard suppression so matching findings alert again.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.monitor:manage'] }))
      .output(protoGuardSuppressionPresenter)
      .do(async ctx => {
        let suppression = await protoGuardSuppressionService.getSuppressionById({
          instance: ctx.instance,
          suppressionId: getRequiredParam(ctx.params, 'suppressionId')
        });

        let archived = await protoGuardSuppressionService.archiveSuppression({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          suppression
        });

        return protoGuardSuppressionPresenter.present({ suppression: archived });
      })
  }
);
