import { v, type ValidationType } from '@lowerdeck/validation';
import TurndownService from 'turndown';
import { table } from './daemon/format';
import { parse } from './schema';

let address = v.nullable(v.object({ Address: v.string() }));

let headers = {
  From: address,
  To: v.nullable(v.array(address)),
  Subject: v.string()
};

let inbox = v.object({
  messages: v.nullable(v.array(v.object({ ...headers, ID: v.string(), Created: v.string() })))
});

let message = v.object({
  ...headers,
  Date: v.string(),
  HTML: v.string(),
  Text: v.string()
});

let read = async <T>(url: URL, schema: ValidationType<T>): Promise<T> => {
  let response = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch(error => {
    throw new Error(`could not reach Mailpit at ${url.origin}`, { cause: error });
  });
  if (!response.ok)
    throw new Error(`Mailpit returned HTTP ${response.status} for ${url.pathname}`);

  return parse(schema, await response.json(), 'invalid Mailpit response');
};

let recipients = (addresses: ({ Address: string } | null)[] | null) =>
  addresses
    ?.map(address => address?.Address)
    .filter(Boolean)
    .join(', ') ?? '';

export let list = async (baseUrl: string, options: { start?: string; limit?: string }) => {
  let url = new URL('/api/v1/messages', baseUrl);

  for (let name of ['start', 'limit'] as const) {
    let value = options[name];
    if (value === undefined) continue;
    if (
      !/^\d+$/.test(value) ||
      !Number.isSafeInteger(Number(value)) ||
      (name === 'limit' && Number(value) === 0)
    )
      throw new Error(`invalid value for --${name}`);
    url.searchParams.set(name, value);
  }

  let { messages } = await read(url, inbox);
  if (!messages?.length) return console.log('No emails found.');

  console.log(
    table([
      ['ID', 'RECEIVED', 'FROM', 'TO', 'SUBJECT'],
      ...messages.map(email => [
        email.ID,
        email.Created,
        email.From?.Address ?? '',
        recipients(email.To),
        email.Subject
      ])
    ])
  );
};

export let open = async (baseUrl: string, id: string, html: boolean) => {
  let url = new URL(`/api/v1/message/${encodeURIComponent(id)}`, baseUrl);
  let email = await read(url, message);

  if (html) {
    console.log(email.HTML);
    return;
  }

  let body = email.HTML
    ? new TurndownService({ headingStyle: 'atx' })
        .remove(['script', 'style'])
        .turndown(email.HTML)
    : email.Text;

  console.log(
    [
      `Subject: ${email.Subject}`,
      `From: ${email.From?.Address ?? ''}`,
      `To: ${recipients(email.To)}`,
      `Date: ${email.Date}`,
      '',
      body
    ].join('\n')
  );
};
