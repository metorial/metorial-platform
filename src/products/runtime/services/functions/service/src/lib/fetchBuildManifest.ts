export type FetchBuildManifestResult =
  | { success: true; value: unknown }
  | { success: false; reason: string };

export let fetchBuildManifest = async (
  read: () => Promise<Buffer>
): Promise<FetchBuildManifestResult> => {
  let content: Buffer;

  try {
    content = await read();
  } catch (error) {
    return { success: false, reason: `reading the manifest failed: ${(error as Error).message}` };
  }

  try {
    return { success: true, value: JSON.parse(content.toString('utf-8')) };
  } catch {
    return { success: false, reason: 'the manifest is not valid JSON' };
  }
};
