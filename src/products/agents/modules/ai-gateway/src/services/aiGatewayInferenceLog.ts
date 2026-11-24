import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AiGatewayInferenceLog } from '../lib/client';
import { createGatewayLogPaginator } from '../lib/paginator';
import type { ScopedInstance } from '../lib/scope';
import { aiGatewayTenantService } from './aiGatewayTenant';

class AiGatewayInferenceLogServiceImpl {
  list(d: {
    instance: ScopedInstance;
    gatewayTokenId?: string;
    consumerRef?: string;
    modelSlug?: string;
    virtualModelId?: string;
    status?: AiGatewayInferenceLog['status'];
  }) {
    return createGatewayLogPaginator(async page => {
      let { gateway, scope } = await aiGatewayTenantService.ensure(d);

      return await gateway.inferenceLog.list({
        ...scope,
        gatewayTokenId: d.gatewayTokenId,
        consumerRef: d.consumerRef,
        modelSlug: d.modelSlug,
        virtualModelId: d.virtualModelId,
        status: d.status,
        ...page
      });
    });
  }

  async get(d: {
    instance: ScopedInstance;
    inferenceLogId: string;
    includeContent?: boolean;
  }) {
    let { gateway, scope, gatewayInstanceId } = await aiGatewayTenantService.ensure(d);

    let log = await gateway.inferenceLog.get({
      organizationId: scope.organizationId,
      inferenceLogId: d.inferenceLogId,
      includeContent: d.includeContent
    });
    if (log.instanceId != gatewayInstanceId) {
      throw new ServiceError(notFoundError('ai_gateway_inference_log', d.inferenceLogId));
    }

    return log;
  }
}

export let aiGatewayInferenceLogService = Service.create(
  'aiGatewayInferenceLogService',
  () => new AiGatewayInferenceLogServiceImpl()
).build();
