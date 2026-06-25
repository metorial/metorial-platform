import { getSentry } from '@lowerdeck/sentry';
import { connect, type NatsConnection, type Subscription } from 'nats';
import type { NatsConfig } from '../../types/config';
import type { ITransportAdapter, MessageHandler } from './transportAdapter';

let Sentry = getSentry();

interface ActiveSubscription {
  subject: string;
  handler: MessageHandler;
  sub: Subscription;
  closed: boolean;
}

export class NatsTransport implements ITransportAdapter {
  private nc: Promise<NatsConnection>;
  private subscriptions: Map<string, ActiveSubscription> = new Map();
  private nextSubId = 0;
  private resubscribeCount = 0;

  constructor(private config: NatsConfig) {
    console.log(
      `CONDUIT.nats.constructor servers=${config.servers.join(',')} user=${config.user ?? 'none'} hasToken=${!!config.token} hasPass=${!!config.pass}`
    );
    this.nc = connect({
      servers: this.config.servers,
      token: this.config.token,
      user: this.config.user,
      pass: this.config.pass,

      waitOnFirstConnect: true
    });

    this.nc
      .then(nc => {
        console.log(`CONDUIT.nats.connected servers=${config.servers.join(',')}`);

        nc.closed().then(err => {
          if (err) {
            console.log(`CONDUIT.nats.closed_with_error error=${err.message}`);
          } else {
            console.log(`CONDUIT.nats.closed`);
          }
        });

        (async () => {
          for await (let status of nc.status()) {
            console.log(
              `CONDUIT.nats.status type=${status.type} data=${String(status.data ?? '')}`
            );
          }
        })();
      })
      .catch(err => {
        console.log(
          `CONDUIT.nats.connect_error servers=${config.servers.join(',')} error=${err.message}`
        );
      });
  }

  async publish(subject: string, data: Uint8Array): Promise<void> {
    let nc = await this.nc;
    nc.publish(subject, data);
  }

  async request(subject: string, data: Uint8Array, timeout: number): Promise<Uint8Array> {
    let nc = await this.nc;

    let response = await nc.request(subject, data, { timeout });
    return response.data;
  }

  async subscribe(subject: string, handler: MessageHandler): Promise<string> {
    let nc = await this.nc;

    let id = `sub-${this.nextSubId++}`;
    let entry: ActiveSubscription = {
      subject,
      handler,
      sub: nc.subscribe(subject),
      closed: false
    };

    this.subscriptions.set(id, entry);

    // Drain messages in the background. The read loop must NEVER await the
    // handler. One slow/never-returning handler cannot not stop us from reading
    // later messages (the head-of-line blocking that wedged receivers). We
    // dispatch fire-and-forget; backpressure/concurrency is enforced by the
    // receiver. If the iterator ends or throws while the subscription is still
    // open, we re-create it instead of dying permanently (the restart-only
    // failure mode).
    this.runReadLoop(id);

    return id;
  }

  private runReadLoop(id: string): void {
    (async () => {
      while (true) {
        let entry = this.subscriptions.get(id);
        if (!entry || entry.closed) return;

        try {
          for await (let msg of entry.sub) {
            // Fire-and-forget: do not block the read loop on handler execution.
            Promise.resolve()
              .then(() => entry!.handler(msg.data))
              .catch(err => {
                console.error(
                  `CONDUIT.nats.message_handler_error subscriptionId=${id} subject=${entry!.subject} error=${err instanceof Error ? err.message : String(err)}`,
                  err
                );
              });
          }
        } catch (err) {
          Sentry.captureException(err);
          console.error(
            `CONDUIT.nats.subscription_error subscriptionId=${id} subject=${entry.subject} error=${err instanceof Error ? err.message : String(err)}`,
            err
          );
        }

        // The iterator ended. If we intentionally unsubscribed, stop.
        let current = this.subscriptions.get(id);
        if (!current || current.closed) return;

        // Otherwise the subscription died unexpectedly while the connection is
        // (hopefully) still up. Re-create it so the receiver keeps draining.
        let nc: NatsConnection;
        try {
          nc = await this.nc;
        } catch {
          return;
        }
        if (current.closed) return;

        await new Promise(resolve => setTimeout(resolve, 250));
        if (current.closed) return;

        try {
          current.sub = nc.subscribe(current.subject);
          this.resubscribeCount++;
          console.log(
            `CONDUIT.nats.resubscribe subscriptionId=${id} subject=${current.subject} totalResubscribes=${this.resubscribeCount}`
          );
        } catch (err) {
          Sentry.captureException(err);
          console.error(
            `CONDUIT.nats.resubscribe_failed subscriptionId=${id} subject=${current.subject} error=${err instanceof Error ? err.message : String(err)}`,
            err
          );
          // Back off and retry the resubscribe on the next loop iteration.
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    })();
  }

  getResubscribeCount(): number {
    return this.resubscribeCount;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    let entry = this.subscriptions.get(subscriptionId);
    if (entry) {
      entry.closed = true;
      entry.sub.unsubscribe();
      this.subscriptions.delete(subscriptionId);
    }
  }

  async close(): Promise<void> {
    console.log(`CONDUIT.nats.close subscriptionCount=${this.subscriptions.size}`);
    let nc = await this.nc;

    // Unsubscribe all
    for (let [id, entry] of this.subscriptions.entries()) {
      console.log(`CONDUIT.nats.close.unsubscribe subscriptionId=${id}`);
      entry.closed = true;
      entry.sub.unsubscribe();
    }
    this.subscriptions.clear();

    // Close connection
    await nc.close();
    console.log(`CONDUIT.nats.close.done`);
    this.nc = null as any;
  }
}
