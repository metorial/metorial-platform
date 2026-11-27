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
      'An integration internet gateway is the shared network exit for integration enclaves in an instance. Enclaves use it to reach the internet and be reached from it.'
  },
  {
    get: networkingInstanceGroup
      .get(instancePath('integration-internet-gateway', 'integrationInternetGateway.get'), {
        name: 'Get integration internet gateway',
        description:
          "Retrieves the instance's integration internet gateway. Public IPs are masked as `x.x.x.x` unless your plan includes IP access."
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
            'Returns network logs for integration enclaves in the instance. Set `direction` to choose ingress or egress logs.'
        }
      )
      .use(checkAccess({ possibleScopes: [...networkReadScopes] }))
      .output(integrationInternetGatewayNetworkLogsPresenter)
      .query(
        'default',
        v.object({
          direction: v.enumOf(['ingress', 'egress'], {
            description: 'Whether to return ingress or egress logs.'
          }),
          enclave_id: v.optional(v.union([v.string(), v.array(v.string())]), {
            description: 'Only return logs for one of these enclaves.'
          }),
          hostname: v.optional(v.union([v.string(), v.array(v.string())]), {
            description: 'Only return logs for one of these hostnames.'
          }),
          ip: v.optional(v.union([v.string(), v.array(v.string())]), {
            description: 'Only return logs for one of these IPs.'
          }),
          from: v.optional(
            v.string({
              description: 'Only return logs at or after this time, as an ISO timestamp.'
            })
          ),
          to: v.optional(
            v.string({
              description: 'Only return logs at or before this time, as an ISO timestamp.'
            })
          ),
          interval_minutes: v.optional(
            v.number({
              description: 'Bucket size in minutes.'
            })
          )
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
