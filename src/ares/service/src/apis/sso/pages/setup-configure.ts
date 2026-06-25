export let setupConfigureHtml = (d: {
  clientSecret: string;
  providerId: string;
  providerName: string;
  providerType: 'saml' | 'oidc';
  markdownContent: string;
  ssoServiceHost: string;
}) => {
  let formHtml =
    d.providerType === 'saml'
      ? `
      <div class="form-group">
        <label for="name">Connection Name</label>
        <input type="text" id="name" name="name" required placeholder="e.g., My Company SSO" />
      </div>

      <div class="form-group">
        <label>SAML Metadata</label>
        <div class="radio-group">
          <label class="radio-label">
            <input type="radio" name="metadataType" value="xml" checked onchange="toggleMetadataInput()" />
            XML Metadata
          </label>
          <label class="radio-label">
            <input type="radio" name="metadataType" value="url" onchange="toggleMetadataInput()" />
            Metadata URL
          </label>
        </div>
      </div>

      <div class="form-group" id="xmlGroup">
        <label for="metadataXml">Metadata XML</label>
        <textarea id="metadataXml" name="metadataXml" rows="8" placeholder="Paste your SAML metadata XML here..."></textarea>
      </div>

      <div class="form-group" id="urlGroup" style="display: none;">
        <label for="metadataUrl">Metadata URL</label>
        <input type="text" id="metadataUrl" name="metadataUrl" placeholder="https://..." />
      </div>
    `
      : `
      <div class="form-group">
        <label for="name">Connection Name</label>
        <input type="text" id="name" name="name" required placeholder="e.g., My Company SSO" />
      </div>

      <div class="form-group">
        <label for="discoveryUrl">OIDC Discovery URL</label>
        <input type="text" id="discoveryUrl" name="discoveryUrl" required placeholder="https://..." />
      </div>

      <div class="form-group">
        <label for="clientId">Client ID</label>
        <input type="text" id="clientId" name="clientId" required placeholder="Your OIDC client ID" />
      </div>

      <div class="form-group">
        <label for="oidcClientSecret">Client Secret</label>
        <input type="password" id="oidcClientSecret" name="oidcClientSecret" required placeholder="Your OIDC client secret" />
      </div>
    `;

  return `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Configure ${d.providerName} - Metorial</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
    }

    nav {
      background: white;
      border-bottom: 1px solid #e0e0e0;
      padding: 16px 0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    nav .logo {
      font-size: 20px;
      font-weight: 600;
      color: #333;
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 40px;
    }

    .container {
      display: flex;
      max-width: 1400px;
      margin: 0 auto;
      height: calc(100vh - 52px);
    }

    .left-panel {
      flex: 1;
      background: white;
      border-right: 1px solid #e0e0e0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .left-panel-header {
      padding: 40px 40px 24px 40px;
      flex-shrink: 0;
    }

    .left-panel-content {
      flex: 1;
      overflow-y: auto;
      padding: 0 40px 40px 40px;
    }

    .right-panel {
      flex: 1;
      background: white;
      padding: 40px;
      overflow-y: auto;
    }

    h1 {
      font-size: 24px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 0;
    }

    .markdown-content {
      font-size: 15px;
      line-height: 1.6;
      color: #333;
    }

    .markdown-content h1 {
      font-size: 28px;
      margin-top: 32px;
      margin-bottom: 16px;
    }

    .markdown-content h2 {
      font-size: 22px;
      margin-top: 28px;
      margin-bottom: 12px;
      color: #1a1a1a;
    }

    .markdown-content h3 {
      font-size: 18px;
      margin-top: 24px;
      margin-bottom: 8px;
      color: #333;
    }

    .markdown-content p {
      margin-bottom: 16px;
    }

    .markdown-content code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 14px;
    }

    .markdown-content pre {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      margin-bottom: 16px;
    }

    .markdown-content pre code {
      background: none;
      padding: 0;
    }

    .markdown-content ul, .markdown-content ol {
      margin-left: 24px;
      margin-bottom: 16px;
    }

    .markdown-content li {
      margin-bottom: 8px;
    }

    .markdown-content table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      display: block;
      overflow-x: auto;
    }

    .markdown-content thead,
    .markdown-content tbody,
    .markdown-content tr {
      display: table;
      width: 100%;
      table-layout: fixed;
    }

    .markdown-content th,
    .markdown-content td {
      border: 1px solid #e0e0e0;
      padding: 8px 12px;
      text-align: left;
      word-wrap: break-word;
    }

    .markdown-content th {
      background: #f5f5f5;
      font-weight: 600;
    }

    .markdown-content img {
      max-width: 100%;
      height: auto;
      margin: 16px 0;
      border-radius: 6px;
    }

    .markdown-content a {
      color: #4a90e2;
      text-decoration: none;
    }

    .markdown-content a:hover {
      text-decoration: underline;
    }

    .form-group {
      margin-bottom: 24px;
    }

    label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #333;
      margin-bottom: 8px;
    }

    input[type="text"],
    input[type="password"],
    textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      transition: border-color 0.2s;
    }

    input[type="text"]:focus,
    input[type="password"]:focus,
    textarea:focus {
      outline: none;
      border-color: #4a90e2;
    }

    textarea {
      resize: vertical;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 13px;
    }

    .radio-group {
      display: flex;
      gap: 16px;
    }

    .radio-label {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      font-weight: normal;
    }

    .radio-label input[type="radio"] {
      cursor: pointer;
    }

    .button-group {
      display: flex;
      gap: 12px;
      margin-top: 32px;
    }

    button {
      padding: 12px 24px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #4a90e2;
      color: white;
    }

    .btn-primary:hover {
      background: #3a7bc8;
    }

    .btn-primary:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: white;
      color: #666;
      border: 1px solid #e0e0e0;
    }

    .btn-secondary:hover {
      background: #f5f5f5;
    }

    .error-message {
      background: #fee;
      color: #c33;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 16px;
      display: none;
    }

    @media (max-width: 1024px) {
      .container {
        flex-direction: column;
        height: auto;
      }

      nav .logo {
        padding: 0 24px;
      }

      .left-panel {
        border-right: none;
        border-bottom: 1px solid #e0e0e0;
      }

      .left-panel-header {
        padding: 24px 24px 16px 24px;
      }

      .left-panel-content {
        padding: 0 24px 24px 24px;
      }

      .right-panel {
        padding: 24px;
      }
    }
  </style>
</head>

<body>
  <nav>
    <div class="logo">Metorial</div>
  </nav>

  <div class="container">
    <div class="left-panel">
      <div class="left-panel-header">
        <h1>Setup Instructions</h1>
      </div>
      <div class="left-panel-content">
        <div class="markdown-content" id="markdown-content"></div>
      </div>
    </div>

    <div class="right-panel">
      <h1>Configure ${d.providerName}</h1>

      <div class="error-message" id="error-message"></div>

      <form id="setup-form">
        ${formHtml}

        <div class="button-group">
          <button type="button" class="btn-secondary" onclick="goBack()">Back</button>
          <button type="submit" class="btn-primary" id="submit-btn">Create Connection</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    const markdown = \`${d.markdownContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
    const clientSecret = '${d.clientSecret}';
    const providerId = '${d.providerId}';
    const providerType = '${d.providerType}';

    // Render markdown
    document.getElementById('markdown-content').innerHTML = marked.parse(markdown);

    function toggleMetadataInput() {
      const metadataType = document.querySelector('input[name="metadataType"]:checked').value;
      document.getElementById('xmlGroup').style.display = metadataType === 'xml' ? 'block' : 'none';
      document.getElementById('urlGroup').style.display = metadataType === 'url' ? 'block' : 'none';
    }

    function goBack() {
      window.location.href = '/sso/setup?clientSecret=' + clientSecret;
    }

    function showError(message) {
      const errorEl = document.getElementById('error-message');
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }

    function hideError() {
      document.getElementById('error-message').style.display = 'none';
    }

    document.getElementById('setup-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();

      const submitBtn = document.getElementById('submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';

      const formData = new FormData(e.target);
      const name = formData.get('name');

      let payload = {
        clientSecret,
        providerId,
        name
      };

      if (providerType === 'saml') {
        const metadataType = formData.get('metadataType');
        if (metadataType === 'xml') {
          const metadataXml = formData.get('metadataXml');
          if (!metadataXml) {
            showError('Please provide SAML metadata XML');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Connection';
            return;
          }
          payload.samlMetadata = {
            type: 'xml',
            payload: metadataXml
          };
        } else {
          const metadataUrl = formData.get('metadataUrl');
          if (!metadataUrl) {
            showError('Please provide metadata URL');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Connection';
            return;
          }
          payload.samlMetadata = {
            type: 'url',
            url: metadataUrl
          };
        }
      } else {
        payload.oidcDiscoveryUrl = formData.get('discoveryUrl');
        payload.oidcClientId = formData.get('clientId');
        payload.oidcClientSecret = formData.get('oidcClientSecret');
      }

      try {
        const response = await fetch('/sso/setup/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create connection');
        }

        // Redirect to success page
        window.location.href = '/sso/setup/complete?clientSecret=' + clientSecret;
      } catch (error) {
        showError(error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Connection';
      }
    });
  </script>
</body>

</html>`;
};
