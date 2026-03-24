import { connect } from 'nats';

export let broadcastNats = await connect({
  servers:
    process.env.NATS_URL?.split(',')
      .map(s => s.trim())
      .filter(Boolean) || []
});
