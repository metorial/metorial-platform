export type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type HonoLike = {
  fetch: (request: Request, ...rest: any[]) => Response | Promise<Response>;
};

export let createHonoFetchAdapter = (app: HonoLike): FetchFn => {
  return async (input, init) =>
    app.fetch(
      input instanceof Request
        ? new Request(input, init)
        : new Request(input.toString(), init)
    );
};
