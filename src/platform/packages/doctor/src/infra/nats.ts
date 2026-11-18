import { check, probes, type CheckDefinition } from '@lowerdeck/doctor';
import { attempt } from '../resolutions';

let minimumMaxPayload = 32 * 1024 * 1024;

export interface NatsLike {
  flush: () => Promise<void>;
  info?: { max_payload?: number } | null;
}

export let natsChecks = (options: {
  connection: NatsLike | (() => NatsLike | Promise<NatsLike>);
  roundTrip?: () => Promise<void>;
}): CheckDefinition[] => {
  let target = 'nats/default';
  let base = { category: 'messaging' as const, target, dependsOn: ['nats.connect'] };
  let connection = async () =>
    typeof options.connection == 'function' ? await options.connection() : options.connection;

  let checks: CheckDefinition[] = [
    check({
      id: 'nats.connect',
      title: 'NATS is reachable',
      category: 'messaging',
      severity: 'critical',
      target,
      run: ctx =>
        attempt(ctx, 'nats', async () => probes.nats({ connection: await connection() })(ctx))
    }),

    check({
      ...base,
      id: 'nats.max-payload',
      title: 'NATS accepts large messages',
      severity: 'critical',
      run: async ctx => {
        let maxPayload = (await connection()).info?.max_payload;
        if (!maxPayload) return ctx.skip('The server did not report max_payload.');

        let details = { maxPayloadMb: Math.round(maxPayload / 1024 / 1024) };
        if (maxPayload >= minimumMaxPayload) {
          return ctx.pass(`max_payload is ${details.maxPayloadMb} MiB.`, details);
        }

        return ctx.fail({
          message: `max_payload is ${details.maxPayloadMb} MiB; Metorial needs at least 32 MiB.`,
          resolution: {
            summary: 'Set max_payload: 33554432 in the NATS server configuration.',
            docs: 'datacenter/operations/doctor#nats'
          },
          details
        });
      }
    })
  ];

  if (options.roundTrip) {
    let roundTrip = options.roundTrip;

    checks.push(
      check({
        ...base,
        id: 'nats.round-trip',
        title: 'NATS delivers messages',
        severity: 'critical',
        run: ctx =>
          attempt(ctx, 'nats', async () => {
            await roundTrip();
            return ctx.pass('A request on a private inbox was answered.');
          })
      })
    );
  }

  return checks;
};
