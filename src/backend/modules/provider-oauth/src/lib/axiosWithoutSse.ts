import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Readable } from 'stream';

export async function axiosWithoutSse<T = any>(
  url: string,
  config: AxiosRequestConfig = {}
): Promise<AxiosResponse<T>> {
  let source = axios.CancelToken.source();

  let requestConfig: AxiosRequestConfig = {
    ...config,
    url,
    cancelToken: source.token,
    responseType: 'stream'
  };

  let response = await axios.request<Readable>(requestConfig);

  let contentType = response.headers['content-type'] ?? '';
  if (contentType.includes('text/event-stream')) {
    source.cancel(`Aborted: SSE stream detected from ${url}`);
    response.data.destroy();
    throw new Error(`SSE stream detected from ${url}`);
  }

  let chunks: Buffer[] = [];
  for await (let chunk of response.data) {
    chunks.push(chunk as Buffer);
  }
  let bodyStr = Buffer.concat(chunks).toString('utf8');

  let parsedData: any = bodyStr;
  if (contentType.includes('application/json')) {
    try {
      parsedData = JSON.parse(bodyStr);
    } catch {
      throw new Error(`Invalid JSON response from ${url}`);
    }
  }

  return {
    ...response,
    data: parsedData
  };
}
