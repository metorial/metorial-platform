export let setupCompleteHtml = (d: {
  providerName: string;
  markdownContent: string;
  connectionValues: {
    entityId?: string;
    replyUrl?: string;
    redirectUri?: string;
    clientId?: string;
    clientSecret?: string;
  };
}) => {
  let valuesHtml = Object.entries(d.connectionValues)
    .map(
      ([key, value]) => `
      <div class="value-item">
        <div class="value-label">${formatLabel(key)}</div>
        <div class="value-content">
          <code>${value}</code>
          <button class="copy-btn" onclick="copyToClipboard('${value}', this)">Copy</button>
        </div>
      </div>
    `
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Setup Complete - Metorial</title>
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

    .success-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #e8f5e9;
      color: #2e7d32;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 16px;
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

    .values-container {
      margin-top: 24px;
    }

    .value-item {
      margin-bottom: 24px;
    }

    .value-label {
      font-size: 14px;
      font-weight: 500;
      color: #666;
      margin-bottom: 8px;
    }

    .value-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .value-content code {
      flex: 1;
      background: #f5f5f5;
      padding: 12px;
      border-radius: 6px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      word-break: break-all;
    }

    .copy-btn {
      padding: 8px 16px;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .copy-btn:hover {
      background: #f5f5f5;
    }

    .copy-btn.copied {
      background: #e8f5e9;
      color: #2e7d32;
      border-color: #2e7d32;
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

      .value-content {
        flex-direction: column;
        align-items: stretch;
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
        <div class="success-badge">
          ✓ Connection Created Successfully
        </div>
        <h1>Setup Instructions</h1>
      </div>
      <div class="left-panel-content">
        <div class="markdown-content" id="markdown-content"></div>
      </div>
    </div>

    <div class="right-panel">
      <h1>Connection Values</h1>
      <p style="color: #666; margin-bottom: 24px;">Use these values to complete the setup in your identity provider:</p>

      <div class="values-container">
        ${valuesHtml}
      </div>
    </div>
  </div>

  <script>
    const markdown = \`${d.markdownContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;

    // Render markdown
    document.getElementById('markdown-content').innerHTML = marked.parse(markdown);

    function copyToClipboard(text, button) {
      navigator.clipboard.writeText(text).then(() => {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.classList.add('copied');

        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove('copied');
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy:', err);
      });
    }
  </script>
</body>

</html>`;
};

let formatLabel = (key: string) => {
  const labels: Record<string, string> = {
    entityId: 'Entity ID',
    replyUrl: 'Reply URL (ACS URL)',
    redirectUri: 'Redirect URI',
    clientId: 'Client ID',
    clientSecret: 'Client Secret'
  };

  return labels[key] || key;
};
