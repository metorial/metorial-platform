import { joinPaths } from '@lowerdeck/join-paths';

export type NexusSlices =
  | 'account'
  | 'documents'
  | 'trust'
  | 'enterprise'
  | 'index'
  | 'join'
  | 'jumpstart'
  | 'oauth'
  | 'organization'
  | 'portal'
  | 'portal-utility'
  | 'product'
  | 'support'
  | 'welcome';

export interface NexusManifest {
  slices: {
    id: NexusSlices;
    access:
      | {
          owner: 'external';
          pathname?: string;
          property: {
            hostname: string;
          };
        }
      | {
          owner: 'self';
          pathname?: string;
        };
  }[];
}

let manifest = { current: null as NexusManifest | null };

export let getNexusManifest = () => {
  if (!manifest.current) {
    throw new Error('Nexus manifest is not set');
  }

  return manifest.current;
};

export let getNexusSliceAccess = (slice: NexusSlices) => {
  let manifest = getNexusManifest();
  let sliceAccess = manifest.slices.find(s => s.id === slice)?.access;

  if (!sliceAccess) {
    throw new Error(`Nexus slice access for ${slice} is not set`);
  }

  return sliceAccess;
};

export let getNexusUrl = (slice: NexusSlices, cb: () => string) => {
  let sliceAccess = getNexusSliceAccess(slice);
  let path = joinPaths(sliceAccess.pathname, cb());

  if (sliceAccess.owner === 'self') return path;

  let host = sliceAccess.property.hostname;
  let url = new URL(`https://${host}`);

  // `host` may carry a port (local stacks), so check the parsed host name.
  let isLocalhost = url.hostname === 'localhost' || url.hostname.endsWith('.localhost');
  if (isLocalhost && !host.endsWith(':443')) url.protocol = 'http:';
  url.pathname = path;

  return url.toString();
};

export let setNexusManifest = (newManifest: NexusManifest) => {
  manifest.current = newManifest;
};
