(() => {
  let HOUR = 36e5;
  let DAY = 864e5;
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
  let WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let PALETTE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];
  let OTHER_COLOR = 'var(--c6)';

  let embedded = JSON.parse(document.getElementById('report-data').textContent);
  let nf = new Intl.NumberFormat('en-US');

  let icons = {
    check:
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7"/></svg>',
    warn: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2 1.5 13.5h13L8 2Z"/><path d="M8 6.5v3M8 11.5v.01"/></svg>',
    close:
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg>',
    copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/></svg>'
  };

  let $ = selector => document.querySelector(selector);

  let esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );

  let pad = n => String(n).padStart(2, '0');

  let fmtDate = t => {
    let d = new Date(t);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  };

  let fmtDateTime = t => {
    let d = new Date(t);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
  };

  let compact = n =>
    n >= 10000
      ? `${Math.round(n / 1000)}k`
      : n >= 1000
        ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
        : String(Math.round(n * 100) / 100);

  let plural = (n, one, many) => `${nf.format(n)} ${n === 1 ? one : many}`;

  let windowLong = days => (days === 1 ? 'last 24 hours' : `last ${days} days`);

  let windowShort = days => (days === 1 ? '24 hours' : `${days} days`);

  let state = {
    component: '',
    q: '',
    level: 'all',
    newOnly: false,
    sort: 'count',
    open: null
  };

  let parseTime = value => (value ? Date.parse(value) : 0);

  let sampleDetails = sample => (sample && sample.contexts && sample.contexts.details) || {};

  let sampleLog = sample =>
    (sample && sample.contexts && sample.contexts.log && sample.contexts.log.lines) || [];

  let detailLabel = key => {
    let label = key.replace(/_ms$/, ' (ms)').replace(/[_.]+/g, ' ');
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  let prepare = (report, requestedAt) => {
    let manifest = report.manifest;
    let window = manifest.window;
    let generatedAt = parseTime(manifest.generated_at);
    let from = parseTime(window.from);
    let buckets = (window.buckets || []).map(parseTime);
    let releases = (manifest.releases || []).map(r => ({
      release: r.release,
      firstSeen: parseTime(r.first_seen),
      lastSeen: parseTime(r.last_seen)
    }));
    let latest = releases.length ? releases[releases.length - 1].release : '';

    let issues = (report.issues || []).map(raw => {
      let issueReleases = (raw.releases || [])
        .map(r => ({
          release: r.release,
          count: r.count,
          firstSeen: parseTime(r.first_seen),
          lastSeen: parseTime(r.last_seen)
        }))
        .sort((a, b) => b.lastSeen - a.lastSeen);

      let latestSample = raw.latest_sample || null;
      let firstSample = raw.first_sample || null;
      let bootStep = (latestSample && latestSample.tags && latestSample.tags.boot_step) || '';
      let firstSeen = parseTime(raw.first_seen);
      let tags = (latestSample && latestSample.tags) || {};
      let details = sampleDetails(latestSample);
      let subject = [tags.integration, tags.step].filter(Boolean).join(' · ');

      return {
        raw,
        id: raw.id,
        hash: raw.hash,
        groupingVersion: raw.grouping_version,
        component: raw.component,
        level: raw.level || 'error',
        type: raw.type || 'Error',
        value: raw.value || '',
        culprit: raw.culprit || '',
        overflow: !!raw.overflow,
        firstSeen,
        lastSeen: parseTime(raw.last_seen),
        total: raw.total_count,
        count: raw.window_count,
        series: raw.series || [],
        releases: issueReleases,
        latestSample,
        firstSample,
        bootStep,
        isNew: firstSeen >= from,
        subject,
        search: [
          raw.type,
          raw.value,
          raw.culprit,
          raw.component,
          ...Object.values(tags),
          ...Object.values(details)
        ]
          .join(' ')
          .toLowerCase()
      };
    });

    let components = (manifest.components || []).map(c => ({
      component: c.component,
      count: c.occurrences,
      releases: c.releases || [],
      series: c.series || []
    }));

    let colors = {};
    components.forEach((c, i) => (colors[c.component] = PALETTE[i] || OTHER_COLOR));

    return {
      manifest,
      days: window.days,
      bucket: window.bucket,
      size: window.bucket === 'hour' ? HOUR : DAY,
      from,
      to: parseTime(window.to),
      buckets,
      generatedAt,
      clockOffset: generatedAt ? generatedAt - requestedAt : 0,
      releases,
      latest,
      issues,
      components,
      colors,
      truncated: !!(manifest.totals && manifest.totals.truncated),
      installation: manifest.installation || '',
      version: manifest.collector_version || '',
      retention: manifest.retention || {},
      storedGroups: (manifest.totals && manifest.totals.stored_groups) || 0
    };
  };

  let current = prepare(embedded, Date.now());

  let now = () => Date.now() + (current ? current.clockOffset : 0);

  let ago = t => {
    let s = Math.max(0, (now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    let d = Math.round(s / 86400);
    return d === 1 ? 'yesterday' : `${d} days ago`;
  };

  let niceMax = v => {
    if (v <= 4) return 4;
    let p = Math.pow(10, Math.floor(Math.log10(v)));
    for (let m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  };

  let bucketLabel = (report, i) => {
    let b = report.buckets[i];
    let d = new Date(b);
    let last = i === report.buckets.length - 1;
    if (report.bucket === 'hour') {
      return `${WEEKDAYS[d.getUTCDay()]}, ${fmtDate(b)} · ${pad(d.getUTCHours())}:00–${pad((d.getUTCHours() + 1) % 24)}:00 UTC${last ? ' (so far)' : ''}`;
    }
    return `${WEEKDAYS[d.getUTCDay()]}, ${fmtDate(b)}${last ? ' (today, so far)' : ''}`;
  };

  let tickFor = (report, b) => {
    let d = new Date(b);
    let n = report.buckets.length;
    if (report.bucket === 'hour') {
      if (n <= 30) return d.getUTCHours() % 6 === 0 ? `${pad(d.getUTCHours())}:00` : null;
      if (n <= 24 * 8)
        return d.getUTCHours() === 0 ? `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}` : null;
      return d.getUTCHours() === 0 && d.getUTCDate() % 2 === 1 ? fmtDate(b) : null;
    }
    if (n <= 31) return d.getUTCDay() === 1 ? fmtDate(b) : null;
    if (n <= 92) return d.getUTCDate() === 1 || d.getUTCDate() === 15 ? fmtDate(b) : null;
    return d.getUTCDate() === 1 ? MONTHS[d.getUTCMonth()] : null;
  };

  let drawChart = (el, report, layers, opts) => {
    if (!el) return;

    let width = Math.max(260, el.clientWidth || 600);
    let height = opts.height;
    let L = 38;
    let R = 8;
    let T = 20;
    let B = 22;
    let pw = width - L - R;
    let ph = height - T - B;
    let n = Math.max(1, report.buckets.length);

    let totals = report.buckets.map((_, i) =>
      layers.reduce((a, l) => a + (l.values[i] || 0), 0)
    );
    let max = niceMax(Math.max(1, ...totals));
    let bw = pw / n;
    let gap = n > 100 ? Math.min(0.6, bw * 0.2) : n > 40 ? 1.5 : Math.min(4, bw * 0.25);
    let y = v => T + ph - (v / max) * ph;
    let out = [];

    out.push(`<rect class="hl" x="0" y="${T}" width="${bw}" height="${ph}" opacity="0"/>`);
    for (let v of [0, max / 2, max]) {
      out.push(`<line class="grid" x1="${L}" x2="${width - R}" y1="${y(v)}" y2="${y(v)}"/>`);
      out.push(
        `<text class="axis" x="${L - 8}" y="${y(v) + 3.5}" text-anchor="end">${compact(v)}</text>`
      );
    }

    report.buckets.forEach((b, i) => {
      let x = L + i * bw + gap / 2;
      let acc = 0;
      for (let layer of layers) {
        let v = layer.values[i] || 0;
        if (!v) continue;
        let y0 = y(acc);
        let y1 = y(acc + v);
        out.push(
          `<rect x="${x.toFixed(2)}" y="${y1.toFixed(2)}" width="${Math.max(0.6, bw - gap).toFixed(2)}" height="${Math.max(0.8, y0 - y1).toFixed(2)}" fill="${layer.color}"/>`
        );
        acc += v;
      }

      let tick = tickFor(report, b);
      if (tick) {
        out.push(
          `<text class="axis" x="${(L + i * bw + bw / 2).toFixed(1)}" y="${height - 6}" text-anchor="middle">${tick}</text>`
        );
      }
    });

    let start = report.buckets[0];
    let end = report.buckets[n - 1] + report.size;
    for (let r of report.releases) {
      if (r.firstSeen < start || r.firstSeen >= end) continue;
      let x = L + ((r.firstSeen - start) / report.size) * bw;
      let anchor = x > width - 90 ? 'end' : 'start';
      out.push(
        `<line class="marker" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${T - 6}" y2="${T + ph}"/>`
      );
      out.push(
        `<text class="marker-label" x="${(x + (anchor === 'start' ? 4 : -4)).toFixed(1)}" y="${T - 9}" text-anchor="${anchor}">${esc(r.release)}<title>First error from ${esc(r.release)}: ${fmtDateTime(r.firstSeen)}</title></text>`
      );
    }

    report.buckets.forEach((_, i) => {
      out.push(
        `<rect data-i="${i}" x="${(L + i * bw).toFixed(2)}" y="${T}" width="${bw.toFixed(2)}" height="${ph}" fill="transparent"/>`
      );
    });

    el.innerHTML = `<svg viewBox="0 0 ${width} ${height}" height="${height}" role="img" aria-label="${esc(opts.label)}">${out.join('')}</svg><div class="tip" hidden></div>`;

    let tip = el.querySelector('.tip');
    let hl = el.querySelector('.hl');

    let show = i => {
      let lines = layers
        .map(l => ({ l, v: l.values[i] || 0 }))
        .filter(x => x.v > 0)
        .sort((a, b) => b.v - a.v)
        .slice(0, 6)
        .map(
          x =>
            `<div class="ln"><span class="sw" style="background:${x.l.color}"></span><span>${esc(x.l.name)}</span><span>${nf.format(x.v)}</span></div>`
        )
        .join('');

      tip.innerHTML = `<div class="when">${bucketLabel(report, i)}</div><div class="tot">${plural(totals[i], 'error', 'errors')}</div>${layers.length > 1 ? lines : ''}`;
      tip.hidden = false;

      let cx = (L + i * bw + bw / 2) * (el.clientWidth / width);
      let half = tip.offsetWidth / 2;
      tip.style.left = `${Math.min(el.clientWidth - half, Math.max(half, cx))}px`;
      tip.style.top = `${-tip.offsetHeight - 6}px`;
      hl.setAttribute('x', (L + i * bw).toFixed(2));
      hl.setAttribute('opacity', '1');
    };

    let hide = () => {
      tip.hidden = true;
      hl.setAttribute('opacity', '0');
    };

    el.querySelectorAll('rect[data-i]').forEach(rect => {
      rect.addEventListener('mouseenter', () => show(+rect.dataset.i));
      rect.addEventListener('click', () => show(+rect.dataset.i));
    });
    el.querySelector('svg').addEventListener('mouseleave', hide);
  };

  let spark = (values, color) => {
    let w = 112;
    let h = 30;
    let n = values.length;
    if (!n) return '';

    let max = Math.max(1, ...values);
    let pts = values.map((v, i) => [
      n === 1 ? w - 1 : (i / (n - 1)) * (w - 4) + 1,
      h - 3 - (v / max) * (h - 7)
    ]);
    let line = pts
      .map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
      .join('');
    let area = `${line}L${pts[n - 1][0].toFixed(1)},${h - 1}L${pts[0][0].toFixed(1)},${h - 1}Z`;
    let last = pts[n - 1];

    return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${area}" fill="${color}" opacity="0.14"/><path d="${line}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linejoin="round"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.2" fill="${color}"/></svg>`;
  };

  let firstRelease = issue => {
    let earliest = null;
    for (let r of issue.releases)
      if (!earliest || r.firstSeen < earliest.firstSeen) earliest = r;
    return earliest ? earliest.release : '';
  };

  let lastRelease = issue => (issue.releases.length ? issue.releases[0].release : '');

  let badges = (issue, report) => {
    let out = [];
    if (issue.overflow) out.push('<span class="badge overflow">Counted Together</span>');
    if (issue.bootStep) out.push('<span class="badge boot">Startup Failure</span>');

    if (issue.isNew) {
      let label =
        report.latest && firstRelease(issue) === report.latest
          ? `New in ${report.latest}`
          : 'New';
      out.push(`<span class="badge new">${esc(label)}</span>`);
    }

    let last = lastRelease(issue);
    if (report.latest && last && last !== report.latest)
      out.push(`<span class="badge quiet">Last seen in ${esc(last)}</span>`);

    return out.join('');
  };

  let colorFor = (report, component) => report.colors[component] || OTHER_COLOR;

  let compute = () => {
    let report = current;
    let scoped = report.issues.filter(
      i => !state.component || i.component === state.component
    );
    let q = state.q.trim().toLowerCase();

    let list = scoped.filter(i => {
      if (state.level === 'error' && i.level === 'warning') return false;
      if (state.level === 'warning' && i.level !== 'warning') return false;
      if (state.newOnly && !i.isNew) return false;
      if (q && !i.search.includes(q)) return false;
      return true;
    });

    let sorters = {
      count: (a, b) => b.count - a.count || b.lastSeen - a.lastSeen,
      recent: (a, b) => b.lastSeen - a.lastSeen,
      newest: (a, b) => b.firstSeen - a.firstSeen
    };
    list.sort(sorters[state.sort]);

    return { report, scoped, list };
  };

  let findIssue = id => current.issues.find(i => i.id === id) || null;

  let renderSubtitle = report => {
    let parts = [];
    if (report.installation)
      parts.push(`<span class="mono">${esc(report.installation)}</span>`);
    if (report.latest)
      parts.push(
        `<span>Latest release with errors: <span class="mono">${esc(report.latest)}</span></span>`
      );
    parts.push(
      `<span>${esc(windowShort(report.days))}, ${esc(fmtDate(report.from))} – ${esc(fmtDate(report.to))}</span>`
    );
    if (report.manifest.component)
      parts.push(
        `<span>Only <span class="mono">${esc(report.manifest.component)}</span></span>`
      );
    parts.push(`<span>Exported ${esc(fmtDateTime(report.generatedAt))}</span>`);
    $('#subtitle').innerHTML = parts.join('');
  };

  let renderToolbar = report => {
    let select = $('#component');
    let options = report.components.map(c => c.component);
    if (state.component && !options.includes(state.component)) options.push(state.component);
    select.innerHTML =
      '<option value="">All components</option>' +
      options
        .map(
          c =>
            `<option value="${esc(c)}"${c === state.component ? ' selected' : ''}>${esc(c)}</option>`
        )
        .join('');

    let search = $('#search');
    if (search.value !== state.q && document.activeElement !== search) search.value = state.q;
  };

  let render = () => {
    let { report, scoped, list } = compute();
    renderSubtitle(report);
    renderToolbar(report);

    let long = windowLong(report.days);
    let components = report.components;
    let selected = state.component
      ? components.find(c => c.component === state.component)
      : null;
    let total = state.component
      ? selected
        ? selected.count
        : 0
      : report.manifest.totals.occurrences || 0;
    let newCount = scoped.filter(i => i.isNew).length;
    let lastEvent = scoped.reduce((a, i) => Math.max(a, i.lastSeen), 0);
    let componentCount = new Set(scoped.map(i => i.component)).size;
    let overflowIssues = scoped.filter(i => i.overflow);

    let layers;
    if (state.component) {
      layers = [
        {
          name: state.component,
          color: colorFor(report, state.component),
          values: selected ? selected.series : report.buckets.map(() => 0)
        }
      ];
    } else {
      layers = components.slice(0, PALETTE.length).map(c => ({
        name: c.component,
        color: colorFor(report, c.component),
        values: c.series,
        component: c.component
      }));
      let rest = components.slice(PALETTE.length);
      if (rest.length) {
        layers.push({
          name: `${rest.length} other ${rest.length === 1 ? 'component' : 'components'}`,
          color: OTHER_COLOR,
          values: report.buckets.map((_, i) =>
            rest.reduce((a, c) => a + (c.series[i] || 0), 0)
          )
        });
      }
    }

    let banners = [];
    if (overflowIssues.length) {
      let names = [...new Set(overflowIssues.map(i => i.component))];
      let counted = overflowIssues.reduce((a, i) => a + i.count, 0);
      banners.push(
        `<div class="banner warn">${icons.warn}<p><strong>Some errors were counted together.</strong> ${names.map(n => `<span class="mono">${esc(n)}</span>`).join(', ')} produced more distinct errors than the collector keeps track of, so ${plural(counted, 'error is', 'errors are')} counted as one group. They are still in the report, but without their own messages or stack traces.</p></div>`
      );
    }

    let maxComp = Math.max(1, ...components.map(c => c.count));
    let compRows = components.length
      ? components
          .map(
            c => `<button class="crow" type="button" data-comp="${esc(c.component)}" aria-pressed="${c.component === state.component}">
              <span class="cname"><i class="sw" style="background:${colorFor(report, c.component)}"></i><span>${esc(c.component)}</span></span>
              <span class="ccount">${nf.format(c.count)}</span>
              <span class="cbar"><span style="width:${((c.count / maxComp) * 100).toFixed(1)}%;background:${colorFor(report, c.component)}"></span></span>
              ${c.releases.length ? `<span class="crel">${c.releases.map(esc).join(' · ')}</span>` : ''}
            </button>`
          )
          .join('')
      : `<div class="empty compact"><p>No component reported an error in the ${long}.</p></div>`;

    let rows = list
      .map(
        i => `<button class="row" type="button" data-id="${i.id}" aria-current="${state.open === i.id}">
          <span class="stripe ${esc(i.level)}"></span>
          <span class="main">
            <span class="title"><b>${esc(i.type)}</b>${esc(i.value)}</span>
            <span class="meta"><span class="comp"><i class="sw" style="background:${colorFor(report, i.component)}"></i>${esc(i.component)}</span>${i.culprit || i.subject ? `<span class="culprit">${esc(i.culprit || i.subject)}</span>` : ''}${badges(i, report)}</span>
          </span>
          <span class="trend">${spark(i.series, colorFor(report, i.component))}</span>
          <span class="cnt">${nf.format(i.count)}</span>
          <span class="seen" title="${esc(fmtDateTime(i.lastSeen))}">${esc(ago(i.lastSeen))}</span>
        </button>`
      )
      .join('');

    let emptyList = '';
    if (!scoped.length) {
      emptyList = `<div class="empty"><div class="icon">${icons.check}</div><h3>No errors in the ${long}</h3><p>${
        state.component
          ? `<span class="mono">${esc(state.component)}</span> reported no errors in this period.`
          : 'No component reported an error in this period.'
      }</p></div>`;
    } else if (!list.length) {
      emptyList =
        '<div class="empty"><h3>No error groups match</h3><p>Try a different search or clear the filters.</p><p style="margin-top:12px"><button class="btn small" type="button" data-clear>Clear Filters</button></p></div>';
    }

    let footNotes = [`Counts are ${report.bucket === 'hour' ? 'hourly' : 'daily'} in UTC.`];
    if (report.releases.length)
      footNotes.push('Dashed lines mark the first error from each release.');
    if (report.truncated)
      footNotes.push(
        `Only the ${nf.format(scoped.length)} error groups with the most errors are listed.`
      );

    $('#content').innerHTML = `
      ${banners.join('')}
      <div class="overview">
        <section class="panel" aria-label="Summary">
          <div class="stats">
            <div class="stat"><div class="label">Errors</div><div class="value">${nf.format(total)}</div><div class="hint">in the ${long}</div></div>
            <div class="stat"><div class="label">Error Groups</div><div class="value">${nf.format(scoped.length)}${report.truncated ? '+' : ''}</div><div class="hint">${plural(componentCount, 'component', 'components')}</div></div>
            <div class="stat"><div class="label">New</div><div class="value">${nf.format(newCount)}</div><div class="hint">first seen in this period</div></div>
            <div class="stat"><div class="label">Last Error</div><div class="value">${lastEvent ? esc(ago(lastEvent).replace(' ago', '')) : '—'}</div><div class="hint">${lastEvent ? esc(fmtDateTime(lastEvent)) : 'none in this period'}</div></div>
          </div>
          <div class="chart-area"><div class="chart" id="main-chart"></div></div>
          ${
            !state.component && layers.length
              ? `<div class="legend">${layers
                  .map(
                    l =>
                      `<button type="button" ${l.component ? `data-comp="${esc(l.component)}"` : 'disabled'}><span class="sw" style="background:${l.color}"></span>${esc(l.name)}</button>`
                  )
                  .join('')}</div>`
              : ''
          }
        </section>
        <section class="panel components" aria-label="By component">
          <div class="panel-head"><h2>By Component <span class="count">${components.length}</span></h2>${state.component ? '<button class="btn small" type="button" data-comp="">Show All</button>' : ''}</div>
          <div class="clist">${compRows}</div>
        </section>
      </div>
      <section class="panel issues" aria-label="Error groups">
        <div class="panel-head">
          <h2>Error Groups <span class="count">${nf.format(list.length)}${list.length !== scoped.length ? ` of ${nf.format(scoped.length)}` : ''}</span></h2>
          <div class="controls">
            <div class="seg" id="level" role="group" aria-label="Level">
              <button type="button" data-level="all" aria-pressed="${state.level === 'all'}">All</button>
              <button type="button" data-level="error" aria-pressed="${state.level === 'error'}">Errors</button>
              <button type="button" data-level="warning" aria-pressed="${state.level === 'warning'}">Warnings</button>
            </div>
            <label class="toggle"><input type="checkbox" id="new-only" ${state.newOnly ? 'checked' : ''}> New only</label>
            <select class="select" id="sort" aria-label="Sort">
              <option value="count"${state.sort === 'count' ? ' selected' : ''}>Most errors</option>
              <option value="recent"${state.sort === 'recent' ? ' selected' : ''}>Most recent</option>
              <option value="newest"${state.sort === 'newest' ? ' selected' : ''}>Newest first</option>
            </select>
          </div>
        </div>
        ${emptyList || `<div class="cols"><span></span><span>Error</span><span>Trend</span><span>Errors</span><span>Last Seen</span></div><div class="rows">${rows}</div><div class="listfoot">${footNotes.join(' ')}</div>`}
      </section>`;

    drawChart($('#main-chart'), report, layers, {
      height: 200,
      label: `Errors per ${report.bucket} in the ${long}`
    });

    let foot = [];
    if (report.retention.hourly_days && report.retention.days) {
      foot.push(
        `Hourly counts are kept for ${report.retention.hourly_days} days and daily counts for ${report.retention.days} days`
      );
    }
    foot.push(`${plural(report.storedGroups, 'error group', 'error groups')} stored`);
    if (report.version) foot.push(`Collector ${report.version}`);
    $('#foot-meta').textContent = foot.join(' · ');

    if (state.open != null) {
      let issue = findIssue(state.open);
      if (issue) {
        if ($('#sheet').hidden) openSheet(state.open, false);
        else renderSheet(issue);
      } else {
        closeSheet();
      }
    }
  };

  let sampleException = sample => {
    let values = (sample && sample.exception && sample.exception.values) || [];
    return values.slice().reverse();
  };

  let renderFrames = (exception, expanded) => {
    let frames = ((exception.stacktrace && exception.stacktrace.frames) || [])
      .slice()
      .reverse();
    if (!frames.length) return '';

    let anyInApp = frames.some(f => f.in_app === true);
    let out = [];
    let hidden = 0;
    for (let f of frames) {
      let inApp = !anyInApp || f.in_app === true;
      if (!inApp && !expanded) {
        hidden++;
        continue;
      }

      let file = f.filename || f.module || '';
      let loc = `${file}${f.lineno ? `:${f.lineno}` : ''}${f.colno ? `:${f.colno}` : ''}`;
      out.push(
        `<div class="frame${inApp ? '' : ' lib'}"><span class="fn">${esc(f.function || '<anonymous>')}</span>${loc ? `<span class="loc">${esc(loc)}</span>` : ''}</div>`
      );
    }

    if (hidden) {
      out.push(
        `<button class="libtoggle" type="button" data-frames="expand">Show ${hidden} runtime ${hidden === 1 ? 'frame' : 'frames'}</button>`
      );
    } else if (expanded && anyInApp && frames.some(f => f.in_app !== true)) {
      out.push(
        '<button class="libtoggle" type="button" data-frames="collapse">Hide runtime frames</button>'
      );
    }

    return `<div class="frames">${out.join('')}</div>`;
  };

  let renderSample = (issue, sample) => {
    if (!sample) return '<p class="note">No example was kept for this error group.</p>';

    let runtime = sample.contexts && sample.contexts.runtime;
    let os = sample.contexts && sample.contexts.os;
    let meta = [];
    if (sample.timestamp)
      meta.push(`<span><b>${esc(fmtDateTime(parseTime(sample.timestamp)))}</b></span>`);
    if (sample.release)
      meta.push(`<span>Release <b class="mono">${esc(sample.release)}</b></span>`);
    if (runtime && runtime.name)
      meta.push(
        `<span>Runtime <b>${esc([runtime.name, runtime.version].filter(Boolean).join(' '))}</b></span>`
      );
    if (os && os.name)
      meta.push(
        `<span>OS <b>${esc([os.name, os.version].filter(Boolean).join(' '))}</b></span>`
      );
    if (sample.platform) meta.push(`<span>Platform <b>${esc(sample.platform)}</b></span>`);

    let parts = [`<div class="event-meta">${meta.join('')}</div>`];
    if (issue.bootStep) {
      parts.push(
        `<div class="mech">The component stopped during startup, at the <span class="mono">${esc(issue.bootStep)}</span> step.</div>`
      );
    }

    let exceptions = sampleException(sample);
    let hasFrames = false;
    exceptions.forEach((exception, index) => {
      if (
        exceptions.length > 1 ||
        (exception.type && exception.type !== issue.type) ||
        (exception.value && exception.value !== issue.value)
      ) {
        parts.push(
          `<p class="exc-head">${index ? 'Caused by ' : ''}<b>${esc(exception.type || 'Error')}</b>${exception.value ? `: ${esc(exception.value)}` : ''}</p>`
        );
      }
      if (exception.mechanism && exception.mechanism.handled === false && index === 0) {
        parts.push(
          `<div class="mech">Not handled by the application (${esc(exception.mechanism.type || 'unknown mechanism')}).</div>`
        );
      }

      let frames = renderFrames(exception, sheetState.expanded);
      if (frames) hasFrames = true;
      parts.push(frames);
    });

    if (sample.message && !exceptions.length)
      parts.push(`<pre class="message">${esc(sample.message)}</pre>`);

    let details = Object.entries(sampleDetails(sample));
    if (details.length) {
      parts.push(
        `<dl class="kv details">${details
          .map(([k, v]) => `<dt>${esc(detailLabel(k))}</dt><dd>${esc(v)}</dd>`)
          .join('')}</dl>`
      );
    }
    let log = sampleLog(sample);
    if (log.length) {
      parts.push(
        `<p class="exc-head">Last ${plural(log.length, 'log line', 'log lines')}</p><pre class="message log">${esc(log.join('\n'))}</pre>`
      );
    }

    let reportedFailure = exceptions.some(
      e => e.mechanism && e.mechanism.type === 'metorial.failure' && !e.stacktrace
    );
    if (issue.overflow)
      parts.push('<p class="note">Errors counted together have no stack trace.</p>');
    else if (reportedFailure)
      parts.push(
        '<p class="note">Reported by the component when it noticed the failure. The details and log say where it happened.</p>'
      );
    else if (!hasFrames && exceptions.length)
      parts.push('<p class="note">This error was reported without a stack trace.</p>');
    if (hasFrames) {
      parts.push(
        '<p class="note">Line numbers change with every release. Errors are grouped by function names, so a group stays the same across upgrades.</p>'
      );
    }

    return parts.join('');
  };

  let groupingLabel = (issue, sample) => {
    if (issue.overflow) return 'Counted together (collector limit)';
    let fingerprint = (sample && sample.fingerprint) || [];
    if (
      fingerprint.length &&
      !(fingerprint.length === 1 && fingerprint[0] === '{{ default }}')
    ) {
      return `Fingerprint: ${fingerprint.join(', ')}`;
    }
    if (sampleException(sample).length) return 'Exception type and stack trace';
    return 'Message';
  };

  let sheetState = { sample: 'latest', expanded: false };

  let renderSheet = issue => {
    let report = current;
    let sample =
      sheetState.sample === 'first'
        ? issue.firstSample || issue.latestSample
        : issue.latestSample || issue.firstSample;
    let maxRel = Math.max(1, ...issue.releases.map(r => r.count));
    let tags = Object.assign({ component: issue.component }, (sample && sample.tags) || {});
    let color = colorFor(report, issue.component);

    $('#sheet').innerHTML = `
      <div class="sheet-inner">
        <div class="sheet-head">
          <span class="pill ${esc(issue.level)}">${esc(issue.level)}</span>
          <span class="comp"><i class="sw" style="background:${color}"></i>${esc(issue.component)}</span>
          ${badges(issue, report)}
          <span class="spacer"></span>
          <button class="icon-btn" type="button" data-close aria-label="Close">${icons.close}</button>
        </div>
        <h2 class="dtitle">${esc(issue.type)}</h2>
        ${issue.value ? `<p class="dvalue">${esc(issue.value)}</p>` : ''}
        ${issue.culprit || issue.subject ? `<p class="dculprit">${esc(issue.culprit || issue.subject)}</p>` : ''}
        <dl class="dstats">
          <div><dt>${esc(windowShort(report.days))}</dt><dd>${nf.format(issue.count)}</dd></div>
          <div><dt>All Time</dt><dd>${nf.format(issue.total)}</dd></div>
          <div><dt>First Seen</dt><dd>${esc(ago(issue.firstSeen))}<small>${esc(fmtDateTime(issue.firstSeen))}</small></dd></div>
          <div><dt>Last Seen</dt><dd>${esc(ago(issue.lastSeen))}<small>${esc(fmtDateTime(issue.lastSeen))}</small></dd></div>
        </dl>
        <section class="dsec">
          <h3>Errors Over Time <span class="aside">${report.bucket === 'hour' ? 'Hourly' : 'Daily'}, ${esc(windowLong(report.days))}</span></h3>
          <div class="chart" id="detail-chart"></div>
        </section>
        ${
          issue.releases.length
            ? `<section class="dsec">
          <h3>Releases <span class="aside">${plural(issue.releases.length, 'release', 'releases')}</span></h3>
          <div class="scroll-x"><table class="rtable">
            <thead><tr><th>Release</th><th class="r">Errors</th><th>First Seen</th><th>Last Seen</th></tr></thead>
            <tbody>${issue.releases
              .map(
                r =>
                  `<tr><td class="mono">${esc(r.release || 'unknown')}${r.release && r.release === report.latest ? ' <span class="badge">Latest</span>' : ''}</td><td class="r num"><span class="rbar" style="width:${Math.max(3, (r.count / maxRel) * 64).toFixed(0)}px"></span>${nf.format(r.count)}</td><td>${esc(fmtDate(r.firstSeen))}</td><td>${esc(fmtDate(r.lastSeen))}</td></tr>`
              )
              .join('')}</tbody>
          </table></div>
        </section>`
            : ''
        }
        <section class="dsec">
          <h3>Example
            ${
              issue.firstSample && issue.latestSample
                ? `<span class="aside"><span class="seg" role="group" aria-label="Example">
              <button type="button" data-sample="latest" aria-pressed="${sheetState.sample !== 'first'}">Latest</button>
              <button type="button" data-sample="first" aria-pressed="${sheetState.sample === 'first'}">First</button>
            </span></span>`
                : ''
            }
          </h3>
          ${renderSample(issue, sample)}
        </section>
        <section class="dsec">
          <h3>Tags</h3>
          <dl class="kv">${Object.entries(tags)
            .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
            .join('')}</dl>
        </section>
        <section class="dsec">
          <h3>Grouping</h3>
          <dl class="kv">
            <dt>Grouped by</dt><dd>${esc(groupingLabel(issue, sample))}</dd>
            <dt>Group ID</dt><dd>${esc(issue.hash)}</dd>
            <dt>Grouping version</dt><dd>${esc(issue.groupingVersion)}</dd>
          </dl>
          <p class="copy-row"><button class="btn small" type="button" data-copy>${icons.copy} Copy as JSON</button></p>
        </section>
      </div>`;

    drawChart(
      $('#detail-chart'),
      report,
      [{ name: issue.type, color, values: issue.series }],
      {
        height: 150,
        label: `Errors per ${report.bucket} for ${issue.type}`
      }
    );
  };

  let lastFocus = null;

  let openSheet = (id, focus = true) => {
    let issue = findIssue(id);
    if (!issue) return;

    if (state.open !== id) sheetState = { sample: 'latest', expanded: false };
    state.open = id;
    if (focus) lastFocus = document.activeElement;

    let sheet = $('#sheet');
    let overlay = $('#overlay');
    sheet.hidden = false;
    overlay.hidden = false;
    renderSheet(issue);
    document
      .querySelectorAll('.row')
      .forEach(r => r.setAttribute('aria-current', String(+r.dataset.id === id)));

    requestAnimationFrame(() => {
      sheet.classList.add('show');
      overlay.classList.add('show');
      if (focus) sheet.querySelector('[data-close]').focus();
      renderSheet(issue);
    });
  };

  let closeSheet = () => {
    if (state.open == null) return;
    state.open = null;

    let sheet = $('#sheet');
    let overlay = $('#overlay');
    sheet.classList.remove('show');
    overlay.classList.remove('show');
    document.querySelectorAll('.row').forEach(r => r.setAttribute('aria-current', 'false'));

    setTimeout(() => {
      if (state.open == null) {
        sheet.hidden = true;
        overlay.hidden = true;
      }
    }, 230);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  };

  let toastTimer;

  let toast = message => {
    let el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  };

  // navigator.clipboard only exists in secure contexts, and on-prem installations are often
  // served over plain HTTP, so fall back to a hidden textarea.
  let copyText = async text => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    let area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let copied = document.execCommand('copy');
    area.remove();
    if (!copied) throw new Error('copy failed');
  };

  let setState = patch => {
    Object.assign(state, patch);
    render();
  };

  document.addEventListener('click', event => {
    let t = event.target.closest('button, a');
    if (!t) return;

    if (t.dataset.level) return setState({ level: t.dataset.level });
    if (t.hasAttribute('data-comp') && !t.closest('#sheet')) {
      return setState({ component: t.dataset.comp === state.component ? '' : t.dataset.comp });
    }
    if (t.dataset.id) return openSheet(+t.dataset.id);
    if (t.hasAttribute('data-close')) return closeSheet();

    if (t.hasAttribute('data-clear')) {
      $('#search').value = '';
      return setState({ q: '', level: 'all', newOnly: false });
    }

    if (t.dataset.sample) {
      sheetState.sample = t.dataset.sample;
      let issue = findIssue(state.open);
      if (issue) renderSheet(issue);
      return;
    }

    if (t.dataset.frames) {
      sheetState.expanded = t.dataset.frames === 'expand';
      let issue = findIssue(state.open);
      if (issue) renderSheet(issue);
      return;
    }

    if (t.hasAttribute('data-copy')) {
      let issue = findIssue(state.open);
      if (!issue) return;
      copyText(JSON.stringify(issue.raw, null, 2)).then(
        () => toast('Copied the error group as JSON'),
        () => toast('Copying is blocked in this browser')
      );
      return;
    }
  });

  $('#overlay').addEventListener('click', closeSheet);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeSheet();
  });

  document.addEventListener('change', event => {
    let id = event.target.id;
    if (id === 'component') setState({ component: event.target.value });
    if (id === 'sort') setState({ sort: event.target.value });
    if (id === 'new-only') setState({ newOnly: event.target.checked });
  });

  let searchTimer;
  $('#search').addEventListener('input', event => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => setState({ q: event.target.value }), 120);
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 120);
  });

  render();
})();
