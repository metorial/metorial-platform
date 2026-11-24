import { Service } from '@lowerdeck/service';
import type { CallOptions } from '@mtsrc/ai-gateway-dialects';
import { billingService } from '@mtsrc/ai-gateway-module-billing';
import {
  platformConnectionRegistry,
  providerConnectionService
} from '@mtsrc/ai-gateway-module-credentials';
import { inferenceLogService } from '@mtsrc/ai-gateway-module-logs';
import { virtualModelRoutingService } from '@mtsrc/ai-gateway-module-virtual-models';
import {
  countProviderTokens,
  createProviderLanguageModel,
  prepareProviderCallOptions,
  providerCountsTokens
} from '@mtsrc/ai-gateway-providers';
import { unlimitedLimiter, type InferenceLimiter } from '../lib/limiter';
import {
  createInferenceRunner,
  type InferenceRequest,
  type InferenceRunner,
  type InferenceRunnerDependencies
} from '../lib/runner';

export let createProductionRunner = (d: {
  limiter: InferenceLimiter;
  fetch?: typeof fetch;
}): InferenceRunner => {
  let dependencies: InferenceRunnerDependencies = {
    route: route => virtualModelRoutingService.route(route),

    resolveConnection: async candidate =>
      candidate.connectionOwner == 'customer'
        ? await providerConnectionService.getInferenceConnection({
            connectionId: candidate.connectionId
          })
        : {
            credentials: platformConnectionRegistry.credentials(
              candidate.platformConnectionSlug
            ),
            config: platformConnectionRegistry.config(candidate.platformConnectionSlug)
          },

    createModel: ({ candidate, connection }) =>
      createProviderLanguageModel({
        providerSlug: candidate.providerSlug,
        credentials: connection.credentials,
        config: connection.config,
        modelId: candidate.vendorModelId,
        fetch: d.fetch
      }),

    prepareOptions: ({ providerSlug, options }) =>
      prepareProviderCallOptions({ providerSlug, options }) as CallOptions,

    countTokens: async ({ candidate, connection, body, signal }) =>
      providerCountsTokens(candidate.providerSlug)
        ? await countProviderTokens({
            providerSlug: candidate.providerSlug,
            credentials: connection.credentials,
            config: connection.config,
            modelId: candidate.vendorModelId,
            body,
            signal,
            fetch: d.fetch
          })
        : null,

    reportAuthFailure: candidate => {
      if (candidate.connectionOwner == 'platform') {
        platformConnectionRegistry.reportAuthFailure(candidate.platformConnectionSlug);
        return;
      }

      void providerConnectionService
        .reportAuthFailure({ connectionId: candidate.connectionId })
        .catch(error =>
          console.error('[ai-gateway] Could not schedule a connection check', error)
        );
    },

    recordLog: record => inferenceLogService.record(record),
    newLogId: () => inferenceLogService.newLogId(),
    limiter: d.limiter,
    chargeBilledUsage: usage => billingService.charge(usage)
  };

  return createInferenceRunner(dependencies);
};

let runner = createProductionRunner({ limiter: unlimitedLimiter });

class InferenceServiceImpl {
  setLimiter(limiter: InferenceLimiter) {
    runner = createProductionRunner({ limiter });
  }

  async run(request: InferenceRequest) {
    return await runner.run(request);
  }
}

export let inferenceService = Service.create(
  'inferenceService',
  () => new InferenceServiceImpl()
).build();
