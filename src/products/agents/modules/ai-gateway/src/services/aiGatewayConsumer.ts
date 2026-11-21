import { Service } from '@lowerdeck/service';
import { consumerService } from '@metorial/module-consumer-core';
import type { ScopedInstance } from '../lib/scope';

export type AiGatewayConsumer = Awaited<ReturnType<typeof consumerService.getConsumerById>>;

export class AiGatewayConsumerLookup {
  constructor(private readonly consumers: Map<string, AiGatewayConsumer>) {}

  get(ref: string | null | undefined) {
    return (ref ? this.consumers.get(ref) : undefined) ?? null;
  }
}

class AiGatewayConsumerServiceImpl {
  async resolveRef(d: { instance: ScopedInstance; consumerId: string }) {
    let consumer = await consumerService.getConsumerById(d);

    return consumer.id;
  }

  async findForRefs(d: { instance: ScopedInstance; refs: (string | null | undefined)[] }) {
    let refs = [...new Set(d.refs.filter((ref): ref is string => !!ref))];
    let consumers = await consumerService.findConsumersById({
      instance: d.instance,
      consumerIds: refs
    });

    return new AiGatewayConsumerLookup(
      new Map(consumers.map(consumer => [consumer.id, consumer]))
    );
  }
}

export let aiGatewayConsumerService = Service.create(
  'aiGatewayConsumerService',
  () => new AiGatewayConsumerServiceImpl()
).build();
