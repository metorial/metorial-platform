let escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

let safeRedirectUrl = (value?: string | null) => {
  if (!value) return null;
  try {
    let url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};

export let scmResultHtml = (d: {
  kind: 'pending_approval' | 'succeeded' | 'expired';
  sessionId?: string;
  redirectUrl?: string | null;
  accountName?: string | null;
  canRecheck?: boolean;
}) => {
  let redirectUrl = safeRedirectUrl(d.redirectUrl);
  let pending = d.kind === 'pending_approval';
  let succeeded = d.kind === 'succeeded';
  let title = pending
    ? 'Approval Requested'
    : succeeded
      ? 'GitHub Connected'
      : 'Connection request expired';
  let description = pending
    ? `A GitHub organization owner needs to approve the Metorial app${d.accountName ? ` for <strong>${escapeHtml(d.accountName)}</strong>` : ''}. Let your admin know that the request is waiting for them.`
    : succeeded
      ? 'The GitHub App installation was processed successfully. You can return to Metorial.'
      : 'This connection request is no longer active. Return to Metorial and start a new request.';
  let statusLabel = pending
    ? 'Waiting for an organization owner'
    : succeeded
      ? 'Ready'
      : 'Expired';
  let statusClass = pending ? 'pending' : succeeded ? 'success' : 'expired';
  let backAction = redirectUrl
    ? `<a class="button secondary" href="${escapeHtml(redirectUrl)}">Go back to dashboard</a>`
    : `<button class="button secondary" onclick="notifyAndClose()">Close window</button>`;
  let recheck =
    pending && d.sessionId
      ? `<button class="button primary" id="recheck" onclick="recheckApproval()" ${d.canRecheck === false ? 'disabled' : ''}>Recheck approval</button>`
      : '';
  let correlationNote =
    pending && d.canRecheck === false
      ? '<p class="note">We could not identify the requested organization automatically. After an admin approves the app, return to Metorial and start the connection again.</p>'
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} - Metorial</title>
  <link rel="icon" type="image/svg+xml" href="https://metorial.com/favicon.svg" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; padding: 24px; display: flex; align-items: center; justify-content: center; background: #f5f5f7; color: #1d1d1f; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .card { width: 100%; max-width: 520px; padding: 32px; background: white; border: 1px solid #e5e5e7; border-radius: 14px; box-shadow: 0 8px 30px rgba(0,0,0,.07); }
    .logo { display: block; width: 40px; height: 40px; margin: 0 auto 22px; }
    h1 { margin: 0 0 10px; text-align: center; font-size: 25px; line-height: 1.2; }
    .description { margin: 0 auto 24px; max-width: 430px; text-align: center; color: #6e6e73; font-size: 14px; line-height: 1.55; }
    .status { display: flex; gap: 12px; align-items: center; padding: 15px 16px; margin-bottom: 20px; border: 1px solid; border-radius: 9px; font-size: 14px; font-weight: 550; }
    .status::before { content: ""; flex: 0 0 auto; width: 10px; height: 10px; border-radius: 50%; }
    .status.pending { color: #854d0e; border-color: #fde68a; background: #fffbeb; }
    .status.pending::before { background: #f59e0b; box-shadow: 0 0 0 4px #fef3c7; }
    .status.success { color: #166534; border-color: #bbf7d0; background: #f0fdf4; }
    .status.success::before { background: #22c55e; box-shadow: 0 0 0 4px #dcfce7; }
    .status.expired { color: #52525b; border-color: #e4e4e7; background: #fafafa; }
    .status.expired::before { background: #a1a1aa; box-shadow: 0 0 0 4px #f4f4f5; }
    .actions { display: grid; grid-template-columns: ${recheck ? '1fr 1fr' : '1fr'}; gap: 10px; }
    .button { min-height: 42px; padding: 10px 14px; border-radius: 8px; border: 1px solid transparent; cursor: pointer; text-align: center; text-decoration: none; font: inherit; font-size: 14px; font-weight: 600; }
    .button.primary { color: white; background: #171717; }
    .button.primary:hover { background: #303030; }
    .button.primary:disabled { cursor: not-allowed; opacity: .5; }
    .button.secondary { color: #27272a; background: white; border-color: #d4d4d8; }
    .button.secondary:hover { background: #fafafa; }
    .note, #feedback { margin: 14px 0 0; color: #71717a; text-align: center; font-size: 12px; line-height: 1.45; }
    #feedback.error { color: #b91c1c; }
    @media (max-width: 520px) { .actions { grid-template-columns: 1fr; } .card { padding: 26px 22px; } }
  </style>
</head>
<body>
  <main class="card">
    <img class="logo" src="https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg" alt="Metorial" />
    <h1>${title}</h1>
    <p class="description">${description}</p>
    <div class="status ${statusClass}">${statusLabel}</div>
    <div class="actions">${recheck}${backAction}</div>
    ${correlationNote}
    <p id="feedback" role="status"></p>
  </main>
  <script>
    function notifyComplete() {
      if (window.opener) window.opener.postMessage({ type: 'scm_complete' }, '*');
    }
    function notifyAndClose() {
      ${succeeded ? 'notifyComplete();' : ''}
      try { window.close(); } catch {}
    }
    function notifyAndCloseIfOpener() {
      if (window.opener) {
        setTimeout(() => {
          notifyAndClose();
        }, 1500);
      } else {
        notifyComplete();
      }
    }
    async function recheckApproval() {
      let button = document.getElementById('recheck');
      let feedback = document.getElementById('feedback');
      button.disabled = true;
      button.textContent = 'Checking…';
      feedback.className = '';
      feedback.textContent = '';
      try {
        let response = await fetch('/origin/scm/installation-session/${d.sessionId ? encodeURIComponent(d.sessionId) : ''}/recheck', { method: 'POST' });
        let result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Could not check approval');
        if (result.status === 'completed') {
          notifyComplete();
          window.location.reload();
          return;
        }
        if (result.status === 'expired') {
          window.location.reload();
          return;
        }
        feedback.textContent = 'Still waiting for an organization owner to approve the app.';
      } catch (error) {
        feedback.className = 'error';
        feedback.textContent = error instanceof Error ? error.message : 'Could not check approval';
      } finally {
        button.disabled = false;
        button.textContent = 'Recheck approval';
      }
    }
    ${succeeded ? 'notifyAndCloseIfOpener();' : ''}
  </script>
</body>
</html>`;
};
