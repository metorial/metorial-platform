type ActorPresenterInput = {
  id: string;
  identifier: string;
  type: string;
  name: string;
  organizationActorId: string | null;
  consumerId: string | null;
  createdAt: Date;
};

export let actorPresenter = (actor: ActorPresenterInput) => ({
  object: 'cargo#actor',
  id: actor.id,
  identifier: actor.identifier,
  type: actor.type,
  name: actor.name,
  organizationActorId: actor.organizationActorId,
  consumerId: actor.consumerId,
  createdAt: actor.createdAt
});
