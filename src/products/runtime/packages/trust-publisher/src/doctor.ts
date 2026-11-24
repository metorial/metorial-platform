import { check } from '@lowerdeck/doctor';
import { describeTarget, type TrustPublisher } from './publisher';

export let trustPublisherCheck = (publisher: TrustPublisher) =>
  check({
    id: `runtime.trust-key.${publisher.signer}`,
    title: `The ${publisher.signer} signing key is published`,
    category: 'security',
    severity: 'critical',
    run: ctx => {
      let statuses = publisher.status();
      let failing = statuses.filter(publisher.isStale);
      let details = {
        kid: publisher.kid,
        targets: statuses.map(status => ({
          configMap: describeTarget(status.target),
          publishedAt: status.publishedAt?.toISOString() ?? null,
          lastError: status.lastError ?? null
        }))
      };

      if (failing.length) {
        return ctx.fail({
          message: failing
            .map(
              status =>
                status.lastError ??
                `${describeTarget(status.target)} has not been published yet.`
            )
            .join(' '),
          resolution: {
            summary:
              'Until the key is published, the egress gateway and function pods reject everything this service signs.',
            steps: [
              'Check that the trust ConfigMaps exist (helm upgrade recreates them).',
              'Check that this ServiceAccount may get and update them, and that NetworkPolicy lets it reach the Kubernetes API.'
            ]
          },
          details
        });
      }

      return ctx.pass(
        `Key ${publisher.kid} is published to ${statuses.map(status => describeTarget(status.target)).join(', ')}.`,
        details
      );
    }
  });
