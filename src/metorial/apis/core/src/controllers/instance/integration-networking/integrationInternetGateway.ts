import { v } from '@lowerdeck/validation';
import type { Organization, Project } from '@metorial/db';
import { flagService, isFlagEnabled } from '@metorial/module-flags';
import {
  integrationInternetGatewayNetworkLogService,
  integrationInternetGatewayService
} from '@metorial-subspace/module-enclave';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import {
  integrationInternetGatewayNetworkLogsPresenter,
  integrationInternetGatewayPresenter
} from '@metorial/presenters';
import { networkingInstanceGroup } from '../networking/_middleware';

let networkReadScopes = ['instance.network:read'] as const;

let getMaskPublicIp = async (organization: Organization, project: Project) => {
  let flags = await flagService.getFlags({ organization, project });
  return !isFlagEnabled(flags['paid-network-ip-access']);
};

export let integrationInternetGatewayController = Controller.create(
  {
    name: 'Integration Internet Gateway',
    description:
      'Read the internet gateway that integration enclaves use to reach and be reached from the internet.'
  },
  {
    get: networkingInstanceGroup
      .get(instancePath('integration-internet-gateway', 'integrationInternetGateway.get'), {
        name: 'Get integration internet gateway',
        description:
          'Retrieves the integration internet gateway of the instance, including its public IPs.'
      })
      .use(checkAccess({ possibleScopes: [...networkReadScopes] }))
      .output(integrationInternetGatewayPresenter)
      .do(async ctx => {
        let internetGateway = await integrationInternetGatewayService.get({
          instance: ctx.instance
        });
        let maskPublicIp = await getMaskPublicIp(ctx.instance.organization, ctx.project);

        return integrationInternetGatewayPresenter.present({ internetGateway, maskPublicIp });
      }),

    listNetworkLogs: networkingInstanceGroup
      .get(
        instancePath(
          'integration-internet-gateway/network-logs',
          'integrationInternetGateway.listNetworkLogs'
        ),
        {
          name: 'List integration internet gateway network logs',
          description:
            'Returns ingress or egress network logs for integration enclaves in the instance environment.'
        }
      )
      .use(checkAccess({ possibleScopes: [...networkReadScopes] }))
      .output(integrationInternetGatewayNetworkLogsPresenter)
      .query(
        'default',
        v.object({
          direction: v.enumOf(['ingress', 'egress']),
          enclave_id: v.optional(v.union([v.string(), v.array(v.string())])),
          hostname: v.optional(v.union([v.string(), v.array(v.string())])),
          ip: v.optional(v.union([v.string(), v.array(v.string())])),
          from: v.optional(v.string()),
          to: v.optional(v.string()),
          interval_minutes: v.optional(v.number())
        })
      )
      .do(async ctx => {
        let logs = await integrationInternetGatewayNetworkLogService.listNetworkLogs({
          instance: ctx.instance,
          direction: ctx.query.direction,
          enclaveIds: normalizeArrayParam(ctx.query.enclave_id),
          filters: {
            hostnames: normalizeArrayParam(ctx.query.hostname),
            ips: normalizeArrayParam(ctx.query.ip),
            from: ctx.query.from,
            to: ctx.query.to,
            intervalMinutes: ctx.query.interval_minutes
          }
        });

        return integrationInternetGatewayNetworkLogsPresenter.present({ logs });
      })
  }
);
