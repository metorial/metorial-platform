import type {
  Session,
  SessionConnection,
  SessionProviderInstance
} from '@metorial-subspace/db';

let INSTANCE_PREFIX = 'v1-spi-';
let SESSION_PREFIX = 'v1-ses-';
let MCP_PREFIX = 'v1-mcp-';

export let topics = {
  instance: {
    encode: (d: { instance: SessionProviderInstance; connection: SessionConnection }) =>
      `${INSTANCE_PREFIX}${d.instance.oid}-${d.connection.oid}`,
    decode: (topic: string) => {
      if (!topic.startsWith(INSTANCE_PREFIX)) return null;

      let rest = topic.slice(INSTANCE_PREFIX.length);
      let [instanceOid, connectionOid] = rest.split('-');
      return {
        instanceOid: BigInt(instanceOid!),
        connectionOid: BigInt(connectionOid!)
      };
    }
  },

  sessionConnection: {
    encode: (d: { session: Session; connection: SessionConnection }) =>
      `${SESSION_PREFIX}${d.session.oid}-${d.connection.oid}`
  },

  mcpConnection: {
    encode: (d: { session: Session; connection: SessionConnection }) =>
      `${MCP_PREFIX}${d.session.oid}-${d.connection.oid}`
  }
};
