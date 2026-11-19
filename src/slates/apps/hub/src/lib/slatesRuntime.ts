import unzipper from 'unzipper';
import { SLATES_PROTOCOL } from './protocol';

export let SLATES_RUNTIME_KIND = 'slates-runtime';

export type SlatesRuntime = {
  version: string;
  main: string;
  files: { path: string; buffer: Buffer }[];
};

type ToolingResponse = {
  status: number;
  json: () => Promise<any>;
  text: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

type ToolingClient = {
  tooling: {
    ':kind': {
      resolve: { $get: (args: any) => Promise<ToolingResponse> };
      ':version': { download: { $get: (args: any) => Promise<ToolingResponse> } };
    };
  };
};

let assertOk = async (response: ToolingResponse, action: string) => {
  if (response.status === 200) return;

  let body = (await response.text().catch(() => '')).slice(0, 500);
  throw new Error(`${action} returned status ${response.status}: ${body}`);
};

let downloadSlatesRuntime = async (d: {
  client: ToolingClient;
  pinnedVersion?: string;
  downloadQuery?: Record<string, string>;
}): Promise<SlatesRuntime | null> => {
  let response = await d.client.tooling[':kind'].resolve.$get({
    param: { kind: SLATES_RUNTIME_KIND },
    query: {
      protocol: SLATES_PROTOCOL,
      ...(d.pinnedVersion ? { version: d.pinnedVersion } : {})
    }
  });
  if (response.status === 404 && !d.pinnedVersion) return null;
  await assertOk(response, 'Resolving the slates runtime');

  let tooling = (await response.json()) as { version: string; main: string };

  let download = await d.client.tooling[':kind'][':version'].download.$get({
    param: { kind: SLATES_RUNTIME_KIND, version: tooling.version },
    query: d.downloadQuery ?? {}
  });
  await assertOk(download, `Downloading slates runtime ${tooling.version}`);

  let directory = await unzipper.Open.buffer(Buffer.from(await download.arrayBuffer()));
  let files = await Promise.all(
    directory.files
      .filter(file => file.type === 'File')
      .map(async file => ({ path: file.path, buffer: await file.buffer() }))
  );

  return { version: tooling.version, main: tooling.main, files };
};

// Registries from before tooling existed answer 404; the deployment then installs the runtime
// packages from npm or the build image's preinstalled set as before. A pinned version is an
// explicit admin choice, so failing to get it fails the deployment instead.
export let fetchSlatesRuntime = async (d: {
  client: ToolingClient;
  pinnedVersion?: string;
  downloadQuery?: Record<string, string>;
}) => {
  try {
    return await downloadSlatesRuntime(d);
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error);
    if (d.pinnedVersion) {
      throw new Error(`Could not get slates runtime ${d.pinnedVersion}: ${message}`, {
        cause: error
      });
    }

    console.warn(`[Deployment]: Falling back to npm slates runtime packages: ${message}`);
    return null;
  }
};
