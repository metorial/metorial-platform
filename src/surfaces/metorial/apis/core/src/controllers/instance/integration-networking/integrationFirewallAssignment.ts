import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  integrationFirewallAssignmentService,
  type FirewallAssignmentInput
} from '@metorial-subspace/module-enclave';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { networkingInstanceGroup } from '../networking/_middleware';
import { integrationFirewallAssignmentPresenter } from '@metorial/presenters';
import { firewallAssignmentTargetValidator } from './_validators';

let networkReadScopes = ['instance.network:read'] as const;
let networkWriteScopes = ['instance.network:write'] as const;

export let integrationFirewallAssignmentGroup = networkingInstanceGroup.use(async ctx => {
  if (!ctx.params.integrationFirewallAssignmentId) {
    throw new ServiceError(
      badRequestError({
        message: 'integrationFirewallAssignmentId is required',
        description: 'The integrationFirewallAssignmentId path parameter is required.'
      })
    );
  }

  let firewallAssignment =
    await integrationFirewallAssignmentService.getFirewallAssignmentById({
      instance: ctx.instance,
      firewallAssignmentId: ctx.params.integrationFirewallAssignmentId
    });

  return { firewallAssignment };
});

export let integrationFirewallAssignmentController = Controller.create(
  {
    name: 'Integration Firewall Assignments',
    description:
      'An integration firewall assignment is a firewall applied to one target. Targets are integration enclaves, providers, or the integration internet gateway.'
  },
  {
    list: networkingInstanceGroup
      .get(
        instancePath(
          'integration-firewall-assignments',
          'integrationFirewallAssignments.list'
        ),
        {
          name: 'List integration firewall assignments',
          description:
            'Returns a paginated list of integration firewall assignments in the instance.'
        }
      )
      .use(checkAccess({ possibleScopes: [...networkReadScopes] }))
      .outputList(integrationFirewallAssignmentPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return integration firewall assignments with one of these IDs.'
            }),
            firewall_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return assignments applying one of these firewalls.'
            }),
            enclave_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return assignments targeting one of these enclaves.'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return assignments targeting one of these providers.'
            }),
            internet_gateway_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return assignments targeting one of these internet gateways.'
            }),
            target_type: v.optional(
              v.union([
                v.enumOf(['enclave', 'provider', 'internet_gateway']),
                v.array(v.enumOf(['enclave', 'provider', 'internet_gateway']))
              ]),
              {
                description: 'Only return assignments with one of these target types.'
              }
            ),
            created_at: dateFilterValidator('integration firewall assignment creation time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await integrationFirewallAssignmentService.listFirewallAssignments({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          firewallIds: normalizeArrayParam(ctx.query.firewall_id),
          enclaveIds: normalizeArrayParam(ctx.query.enclave_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          internetGatewayIds: normalizeArrayParam(ctx.query.internet_gateway_id),
          targetTypes: normalizeArrayParam(ctx.query.target_type),
          createdAt: ctx.query.created_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, firewallAssignment =>
          integrationFirewallAssignmentPresenter.present({
            firewallAssignment
          })
        );
      }),

    get: integrationFirewallAssignmentGroup
      .get(
        instancePath(
          'integration-firewall-assignments/:integrationFirewallAssignmentId',
          'integrationFirewallAssignments.get'
        ),
        {
          name: 'Get integration firewall assignment',
          description: 'Retrieves an integration firewall assignment.'
        }
      )
      .use(checkAccess({ possibleScopes: [...networkReadScopes] }))
      .output(integrationFirewallAssignmentPresenter)
      .do(async ctx =>
        integrationFirewallAssignmentPresenter.present({
          firewallAssignment: ctx.firewallAssignment
        })
      ),

    create: networkingInstanceGroup
      .post(
        instancePath(
          'integration-firewall-assignments',
          'integrationFirewallAssignments.create'
        ),
        {
          name: 'Create integration firewall assignment',
          description: 'Creates an integration firewall assignment.'
        }
      )
      .use(checkAccess({ possibleScopes: [...networkWriteScopes] }))
      .body(
        'default',
        v.intersection([
          v.object({
            firewall_id: v.string({
              description: 'Firewall to apply to the target.'
            })
          }),
          firewallAssignmentTargetValidator
        ])
      )
      .output(integrationFirewallAssignmentPresenter)
      .do(async ctx => {
        let firewallAssignment =
          await integrationFirewallAssignmentService.createFirewallAssignment({
            instance: ctx.instance,
            auditScope: ctx.auditScope,
            firewallId: ctx.body.firewall_id,
            input: {
              targetType: ctx.body.target_type,
              enclaveId: ctx.body.enclave_id,
              providerId: ctx.body.provider_id
            } as FirewallAssignmentInput
          });

        return integrationFirewallAssignmentPresenter.present({ firewallAssignment });
      }),

    delete: integrationFirewallAssignmentGroup
      .delete(
        instancePath(
          'integration-firewall-assignments/:integrationFirewallAssignmentId',
          'integrationFirewallAssignments.delete'
        ),
        {
          name: 'Delete integration firewall assignment',
          description:
            'Permanently deletes an integration firewall assignment. The firewall stops applying to the target.'
        }
      )
      .use(checkAccess({ possibleScopes: [...networkWriteScopes] }))
      .output(integrationFirewallAssignmentPresenter)
      .do(async ctx => {
        let firewallAssignment = ctx.firewallAssignment;

        await integrationFirewallAssignmentService.deleteFirewallAssignment({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          firewallAssignment
        });

        return integrationFirewallAssignmentPresenter.present({ firewallAssignment });
      })
  }
);
