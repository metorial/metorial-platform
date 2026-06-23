import { getSentry } from '@lowerdeck/sentry';
import { connect, type NatsConnection, type Subscription } from 'nats';
import type { NatsConfig } from '../../types/config';
import type { ITransportAdapter, MessageHandler } from './transportAdapter';

let Sentry = getSentry();

export class NatsTransport implements ITransportAdapter {
  private nc: Promise<NatsConnection>;
  private subscriptions: Map<string, Subscription> = new Map();
  private nextSubId = 0;

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
    let sub = nc.subscribe(subject);

    // Store subscription
    this.subscriptions.set(id, sub);

    // Process messages in background
    (async () => {
      try {
        for await (let msg of sub) {
          try {
            await handler(msg.data);
          } catch (err) {
            console.error(
              `CONDUIT.nats.message_handler_error subscriptionId=${id} subject=${subject} error=${err instanceof Error ? err.message : String(err)}`,
              err
            );
          }
        }
      } catch (err) {
        Sentry.captureException(err);
        console.error(
          `CONDUIT.nats.subscription_error subscriptionId=${id} subject=${subject} error=${err instanceof Error ? err.message : String(err)}`,
          err
        );
      }
    })();

    return id;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    let sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      sub.unsubscribe();
      this.subscriptions.delete(subscriptionId);
    } else {
    }
  }

  async close(): Promise<void> {
    console.log(`CONDUIT.nats.close subscriptionCount=${this.subscriptions.size}`);
    let nc = await this.nc;

    // Unsubscribe all
    for (let [id, sub] of this.subscriptions.entries()) {
      console.log(`CONDUIT.nats.close.unsubscribe subscriptionId=${id}`);
      sub.unsubscribe();
    }
    this.subscriptions.clear();

    // Close connection
    await nc.close();
    console.log(`CONDUIT.nats.close.done`);
    this.nc = null as any;
  }
}
