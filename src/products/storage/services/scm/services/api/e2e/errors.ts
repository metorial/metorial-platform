export let expectRpcError = async (promise: Promise<unknown>, code: string) => {
  let error: any;
  try {
    await promise;
  } catch (caught) {
    error = caught;
  }

  if (!error) throw new Error(`Expected an error "${code}", but the call resolved`);
  if (error.data?.code !== code)
    throw new Error(`Expected an error "${code}", but got: ${error.stack ?? error}`);

  return error.data as { code: string; message: string; status: number };
};
