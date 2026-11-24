(() => {
  let WINDOW_CHOICES = [1, 7, 30, 90, 180];
  let DEFAULT_DAYS = 30;
  let STARTING_RETRY_MS = 5000;
  let OUTAGE_RETRY_MS = 15000;
  let MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ];

  let base = location.pathname.replace(/\/+$/, '') || '/system/errors';
  let nf = new Intl.NumberFormat('en-US');

  let icons = {
    warn: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2 1.5 13.5h13L8 2Z"/><path d="M8 6.5v3M8 11.5v.01"/></svg>',
    plug: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 14 5 11M6 4l6 6M10 2 8 4M14 6l-2 2M5.5 7.5l3 3-1.5 1.5a2.12 2.12 0 0 1-3-3l1.5-1.5Z"/></svg>',
    clock:
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></svg>'
  };

  let $ = selector => document.querySelector(selector);

  let esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );

  let pad = n => String(n).padStart(2, '0');

  let fmtDateTime = t => {
    let d = new Date(t);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
  };

  let state = { days: DEFAULT_DAYS, component: '' };

  let readUrl = () => {
    let params = new URLSearchParams(location.search);
    let days = parseInt(params.get('days') || '', 10);
    if (WINDOW_CHOICES.includes(days)) state.days = days;
    state.component = params.get('component') || '';
  };

  let writeUrl = () => {
    let params = new URLSearchParams();
    if (state.days !== DEFAULT_DAYS) params.set('days', String(state.days));
    if (state.component) params.set('component', state.component);
    let search = params.toString();
    history.replaceState(null, '', `${base}${search ? `?${search}` : ''}`);
  };

  let reportUrl = (kind, days, component) => {
    let params = new URLSearchParams({ days: String(days) });
    if (component) params.set('component', component);
    return `${base}/report.${kind}?${params}`;
  };

  class LoadError extends Error {
    constructor(kind, message, status) {
      super(message);
      this.kind = kind;
      this.status = status;
    }
  }

  // The collector caps how many groups a report lists. When it cut the list short, a component's
  // count comes from that component's own report so none of its groups is missed.
  let cache = new Map();

  let fetchSummary = (days, component) => {
    let key = `${days}|${component}`;
    if (cache.has(key)) return cache.get(key);

    let promise = fetch(reportUrl('json', days, component), {
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store'
    })
      .catch(() => {
        throw new LoadError('outage', 'The page could not reach the server.');
      })
      .then(async response => {
        if (response.ok) return summarize(await response.json());

        let text = (await response.text().catch(() => '')).trim();
        if (response.status === 503 && /connecting/i.test(text))
          throw new LoadError('starting', text, 503);
        if (response.status === 400) throw new LoadError('invalid', text, 400);
        if (response.status === 401 || response.status === 403)
          throw new LoadError('denied', text, response.status);
        if (response.status === 502 || response.status === 504)
          throw new LoadError('outage', text, response.status);
        throw new LoadError(
          'failed',
          text || `The collector answered with status ${response.status}.`,
          response.status
        );
      });

    cache.set(key, promise);
    promise.catch(() => cache.delete(key));
    return promise;
  };

  let summarize = report => {
    let manifest = report.manifest;
    let totals = manifest.totals || {};
    return {
      days: manifest.window.days,
      bucket: manifest.window.bucket,
      from: Date.parse(manifest.window.from),
      to: Date.parse(manifest.window.to),
      generatedAt: Date.parse(manifest.generated_at) || Date.now(),
      installation: manifest.installation || '',
      latest: (manifest.releases || []).slice(-1).map(r => r.release)[0] || '',
      maxDays: (manifest.retention && manifest.retention.days) || 180,
      truncated: !!totals.truncated,
      occurrences: totals.occurrences || 0,
      components: (manifest.components || []).map(c => ({
        component: c.component,
        count: c.occurrences
      })),
      issues: (report.issues || []).map(i => ({ component: i.component }))
    };
  };

  let overview = null;
  let loadToken = 0;
  let retryTimer = null;

  let load = async () => {
    let token = ++loadToken;
    clearTimeout(retryTimer);
    renderForm(null);

    try {
      let all = await fetchSummary(state.days, '');
      let scoped =
        state.component && all.truncated
          ? await fetchSummary(state.days, state.component)
          : all;
      if (token !== loadToken) return;

      overview = all;
      showProblem(null);
      renderForm(all, scoped);
    } catch (error) {
      if (token !== loadToken) return;
      handleLoadError(error);
    }
  };

  let handleLoadError = error => {
    if (error.kind === 'invalid') {
      let match = /between 1 and (\d+)/.exec(error.message);
      let maxDays = match ? parseInt(match[1], 10) : 0;
      if (maxDays > 0 && state.days > maxDays) {
        state.days = WINDOW_CHOICES.filter(d => d <= maxDays).pop() || maxDays;
        writeUrl();
        load();
        return;
      }
    }

    overview = null;
    showProblem(error);
  };

  let renderSubtitle = summary => {
    let parts = [];
    if (summary.installation)
      parts.push(`<span class="mono">${esc(summary.installation)}</span>`);
    if (summary.latest)
      parts.push(
        `<span>Latest release with errors: <span class="mono">${esc(summary.latest)}</span></span>`
      );
    $('#subtitle').innerHTML = parts.join('');
  };

  let fileName = summary => {
    let day = t => new Date(t).toISOString().slice(0, 10).replace(/-/g, '');
    let parts = ['metorial-error-report'];
    if (summary.installation) parts.push(summary.installation);
    parts.push(`${day(summary.from)}_${day(summary.to)}`);
    return `${parts.join('-')}.zip`;
  };

  let renderForm = (all, scoped) => {
    let period = $('#dl-period');
    let select = $('#dl-component');
    let link = $('#dl-link');
    let ready = !!all;

    // Only the first load disables the fields, so changing one keeps its focus.
    period.value = String(state.days);
    period.disabled = !ready && !overview;
    select.disabled = !ready && !overview;
    link.href = reportUrl('zip', state.days, state.component);
    if (ready) {
      link.removeAttribute('aria-disabled');
      link.removeAttribute('tabindex');
    } else {
      link.setAttribute('aria-disabled', 'true');
      link.setAttribute('tabindex', '-1');
    }

    if (!ready) {
      $('#dl-summary').innerHTML = '<span>Counting errors…</span>';
      $('#dl-filename').textContent = '';
      return;
    }

    renderSubtitle(all);
    $('#foot-meta').textContent = `Updated ${fmtDateTime(all.generatedAt)}`;

    [...period.options].forEach(option => (option.disabled = +option.value > all.maxDays));

    let names = new Set(all.components.map(c => c.component));
    if (state.component) names.add(state.component);
    select.innerHTML =
      '<option value="">All components</option>' +
      [...names]
        .sort()
        .map(
          c =>
            `<option value="${esc(c)}"${c === state.component ? ' selected' : ''}>${esc(c)}</option>`
        )
        .join('');

    let issues = scoped.issues.filter(
      i => !state.component || i.component === state.component
    );
    let total = state.component
      ? (all.components.find(c => c.component === state.component) || { count: 0 }).count
      : all.occurrences;
    let groups = `${nf.format(issues.length)}${scoped.truncated ? '+' : ''}`;

    $('#dl-summary').innerHTML =
      total === 0
        ? '<span>No errors were recorded in this period.</span>'
        : `<span><b>${groups}</b> error ${issues.length === 1 ? 'group' : 'groups'}</span><span><b>${nf.format(total)}</b> errors</span><span>${all.bucket === 'hour' ? 'Hourly' : 'Daily'} counts</span>`;
    $('#dl-filename').textContent = fileName(all);
  };

  let problemPanel = error => {
    if (error.kind === 'starting') {
      return `
        <div class="panel outage">
          <div class="icon" style="background:var(--warn-bg);color:var(--warn)">${icons.clock}</div>
          <div>
            <h3>The error collector is starting</h3>
            <p>It is still connecting to its database, <span class="mono">metorial_error_collector</span>. Errors that arrive in the meantime are kept in memory and counted once the database is ready.</p>
            <p>If this does not go away within a few minutes, the System Doctor's Error Collector check shows what is failing.</p>
            <div class="actions"><a class="btn" href="/system/doctor">Open System Doctor</a><span class="retrying">Checking again every few seconds…</span></div>
          </div>
        </div>`;
    }

    if (error.kind === 'denied') {
      return `
        <div class="panel outage">
          <div class="icon">${icons.warn}</div>
          <div>
            <h3>Your access to this page expired</h3>
            <p>Open Error Reports from the license portal again to continue.</p>
            <div class="actions"><a class="btn primary" href="/license">Open License Portal</a></div>
          </div>
        </div>`;
    }

    if (error.kind === 'outage') {
      return `
        <div class="panel outage">
          <div class="icon">${icons.plug}</div>
          <div>
            <h3>The error collector is not responding</h3>
            <p>The gateway could not reach the <span class="mono">error-collector</span> component. Components keep running and still write errors to their logs, but nothing new is counted until the collector is back.</p>
            <ol>
              <li>In Kubernetes, check that its pods are running: <code>kubectl get pods -l app.kubernetes.io/component=error-collector</code></li>
              <li>On a single box, run <code>metorial status</code>.</li>
              <li>Open the System Doctor. Its Error Collector check shows whether the collector can reach its database.</li>
            </ol>
            <div class="actions"><a class="btn primary" href="/system/doctor">Open System Doctor</a><button class="btn" type="button" data-retry>Try Again</button></div>
          </div>
        </div>`;
    }

    return `
      <div class="panel outage">
        <div class="icon">${icons.warn}</div>
        <div>
          <h3>The report could not be prepared</h3>
          <p>${esc(error.message || 'Something went wrong while counting the errors.')}</p>
          <div class="actions"><button class="btn primary" type="button" data-retry>Try Again</button><a class="btn" href="/system/doctor">Open System Doctor</a></div>
        </div>
      </div>`;
  };

  let showProblem = error => {
    $('#download').hidden = !!error;
    $('#problem').hidden = !error;
    $('#problem').innerHTML = error ? problemPanel(error) : '';
    if (!error) return;

    $('#subtitle').innerHTML = '';
    $('#foot-meta').textContent = `Last checked ${fmtDateTime(Date.now())}`;

    let retryIn =
      error.kind === 'starting'
        ? STARTING_RETRY_MS
        : error.kind === 'outage'
          ? OUTAGE_RETRY_MS
          : 0;
    if (retryIn) retryTimer = setTimeout(load, retryIn);
  };

  let toastTimer;

  let toast = message => {
    let el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  };

  let setState = patch => {
    Object.assign(state, patch);
    writeUrl();
    load();
  };

  document.addEventListener('click', event => {
    let t = event.target.closest('button, a');
    if (!t) return;

    if (t.hasAttribute('data-retry')) return load();

    if (t.id === 'dl-link') {
      if (t.getAttribute('aria-disabled') === 'true') {
        event.preventDefault();
        return;
      }
      toast('Preparing the report. Your download starts in a moment.');
    }
  });

  document.addEventListener('change', event => {
    let id = event.target.id;
    if (id === 'dl-period') setState({ days: +event.target.value });
    if (id === 'dl-component') setState({ component: event.target.value });
  });

  readUrl();
  load();
})();
