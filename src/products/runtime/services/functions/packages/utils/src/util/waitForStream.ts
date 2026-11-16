export let waitForStream = async (outputStream: NodeJS.WritableStream): Promise<void> =>
  await new Promise((resolve, reject) => {
    outputStream.on('finish', resolve);
    outputStream.on('error', reject);
  });
