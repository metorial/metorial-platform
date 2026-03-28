export type CustomProviderRemoteProtocol = 'sse' | 'streamable_http';

export let getCustomProviderRemoteProtocolFromUrl = (
  remoteUrl: string | null | undefined
): CustomProviderRemoteProtocol => {
  let normalizedRemoteUrl = remoteUrl?.trim();
  if (!normalizedRemoteUrl) return 'streamable_http';

  try {
    let url = new URL(normalizedRemoteUrl);
    let pathname = url.pathname.toLowerCase();
    let transport = url.searchParams.get('transport')?.toLowerCase();
    let protocol = url.searchParams.get('protocol')?.toLowerCase();

    if (
      pathname === '/sse' ||
      pathname.endsWith('/sse') ||
      pathname.includes('/sse/') ||
      transport === 'sse' ||
      protocol === 'sse'
    ) {
      return 'sse';
    }
  } catch {}

  return 'streamable_http';
};

export let waitForCustomProviderVersionId = async (
  getVersionId: () => Promise<string | undefined>,
  opts?: { attempts?: number; delayMs?: number }
) => {
  let attempts = opts?.attempts ?? 15;
  let delayMs = opts?.delayMs ?? 1000;

  for (let attempt = 0; attempt < attempts; attempt++) {
    let versionId = await getVersionId();
    if (versionId) return versionId;

    if (attempt < attempts - 1) {
      await new Promise(resolve => globalThis.setTimeout(resolve, delayMs));
    }
  }

  return undefined;
};
