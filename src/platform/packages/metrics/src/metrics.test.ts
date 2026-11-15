import { beforeEach, describe, expect, it } from 'vitest';
import {
  classifyMcpResponse,
  mcpMethodLabel,
  normalizeRoute,
  observeHttpRequest,
  recordMcpOperation,
  registry
} from '.';

beforeEach(() => {
  registry.reset();
  process.env.METRICS_ENABLED = 'true';
});

describe('registry', () => {
  it('renders counters, gauges and histograms in the Prometheus text format', async () => {
    let counter = registry.counter({
      name: 't_requests_total',
      help: 'Requests.',
      labelNames: ['code']
    });
    counter.inc({ code: '200' });
    counter.inc({ code: '200' }, 2);

    let gauge = registry.gauge({ name: 't_depth', help: 'Depth.' });
    gauge.set(undefined, 7);

    let histogram = registry.histogram({
      name: 't_seconds',
      help: 'Time.',
      buckets: [0.1, 1]
    });
    histogram.observe(undefined, 0.05);
    histogram.observe(undefined, 0.5);
    histogram.observe(undefined, 5);

    let text = await registry.render();
    expect(text).toContain('# TYPE t_requests_total counter');
    expect(text).toContain('t_requests_total{code="200"} 3');
    expect(text).toContain('t_depth 7');
    expect(text).toContain('t_seconds_bucket{le="0.1"} 1');
    expect(text).toContain('t_seconds_bucket{le="1"} 2');
    expect(text).toContain('t_seconds_bucket{le="+Inf"} 3');
    expect(text).toContain('t_seconds_count 3');
  });

  it('escapes label values', async () => {
    registry
      .counter({ name: 't_esc_total', help: 'x', labelNames: ['v'] })
      .inc({ v: 'a"b\\c\nd' });
    expect(await registry.render()).toContain('t_esc_total{v="a\\"b\\\\c\\nd"} 1');
  });

  it('bounds the number of series per metric', async () => {
    let counter = registry.counter({ name: 't_card_total', help: 'x', labelNames: ['id'] });
    for (let i = 0; i < 700; i++) counter.inc({ id: String(i) });
    expect(counter.seriesCount).toBeLessThanOrEqual(501);
    expect(await registry.render()).toContain('t_card_total{id="other"}');
  });

  it('rejects a metric re-registered with another type', () => {
    registry.counter({ name: 't_dup', help: 'x' });
    expect(() => registry.gauge({ name: 't_dup', help: 'x' })).toThrow();
  });
});

describe('http', () => {
  it('normalizes identifiers out of routes', () => {
    expect(normalizeRoute('/sessions/ses_abcdef123456/messages')).toBe(
      '/sessions/:id/messages'
    );
    expect(normalizeRoute('/a/3f2c1b2a-1111-2222-3333-444455556666')).toBe('/a/:id');
    expect(normalizeRoute('/users/42')).toBe('/users/:id');
    expect(normalizeRoute('/health')).toBe('/health');
  });

  it('records duration and status class', async () => {
    await observeHttpRequest(
      new Request('http://x/things/12'),
      async () => new Response('x', { status: 404 })
    );
    let text = await registry.render();
    expect(text).toContain(
      'metorial_http_server_requests_total{method="GET",route="/things/:id",status_class="4xx"} 1'
    );
  });

  it('records thrown handlers as 5xx and rethrows', async () => {
    await expect(
      observeHttpRequest(new Request('http://x/boom'), async () => {
        throw new Error('no');
      })
    ).rejects.toThrow('no');
    expect(await registry.render()).toContain('status_class="5xx"');
  });

  it('does nothing when metrics are disabled', async () => {
    process.env.METRICS_ENABLED = 'false';
    await observeHttpRequest(new Request('http://x/off'), async () => new Response('x'));
    expect(registry.get('metorial_http_server_requests_total')?.seriesCount ?? 0).toBe(0);
  });
});

describe('mcp', () => {
  it('counts tool errors that arrive as JSON-RPC successes', () => {
    expect(classifyMcpResponse({ result: { isError: true } })).toBe('tool_error');
    expect(classifyMcpResponse({ error: { code: -1 } })).toBe('jsonrpc_error');
    expect(classifyMcpResponse({ result: { content: [] } })).toBeUndefined();
  });

  it('keeps method labels bounded and never records arguments', async () => {
    expect(mcpMethodLabel('tools/call')).toBe('tools/call');
    expect(mcpMethodLabel('x/' + 'a'.repeat(500))).toBe('other');

    recordMcpOperation({
      method: 'tools/call',
      transport: 'streamable_http',
      toolName: 'echo',
      durationSeconds: 0.2,
      errorType: 'tool_error'
    });
    recordMcpOperation({ method: 'initialize', transport: 'sse', durationSeconds: 0.01 });
    let text = await registry.render();
    expect(text).toContain('mcp_method_name="tools/call"');
    expect(text).toContain('gen_ai_tool_name="echo"');
    expect(text).toContain('error_type="tool_error"');
    expect(text).toContain('mcp_server_sessions_total{network_transport="sse"} 1');
  });
});
