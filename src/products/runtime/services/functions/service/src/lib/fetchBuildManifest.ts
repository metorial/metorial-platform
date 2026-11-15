export type FetchBuildManifestResult =
  | { success: true; value: unknown }
  | { success: false; reason: string };

export let fetchBuildManifest = async (url: string): Promise<FetchBuildManifestResult> => {
  let res: Response;

  try {
    res = await fetch(url);
  } catch (error) {
    return { success: false, reason: `request failed: ${(error as Error).message}` };
  }

  if (!res.ok) return { success: false, reason: `unexpected status ${res.status}` };

  try {
    return { success: true, value: JSON.parse(await res.text()) };
  } catch {
    return {
      success: false,
      reason: `response was not valid JSON (content-type: ${res.headers.get('content-type') ?? 'unknown'})`
    };
  }
};
