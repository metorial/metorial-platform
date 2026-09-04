import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  networkPolicyService,
  type NetworkPolicyRuleInput
} from '@metorial-subspace/module-enclave';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { networkInstanceGroup } from './_middleware';
import { networkPolicyPresenter, networkPolicyRulePresenter } from '@metorial/presenters';
import { networkPolicyRuleValidator } from './_validators';

let networkReadScopes = ['instance.network:read'] as const;
let networkWriteScopes = ['instance.network:write'] as const;

export let networkPolicyGroup = networkInstanceGroup.use(async ctx => {
  if (!ctx.params.networkPolicyId) {
    throw new ServiceError(
      badRequestError({
        message: 'networkPolicyId is required',
        description: 'The networkPolicyId path parameter is required.'
      })
    );
  }

  let networkPolicy = await networkPolicyService.getNetworkPolicyById({
    instance: ctx.instance,
    networkPolicyId: ctx.params.networkPolicyId,
    allowDeleted: true
  });

  return { networkPolicy };
});

export let networkPolicyController = Controller.create(
  {
    name: 'Network Policies',
    description: 'Manage reusable network policy definitions and their rules.'
  },
  {
    list: networkInstanceGroup
      .get(instancePath('network-policies', 'networkPolicies.list'), {
        name: 'List network policies',
        description: 'Returns a paginated list of network policies.'
      })
      .use(checkAccess({ possibleScopes: [...networkReadScopes] }))
      .outputList(networkPolicyPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ])
            ),
            firewall_id: v.optional(v.union([v.string(), v.array(v.string())])),
            search: v.optional(v.string()),
            created_at: dateFilterValidator('network policy creation time'),
            updated_at: dateFilterValidator('network policy last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await networkPolicyService.listNetworkPolicies({
          instance: ctx.instance,
          allowDeleted: true,
          ids: normalizeArrayParam(ctx.query.id),
          status: normalizeArrayParam(ctx.query.status),
          firewallIds: normalizeArrayParam(ctx.query.firewall_id),
          search: ctx.query.search,
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, networkPolicy =>
          networkPolicyPresenter.present({
            networkPolicy
          })
        );
      }),

    get: networkPolicyGroup
      .get(instancePath('network-policies/:networkPolicyId', 'networkPolicies.get'), {
        name: 'Get network policy',
        description: 'Retrieves a specific network policy by ID.'
      })
      .use(checkAccess({ possibleScopes: [...networkReadScopes] }))
      .output(networkPolicyPresenter)
      .do(async ctx => networkPolicyPresenter.present({ networkPolicy: ctx.networkPolicy })),

    create: networkInstanceGroup
      .post(instancePath('network-policies', 'networkPolicies.create'), {
        name: 'Create network policy',
        description: 'Creates a new network policy.'
      })
      .use(checkAccess({ possibleScopes: [...networkWriteScopes] }))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          rules: v.optional(v.array(networkPolicyRuleValidator))
        })
      )
      .output(networkPolicyPresenter)
      .do(async ctx => {
        let networkPolicy = await networkPolicyService.createNetworkPolicy({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            rules: ctx.body.rules as NetworkPolicyRuleInput[] | undefined
          }
        });

        return networkPolicyPresenter.present({ networkPolicy });
      }),

    update: networkPolicyGroup
      .patch(instancePath('network-policies/:networkPolicyId', 'networkPolicies.update'), {
        name: 'Update network policy',
        description: 'Updates a network policy definition.'
      })
      .use(checkAccess({ possibleScopes: [...networkWriteScopes] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          rules: v.optional(v.array(networkPolicyRuleValidator))
        })
      )
      .output(networkPolicyPresenter)
      .do(async ctx => {
        let networkPolicy = await networkPolicyService.updateNetworkPolicy({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          networkPolicy: ctx.networkPolicy,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            rules: ctx.body.rules as NetworkPolicyRuleInput[] | undefined
          }
        });

        return networkPolicyPresenter.present({ networkPolicy });
      }),

    delete: networkPolicyGroup
      .delete(instancePath('network-policies/:networkPolicyId', 'networkPolicies.delete'), {
        name: 'Delete network policy',
        description: 'Archives a network policy.'
      })
      .use(checkAccess({ possibleScopes: [...networkWriteScopes] }))
      .output(networkPolicyPresenter)
      .do(async ctx => {
        await networkPolicyService.archiveNetworkPolicy({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          networkPolicy: ctx.networkPolicy
        });

        let networkPolicy = await networkPolicyService.getNetworkPolicyById({
          instance: ctx.instance,
          networkPolicyId: ctx.networkPolicy.id,
          allowDeleted: true
        });

        return networkPolicyPresenter.present({ networkPolicy });
      }),

    createRule: networkPolicyGroup
      .post(
        instancePath(
          'network-policies/:networkPolicyId/rules',
          'networkPolicies.rules.create'
        ),
        {
          name: 'Create network policy rule',
          description: 'Adds a rule to a network policy.'
        }
      )
      .use(checkAccess({ possibleScopes: [...networkWriteScopes] }))
      .body('default', networkPolicyRuleValidator)
      .output(networkPolicyRulePresenter)
      .do(async ctx => {
        let result = await networkPolicyService.addNetworkPolicyRule({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          networkPolicy: ctx.networkPolicy,
          input: {
            rule: {
              ...ctx.body,
              ports: ctx.body.ports as NetworkPolicyRuleInput['ports']
            }
          }
        });

        return networkPolicyRulePresenter.present({ rule: result.rule });
      }),

    updateRule: networkPolicyGroup
      .patch(
        instancePath(
          'network-policies/:networkPolicyId/rules/:ruleId',
          'networkPolicies.rules.update'
        ),
        {
          name: 'Update network policy rule',
          description: 'Updates a rule on a network policy.'
        }
      )
      .use(checkAccess({ possibleScopes: [...networkWriteScopes] }))
      .body('default', networkPolicyRuleValidator)
      .output(networkPolicyRulePresenter)
      .do(async ctx => {
        let result = await networkPolicyService.updateNetworkPolicyRule({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          networkPolicy: ctx.networkPolicy,
          ruleId: ctx.params.ruleId,
          input: {
            rule: {
              ...ctx.body,
              ports: ctx.body.ports as NetworkPolicyRuleInput['ports']
            }
          }
        });

        return networkPolicyRulePresenter.present({ rule: result.rule });
      }),

    deleteRule: networkPolicyGroup
      .delete(
        instancePath(
          'network-policies/:networkPolicyId/rules/:ruleId',
          'networkPolicies.rules.delete'
        ),
        {
          name: 'Delete network policy rule',
          description: 'Removes a rule from a network policy.'
        }
      )
      .use(checkAccess({ possibleScopes: [...networkWriteScopes] }))
      .output(networkPolicyPresenter)
      .do(async ctx => {
        let networkPolicy = await networkPolicyService.removeNetworkPolicyRule({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          networkPolicy: ctx.networkPolicy,
          ruleId: ctx.params.ruleId
        });

        return networkPolicyPresenter.present({ networkPolicy });
      })
  }
);
