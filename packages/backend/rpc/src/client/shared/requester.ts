import { generatePlainId } from '@metorial/id';
import { memo } from '@metorial/memo';

let index = 0;
let rootId = memo(() => generatePlainId(10));

export let generateRequestId = () => {
  let id = `call_${rootId()}_${index}`;
  index += 1;
  return id;
};

export interface Call {
  id: string;
  name: string;
  payload: any;
  endpoint: string;
  headers: Record<string, string>;
  query?: Record<string, string>;
}

export type Requester = (
  call: Omit<Call, 'id' | 'headers' | 'query'> & {
    headers: Record<string, string | undefined>;
    query?: Record<string, string | undefined>;
    context: any;
  }
) => Promise<{
  data: any;
  status: number;
  headers: Record<string, string>;
  query?: Record<string, string>;
}>;
