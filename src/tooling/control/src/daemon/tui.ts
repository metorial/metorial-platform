import {
  BoxRenderable,
  StyledText,
  TextRenderable,
  createCliRenderer,
  fg,
  bold,
  type TextChunk
} from '@opentui/core';
import { api, followLogs, stream, uiUrl } from './client';
import {
  clock,
  duration,
  stateColor,
  stateGlyph,
  stripAnsi,
  unitColor,
  workspaceState
} from './format';
import { replayLines, type LogLine } from './logs';
import type { WorkspaceInfo } from './types';
import { openUrl } from './open';

let colors: Record<number, string> = {
  31: '#ef6b5b',
  32: '#4cc97e',
  33: '#e0a84a',
  34: '#6aa8ee',
  35: '#c88be0',
  36: '#56c6c6',
  90: '#7d7d75',
  92: '#7ee0a0',
  93: '#f0c36a',
  94: '#8fbaf5',
  95: '#dca8ee',
  96: '#7edede'
};

let dim = (text: string) => fg('#9a9a94')(text);
let styled = (chunks: TextChunk[]) => new StyledText(chunks);
let tone = (code: number, text: string) => fg(colors[code] ?? '#e8e8e2')(text);

export let runTui = async (initial: string, units: string[] = []) => {
  let renderer = await createCliRenderer({ exitOnCtrlC: false, useMouse: true });
  let workspaces = new Map<string, WorkspaceInfo>();
  let current = initial;
  let selected = units[0] ?? '*';
  let lines: LogLine[] = [];
  let follow = true;
  let offset = 0;
  let notice = '';
  let logAbort: AbortController | undefined;

  let root = new BoxRenderable(renderer, {
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    backgroundColor: '#17171a'
  });
  let header = new TextRenderable(renderer, { content: '', height: 1, fg: '#e8e8e2' });
  let body = new BoxRenderable(renderer, { flexDirection: 'row', flexGrow: 1 });
  let side = new BoxRenderable(renderer, {
    width: 30,
    border: true,
    borderColor: '#5c5c58',
    backgroundColor: '#17171a',
    title: ' units ',
    flexDirection: 'column'
  });
  let sideText = new TextRenderable(renderer, { content: '', fg: '#e8e8e2' });
  let main = new BoxRenderable(renderer, {
    flexGrow: 1,
    border: true,
    borderColor: '#5c5c58',
    backgroundColor: '#17171a',
    title: ' logs ',
    flexDirection: 'column'
  });
  let mainText = new TextRenderable(renderer, {
    content: '',
    wrapMode: 'none',
    fg: '#e8e8e2'
  } as any);
  let footer = new TextRenderable(renderer, { content: '', height: 1, fg: '#e8e8e2' });

  side.add(sideText);
  main.add(mainText);
  body.add(side);
  body.add(main);
  root.add(header);
  root.add(body);
  root.add(footer);
  renderer.root.add(root);

  let entries = () => {
    let info = workspaces.get(current);
    let names =
      info?.units.filter(unit => unit.kind === 'service').map(unit => unit.name) ?? [];
    let infra = info?.units.filter(unit => unit.kind === 'infra').map(unit => unit.name) ?? [];

    return ['*', ...names, ...infra, 'jobs', 'prepare', 'infra', 'control'];
  };

  let visibleLines = () =>
    selected === '*' ? lines : lines.filter(line => line.unit === selected);

  let closed = false;

  let draw = () => {
    if (closed) return;

    let info = workspaces.get(current);
    let rows = Math.max(1, renderer.height - 4);
    let width = Math.max(10, renderer.width - 34);
    let all = visibleLines();
    offset = Math.min(offset, maxOffset());
    let end = follow ? all.length : Math.max(0, all.length - offset);
    let shown = all.slice(Math.max(0, end - rows), end);
    let pad = Math.max(...shown.map(line => line.unit.length), 4);

    let log: TextChunk[] = [];
    for (let line of shown) {
      let text = stripAnsi(line.text).slice(0, Math.max(10, width - pad - 14));
      log.push(
        dim(clock(line.ts) + ' '),
        tone(unitColor(line.unit), line.unit.padEnd(pad)),
        dim(' │ '),
        line.stream === 'err'
          ? tone(31, text)
          : line.stream === 'sys'
            ? dim(text)
            : fg('#e8e8e2')(text),
        fg('#e8e8e2')('\n')
      );
    }
    main.title = follow
      ? ' logs '
      : offset
        ? ` logs · scrolled up ${offset} lines · End or f to follow `
        : ' logs · paused · f to follow ';
    mainText.content = styled(log.length ? log : [dim('no output yet')]);

    let side: TextChunk[] = [];
    for (let name of entries()) {
      let unit = info?.units.find(item => item.name === name);
      let label = name === '*' ? 'all logs' : name;
      let mark = name === selected ? '▸ ' : '  ';
      let chunk = name === selected ? bold : (text: string) => fg('#e8e8e2')(text);
      side.push(fg('#e8e8e2')(mark));
      if (unit) side.push(tone(stateColor(unit.state), `${stateGlyph(unit.state)} `));
      else side.push(fg('#e8e8e2')('  '));
      side.push(chunk(label.slice(0, 20)));
      if (unit && unit.restarts) side.push(dim(` ↻${unit.restarts}`));
      side.push(fg('#e8e8e2')('\n'));
    }
    sideText.content = styled(side);

    let state = info ? workspaceState(info) : undefined;
    header.content = styled([
      bold(` ${info?.id ?? current}`),
      dim(` ${info?.branch ?? ''} `),
      info
        ? tone(
            info.phase === 'running' ? 32 : info.phase === 'failed' ? 31 : 33,
            info.phase + (info.error ? `: ${info.error}` : '')
          )
        : dim('unknown'),
      dim(
        state
          ? `  ${state.up}/${state.total} services  up ${duration(info?.startedAt)}  ui ${uiUrl()}`
          : ''
      ),
      dim(workspaces.size > 1 ? `  [${[...workspaces.keys()].join(' ')}]` : '')
    ]);
    footer.content = styled([
      dim(
        notice ||
          ' ↑↓ select  r restart  R restart all  s stop  S start  p db push  g generate  m migrate  o dashboard  u ui  w workspace  f follow  wheel/PgUp/PgDn scroll  drag+c copy  q quit'
      )
    ]);
    renderer.requestRender();
  };

  let maxOffset = () => Math.max(0, visibleLines().length - Math.max(1, renderer.height - 4));

  let scroll = (lines: number) => {
    let max = maxOffset();

    if (lines > 0) {
      follow = false;
      offset = Math.min(max, offset + lines);
    } else {
      offset = Math.max(0, offset + lines);
      if (!offset) follow = true;
    }
    draw();
  };

  main.onMouseScroll = event => {
    let direction = event.scroll?.direction;
    let step = Math.max(1, event.scroll?.delta ?? 1) * 3;

    if (direction === 'up') scroll(step);
    else if (direction === 'down') scroll(-step);
  };

  let copy = () => {
    let text = renderer.getSelection()?.getSelectedText() || mainText.getSelectedText();
    if (!text)
      text = visibleLines()
        .slice(-500)
        .map(line => `${line.unit} ${stripAnsi(line.text)}`)
        .join('\n');
    renderer.copyToClipboardOSC52(text);
    if (process.platform === 'darwin') {
      let proc = Bun.spawn(['pbcopy'], { stdin: 'pipe' });
      proc.stdin.write(text);
      proc.stdin.end();
    }
    renderer.clearSelection();
    flash(`copied ${text.split('\n').length} lines`);
  };

  let flash = (text: string) => {
    notice = ` ${text}`;
    draw();
    setTimeout(() => {
      notice = '';
      draw();
    }, 2500);
  };

  let attachLogs = () => {
    logAbort?.abort();
    lines = [];
    logAbort = new AbortController();
    let signal = logAbort.signal;
    (async () => {
      try {
        for await (let line of followLogs(current, [], replayLines, undefined, signal)) {
          lines.push(line);
          if (lines.length > 6000) lines.splice(0, 1000);
          draw();
        }
      } catch {}
    })();
  };

  let events = new AbortController();
  (async () => {
    try {
      for await (let info of stream<WorkspaceInfo>('/events', events.signal)) {
        workspaces.set(info.id, info);
        draw();
      }
    } catch {}
  })();
  attachLogs();

  let act = (work: () => Promise<unknown>, message: string) =>
    work().then(
      () => flash(message),
      error => flash(`error: ${error instanceof Error ? error.message : error}`)
    );

  let redraw = setInterval(draw, 1000);

  let done = new Promise<void>(resolve => {
    let quit = () => {
      closed = true;
      clearInterval(redraw);
      events.abort();
      logAbort?.abort();
      renderer.destroy();
      resolve();
    };

    renderer.keyInput.on('keypress', key => {
      let list = entries();
      let index = list.indexOf(selected);
      let base = `/workspaces/${encodeURIComponent(current)}`;
      let info = workspaces.get(current);
      let before = selected;

      if (key.name === 'c' && !key.ctrl) return copy();
      if (key.name === 'q' || (key.ctrl && key.name === 'c')) return quit();
      if (key.name === 'down' || key.name === 'j')
        selected = list[Math.min(list.length - 1, index + 1)]!;
      else if (key.name === 'up' || key.name === 'k') selected = list[Math.max(0, index - 1)]!;
      else if (key.name === 'a') selected = '*';
      else if (key.name === 'f') {
        follow = !follow;
        offset = 0;
      } else if (key.name === 'end') {
        follow = true;
        offset = 0;
      } else if (key.name === 'pageup') {
        scroll(10);
        return;
      } else if (key.name === 'pagedown') {
        scroll(-10);
        return;
      } else if (key.name === 'r' && key.shift)
        act(() => api(`${base}/restart`, 'POST', {}), 'restarting workspace');
      else if (key.name === 'r') {
        if (selected !== '*' && info?.units.some(unit => unit.name === selected))
          act(
            () => api(`${base}/units/${encodeURIComponent(selected)}/restart`, 'POST'),
            `restarting ${selected}`
          );
      } else if (key.name === 's' && key.shift)
        act(() => api(`${base}/start`, 'POST', {}), 'starting workspace');
      else if (key.name === 's')
        act(() => api(`${base}/stop`, 'POST', {}), 'stopping workspace');
      else if (key.name === 'p')
        act(() => api(`${base}/jobs`, 'POST', { kind: 'db:push' }), 'db push started');
      else if (key.name === 'g')
        act(() => api(`${base}/jobs`, 'POST', { kind: 'db:generate' }), 'db generate started');
      else if (key.name === 'm')
        act(() => api(`${base}/jobs`, 'POST', { kind: 'db:migrate' }), 'db migrate started');
      else if (key.name === 'o') {
        let link = info?.links.find(item => item.group === 'app');
        if (link) openUrl(link.url);
      } else if (key.name === 'u') openUrl(uiUrl());
      else if (key.name === 'w') {
        let ids = [...workspaces.keys()];
        current = ids[(ids.indexOf(current) + 1) % ids.length]!;
        selected = '*';
        attachLogs();
      }
      if (selected !== before) {
        follow = true;
        offset = 0;
      }
      draw();
    });
    renderer.on('resize', draw);
  });

  draw();
  await done;
};
