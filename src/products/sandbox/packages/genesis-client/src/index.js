// src/index.ts
import { createClient } from "@lowerdeck/rpc-client";
var createGenesisInternalClient = (endpoint, options = {}) => createClient({
  endpoint,
  getSignatureCredentials: options.getSignatureCredentials,
  disableBatching: true,
  useDirectMethodRoute: true
});
export {
  createGenesisInternalClient
};
