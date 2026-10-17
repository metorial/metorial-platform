import { v } from '@lowerdeck/validation';

export type RawOwnerActor = {
  id: string;
  type: 'person' | 'agent' | 'consumer';
  instanceConsumer?: { consumer: { id: string } } | null;
  consumerActor?: { consumer: { id: string } } | null;
};

export type RawSubspaceOwnerActor = {
  id: string;
  type: 'person' | 'agent' | 'consumer';
  instanceConsumer: { consumer: { id: string } } | null;
};

export let presentOwnerActor = (ownerActor: RawOwnerActor | null | undefined) =>
  ownerActor
    ? {
        id: ownerActor.id,
        type: ownerActor.type,
        consumer_id:
          ownerActor.instanceConsumer?.consumer.id ??
          ownerActor.consumerActor?.consumer.id ??
          null
      }
    : null;

export let ownerActorSchema = v.nullable(
  v.object(
    {
      id: v.string({
        name: 'id',
        description: 'Identifier of the identity actor that owns this resource.',
        examples: ['iac_6wQpLk2mZa8nYx4b']
      }),
      type: v.enumOf(['person', 'agent', 'consumer'], {
        name: 'type',
        description: 'Type of the owning actor.'
      }),
      consumer_id: v.nullable(
        v.string({
          name: 'consumer_id',
          description:
            'Identifier of the consumer that owns the actor when its type is consumer.',
          examples: ['con_8kLmNp3qRs7tUv1w']
        })
      )
    },
    {
      name: 'owner_actor',
      description: 'The identity actor that owns this resource, if any.'
    }
  )
);
