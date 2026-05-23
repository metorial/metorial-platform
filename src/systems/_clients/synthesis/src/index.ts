import { createClient } from '@mtsrc/rpc-client';
import type { SynthesisClient } from '../../../synthesis/service/src/controllers';
export * from '../../../synthesis/service/src/lib/delta/client';
export * from '../../../synthesis/service/src/lib/delta/types';
export * from '../../../synthesis/service/src/types';

type ClientOpts = Parameters<typeof createClient>[0];

export type SynthesisAssistantRequestLiveEndpoints = {
  liveEndpoint: string;
};

export type SynthesisAssistantRequestLiveInput = {
  assistantRequestId: string;
};

export let createSynthesisClient = (o: ClientOpts): SynthesisClient =>
  createClient<SynthesisClient>(o);

export let getAssistantRequestDeltasUrl = (
  endpoints: SynthesisAssistantRequestLiveEndpoints,
  input: SynthesisAssistantRequestLiveInput
) => {
  let url = new URL(
    `${endpoints.liveEndpoint.replace(/\/$/, '')}/assistant-live/requests/${input.assistantRequestId}/deltas`
  );

  return url.toString();
};

type AssistantRequestDeltaEventData = {
  event: string;
  data: string;
  id?: string;
};

class FetchAssistantRequestDeltasConnection extends EventTarget {
  private controller = new AbortController();

  constructor(
    private readonly endpoints: SynthesisAssistantRequestLiveEndpoints,
    private readonly input: SynthesisAssistantRequestLiveInput
  ) {
    super();
    void this.start();
  }

  close() {
    this.controller.abort();
  }

  private async start() {
    try {
      let response = await fetch(getAssistantRequestDeltasUrl(this.endpoints, this.input), {
        headers: {
          Accept: 'text/event-stream'
        },
        signal: this.controller.signal
      });

      if (!response.ok) {
        this.dispatchError(
          new Error(`Failed to open assistant delta stream (${response.status})`)
        );
        return;
      }

      if (!response.body) {
        this.dispatchError(new Error('Assistant delta stream response body was empty'));
        return;
      }

      await this.parse(response.body);
    } catch (error) {
      if (this.controller.signal.aborted) return;
      this.dispatchError(error);
    }
  }

  private async parse(stream: ReadableStream<Uint8Array>) {
    let reader = stream.getReader();
    let decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      let { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

      let parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() ?? '';

      for (let part of parts) {
        this.dispatchBlock(part);
      }

      if (done) {
        if (buffer.trim()) {
          this.dispatchBlock(buffer);
        }
        break;
      }
    }
  }

  private dispatchBlock(block: string) {
    let parsed = this.parseBlock(block);
    if (!parsed) return;

    this.dispatchEvent(
      new MessageEvent(parsed.event, {
        data: parsed.data,
        lastEventId: parsed.id
      })
    );
  }

  private parseBlock(block: string): AssistantRequestDeltaEventData | null {
    let event = 'message';
    let id: string | undefined;
    let dataParts: string[] = [];

    for (let rawLine of block.split(/\r?\n/)) {
      if (!rawLine || rawLine.startsWith(':')) continue;

      let separator = rawLine.indexOf(':');
      let field = separator == -1 ? rawLine : rawLine.slice(0, separator);
      let value = separator == -1 ? '' : rawLine.slice(separator + 1).replace(/^ /, '');

      if (field == 'event') event = value;
      if (field == 'id') id = value;
      if (field == 'data') dataParts.push(value);
    }

    if (dataParts.length == 0) return null;

    return {
      event,
      id,
      data: dataParts.join('\n')
    };
  }

  private dispatchError(error: unknown) {
    let message = error instanceof Error ? error.message : String(error);
    this.dispatchEvent(
      new MessageEvent('error', {
        data: JSON.stringify({
          message
        })
      })
    );
  }
}

export let createAssistantRequestDeltasConnection = (
  endpoints: SynthesisAssistantRequestLiveEndpoints,
  input: SynthesisAssistantRequestLiveInput
) =>
  //  new EventSource(getAssistantRequestDeltasUrl(endpoints, input))
  new FetchAssistantRequestDeltasConnection(endpoints, input);
