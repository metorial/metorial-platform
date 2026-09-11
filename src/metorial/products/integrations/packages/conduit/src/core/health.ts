export const CONDUIT_HEALTH_TOPIC = '__conduit_health__';

export interface ConduitHealthPong {
  type: 'conduit.health.pong';
  receiverId: string;
  at: number;
}

export let isConduitHealthPong = (value: unknown): value is ConduitHealthPong => {
  if (!value || typeof value !== 'object') return false;
  let d = value as Record<string, unknown>;
  return d.type === 'conduit.health.pong' && typeof d.receiverId === 'string';
};
