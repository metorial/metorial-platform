export let backendSetupHtml = (d: { sessionId: string; installationSessionId?: string }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Setup Custom Provider - Metorial</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f5f7;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 16px rgba(0,0,0,0.08);
      padding: 32px;
      max-width: 500px;
      width: 100%;
    }

    .logo {
      width: 40px;
      height: 40px;
      margin: 0 auto 24px;
      display: block;
    }

    h1 {
      font-size: 24px;
      font-weight: 600;
      text-align: center;
      color: #1d1d1f;
      margin-bottom: 8px;
    }

    .subtitle {
      font-size: 14px;
      color: #86868b;
      text-align: center;
      margin-bottom: 32px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #1d1d1f;
      margin-bottom: 8px;
    }

    input, select {
      width: 100%;
      padding: 12px;
      border: 1px solid #d2d2d7;
      border-radius: 8px;
      font-size: 15px;
      transition: border-color 0.2s;
    }

    input:focus, select:focus {
      outline: none;
      border-color: #0066cc;
    }

    textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid #d2d2d7;
      border-radius: 8px;
      font-size: 14px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
      resize: vertical;
      min-height: 80px;
      transition: border-color 0.2s;
    }

    textarea:focus {
      outline: none;
      border-color: #0066cc;
    }

    .help-text {
      font-size: 13px;
      color: #86868b;
      margin-top: 4px;
    }

    button {
      width: 100%;
      padding: 14px;
      background: #0066cc;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    button:hover {
      background: #0055b3;
    }

    button:disabled {
      background: #d2d2d7;
      cursor: not-allowed;
    }

    .error {
      background: #fff1f0;
      border: 1px solid #ffccc7;
      color: #cf1322;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
    }

    .back-link {
      display: block;
      text-align: center;
      color: #0066cc;
      font-size: 14px;
      margin-top: 16px;
      text-decoration: none;
    }

    .back-link:hover {
      text-decoration: underline;
    }

    .info-box {
      background: #f5f9ff;
      border: 1px solid #d6e4ff;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 24px;
    }

    .info-box-title {
      font-size: 13px;
      font-weight: 600;
      color: #1d1d1f;
      margin-bottom: 8px;
    }

    .info-box-content {
      font-size: 13px;
      color: #595959;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
      background: white;
      padding: 8px;
      border-radius: 4px;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="container">
    <img src="https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg" alt="Metorial" class="logo" />

    <h1>Setup Custom Provider</h1>
    <p class="subtitle">Configure your GitHub Enterprise or GitLab instance</p>

    <div class="info-box">
      <div class="info-box-title">OAuth Callback URL</div>
      <div class="info-box-content" id="callbackUrl">Select a provider type to see the callback URL</div>
    </div>

    <div id="error" class="error" style="display: none;"></div>

    <form id="setupForm">
      <div class="form-group">
        <label for="type">Provider Type</label>
        <select id="type" name="type" required>
          <option value="">Select provider type...</option>
          <option value="github_enterprise">GitHub Enterprise</option>
          <option value="gitlab_selfhosted">GitLab Self-Hosted</option>
        </select>
      </div>

      <div class="form-group">
        <label for="name">Name</label>
        <input type="text" id="name" name="name" placeholder="e.g., Company GitHub" required />
        <div class="help-text">A friendly name for this provider</div>
      </div>

      <div class="form-group">
        <label for="apiUrl">Base URL</label>
        <input type="url" id="apiUrl" name="apiUrl" placeholder="https://github.company.com" required />
        <div class="help-text">The base URL of your instance (e.g., https://github.company.com or https://gitlab.company.com)</div>
      </div>

      <div class="form-group" id="githubFields" style="display: none;">
        <label for="appId">GitHub App ID</label>
        <input type="text" id="appId" name="appId" placeholder="123456" />
        <div class="help-text">The numeric ID of your GitHub App</div>

        <label for="appSlug" style="margin-top: 12px;">GitHub App Slug</label>
        <input type="text" id="appSlug" name="appSlug" placeholder="my-app-name" />
        <div class="help-text">The URL-friendly name of your GitHub App</div>

        <label for="appPrivateKey" style="margin-top: 12px;">GitHub App Private Key</label>
        <textarea id="appPrivateKey" name="appPrivateKey" placeholder="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"></textarea>
      </div>

      <div class="form-group">
        <label for="clientId">OAuth Client ID</label>
        <input type="text" id="clientId" name="clientId" required />
      </div>

      <div class="form-group">
        <label for="clientSecret">OAuth Client Secret</label>
        <input type="password" id="clientSecret" name="clientSecret" required />
      </div>

      <button type="submit">Setup Provider</button>
    </form>

    ${
      d.installationSessionId
        ? `<a href="/origin/scm/installation-session/${d.installationSessionId}" class="back-link">← Back to provider selection</a>`
        : ''
    }
  </div>

  <script>
    const form = document.getElementById('setupForm');
    const typeSelect = document.getElementById('type');
    const githubFields = document.getElementById('githubFields');
    const errorDiv = document.getElementById('error');
    const callbackUrlDiv = document.getElementById('callbackUrl');

    typeSelect.addEventListener('change', (e) => {
      const type = e.target.value;
      if (type === 'github_enterprise') {
        githubFields.style.display = 'block';
        document.getElementById('appId').required = true;
        document.getElementById('appSlug').required = true;
        document.getElementById('appPrivateKey').required = true;
        callbackUrlDiv.textContent = window.location.origin + '/origin/oauth/github/callback';
      } else if (type === 'gitlab_selfhosted') {
        githubFields.style.display = 'none';
        document.getElementById('appId').required = false;
        document.getElementById('appSlug').required = false;
        document.getElementById('appPrivateKey').required = false;
        callbackUrlDiv.textContent = window.location.origin + '/origin/oauth/gitlab/callback';
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorDiv.style.display = 'none';

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      try {
        const response = await fetch(\`/origin/scm/backend-setup/${d.sessionId}/complete\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to setup provider');
        }

        // Check if we got redirected (URL changed) or got HTML response
        if (response.redirected) {
          window.location.href = response.url;
        } else {
          // Server returned HTML (completion dashboard), replace current page
          const html = await response.text();
          document.open();
          document.write(html);
          document.close();
        }
      } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
      }
    });
  </script>
</body>
</html>`;
