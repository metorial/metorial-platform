import { templates } from '../templates';

export let setupSelectHtml = (d: { clientSecret: string }) => {
  let providers = templates.map(
    t => `
    <button class="provider-card" onclick="selectProvider('${t.id}')">
      <div class="provider-name">${t.name}</div>
      <div class="provider-type">${t.type.toUpperCase()}</div>
    </button>
  `
  );

  return `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Select SSO Provider - Metorial</title>

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
      padding: 16px 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    nav .logo {
      font-size: 20px;
      font-weight: 600;
      color: #333;
    }

    main {
      max-width: 900px;
      margin: 60px auto;
      padding: 0 24px;
    }

    h1 {
      font-size: 28px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 12px;
      text-align: center;
    }

    .subtitle {
      font-size: 16px;
      color: #666;
      text-align: center;
      margin-bottom: 48px;
    }

    .providers-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 16px;
      margin-top: 32px;
    }

    .provider-card {
      background: white;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      padding: 24px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: left;
      width: 100%;
    }

    .provider-card:hover {
      border-color: #4a90e2;
      box-shadow: 0 4px 12px rgba(74, 144, 226, 0.15);
      transform: translateY(-2px);
    }

    .provider-name {
      font-size: 18px;
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
    }

    .provider-type {
      font-size: 12px;
      font-weight: 500;
      color: #4a90e2;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>

<body>
  <nav>
    <div class="logo">Metorial</div>
  </nav>

  <main>
    <h1>Select Your Identity Provider</h1>
    <p class="subtitle">Choose your SSO provider to get started with the setup</p>

    <div class="providers-grid">
      ${providers.join('')}
    </div>
  </main>

  <script>
    function selectProvider(providerId) {
      const clientSecret = '${d.clientSecret}';
      window.location.href = '/sso/setup/configure?clientSecret=' + clientSecret + '&providerId=' + providerId;
    }
  </script>
</body>

</html>`;
};
