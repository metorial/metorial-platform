export let installationSessionHtml = (d: {
  sessionId: string;
  backends: Array<{
    id: string;
    type: string;
    name: string;
    description: string | null;
    isDefault: boolean;
  }>;
}) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Connect Repository Provider - Metorial</title>

  <link rel="icon" type="image/png" href="https://metorial.com/favicon-96x96.png" sizes="96x96" />
  <link rel="icon" type="image/svg+xml" href="https://metorial.com/favicon.svg" />
  <link rel="shortcut icon" href="https://metorial.com/favicon.ico" />
  <link rel="apple-touch-icon" sizes="180x180" href="https://metorial.com/apple-touch-icon.png" />
  <meta name="apple-mobile-web-app-title" content="Metorial" />

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

    .backends {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
    }

    .backend-button {
      display: flex;
      align-items: center;
      padding: 16px;
      border: 1px solid #d2d2d7;
      border-radius: 8px;
      background: white;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
      color: inherit;
    }

    .backend-button:hover {
      border-color: #0066cc;
      background: #f5f9ff;
    }

    .backend-icon {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background: #f5f5f7;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
      overflow: hidden;
    }

    .backend-icon img {
      width: 20px;
      height: 20px;
      object-fit: contain;
    }

    .backend-info {
      flex: 1;
    }

    .backend-name {
      font-size: 15px;
      font-weight: 500;
      color: #1d1d1f;
      margin-bottom: 2px;
    }

    .backend-description {
      font-size: 13px;
      color: #86868b;
    }

    .backend-badge {
      font-size: 11px;
      padding: 2px 8px;
      background: #e8e8ed;
      border-radius: 4px;
      color: #6e6e73;
      margin-left: 8px;
    }

    .divider {
      height: 1px;
      background: #d2d2d7;
      margin: 24px 0;
    }

    .create-backend-button {
      display: block;
      width: 100%;
      padding: 12px;
      background: white;
      border: 1px solid #d2d2d7;
      border-radius: 8px;
      font-size: 15px;
      color: black;
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
      text-decoration: none;
    }

    .create-backend-button:hover {
      background: #f5f9ff;
      border-color: #0066cc;
    }
  </style>
</head>
<body>
  <div class="container">
    <img src="https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg" alt="Metorial" class="logo" />

    <h1>Connect Repository Provider</h1>
    <p class="subtitle">Choose a provider to connect your repositories</p>

    <div class="backends">
      ${d.backends
        .map(
          backend => `
        <a href="/origin/scm/installation-session/${d.sessionId}/select-backend/${backend.id}" class="backend-button">
          <div class="backend-icon">
            <img src="${getBackendIconUrl(backend.type)}" alt="${backend.name}" />
          </div>
          <div class="backend-info">
            <div class="backend-name">
              ${backend.name}
              ${backend.isDefault ? '<span class="backend-badge">Default</span>' : ''}
            </div>
            ${backend.description ? `<div class="backend-description">${backend.description}</div>` : ''}
          </div>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7.5 15L12.5 10L7.5 5" stroke="#86868b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
      `
        )
        .join('')}
    </div>

    <div class="divider"></div>

    <a href="/origin/scm/installation-session/${d.sessionId}/setup-backend" class="create-backend-button">
      + Add Custom Provider
    </a>
  </div>

  <script>
    function getBackendIconUrl(type) {
      const icons = {
        'github': 'https://provider-logos.metorial-cdn.com/github.png',
        'github_enterprise': 'https://provider-logos.metorial-cdn.com/github.png',
        'gitlab': 'https://provider-logos.metorial-cdn.com/gitlab.svg',
        'gitlab_selfhosted': 'https://provider-logos.metorial-cdn.com/gitlab.svg',
        'bitbucket': 'https://provider-logos.metorial-cdn.com/bitbucket.svg',
        'bitbucket_data_center': 'https://provider-logos.metorial-cdn.com/bitbucket.svg'
      };
      return icons[type] || 'https://provider-logos.metorial-cdn.com/github.png';
    }
  </script>
</body>
</html>`;

function getBackendIconUrl(type: string): string {
  const icons: Record<string, string> = {
    github: 'https://provider-logos.metorial-cdn.com/github.png',
    github_enterprise: 'https://provider-logos.metorial-cdn.com/github.png',
    gitlab: 'https://provider-logos.metorial-cdn.com/gitlab.svg',
    gitlab_selfhosted: 'https://provider-logos.metorial-cdn.com/gitlab.svg',
    bitbucket: 'https://provider-logos.metorial-cdn.com/bitbucket.svg',
    bitbucket_data_center: 'https://provider-logos.metorial-cdn.com/bitbucket.svg'
  };
  return icons[type] || 'https://provider-logos.metorial-cdn.com/github.png';
}
