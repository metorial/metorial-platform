import type { MarketplaceApp } from '@metorial/api-marketplace/src/client';

import { hc } from 'hono/client';

export class ApiError extends Error {
  constructor(
    private data: {
      status: number;
      code: string;
      message: string;
      [key: string]: any;
    }
  ) {
    super(data.message);
    this.name = 'ApiError';
  }

  get status() {
    return this.data.status;
  }

  get code() {
    return this.data.code;
  }
}

export let client = hc<MarketplaceApp>(process.env.MARKETPLACE_API_URL!, {
  init: {
    credentials: 'include'
  }
});

export let withSdk = async <O>(
  fn: (
    sdk: typeof client
  ) => Promise<{ json: () => Promise<O>; ok: boolean; status: number; statusText: string }>
) => {
  let res = await fn(client);
  if (!res.ok) {
    let json: any;
    try {
      json = await res.json();
    } catch (e) {
      console.error('Error parsing response', e);
    }

    if (json) throw new ApiError(json);

    throw new ApiError({
      status: res.status,
      code: 'unknown',
      message: `Unknown error: ${res.status} ${res.statusText}`
    });
  }

  let json = await res.json();
  return json;
};

export let serverFetch = async <O>(provider: () => Promise<O>) => {
  try {
    let res = await provider();
    // return [res, null] as const;

    return {
      success: true as const,
      data: res,
      error: null
    };
  } catch (e: any) {
    return {
      success: false as const,
      data: null,
      error: {
        message: (e.message ?? 'Unknown error') as string,
        status: (e.status ?? 500) as number,
        error: e
      }
    };
  }
};
