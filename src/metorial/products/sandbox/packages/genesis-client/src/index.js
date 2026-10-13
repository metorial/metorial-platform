// src/index.ts
import { createClient } from "@lowerdeck/rpc-client";
var createGenesisInternalClient = (endpoint) => createClient({
  endpoint,
  disableBatching: true,
  useDirectMethodRoute: true
});
export {
  createGenesisInternalClient
};
