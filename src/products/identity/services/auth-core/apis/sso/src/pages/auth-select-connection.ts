import type { SsoConnection, SsoTenant } from '@mtsrc/auth-core-db';
import { htmlEncode } from '@mtsrc/auth-core-http/src/htmlEncode';

export let authSelectConnectionHtml = (d: {
  tenant: Pick<SsoTenant, 'name'>;
  connections: Pick<SsoConnection, 'id' | 'name' | 'providerType' | 'providerName'>[];
  clientSecret: string;
}) => `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Metorial</title>

  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      background: #fafafa;
    }

    * {
      box-sizing: border-box;
    }

    .navbar {
      background: white;
      border-bottom: 1px solid #e5e5e5;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .navbar-inner {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .navbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .tenant-name {
      font-size: 14px;
      font-weight: 500;
      color: #171717;
    }

    .navbar-right {
      font-size: 12px;
      color: #737373;
    }

    .container {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 24px;
    }

    .form-card {
      background: white;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 32px;
      width: 100%;
      max-width: 600px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    }

    h1 {
      margin-top: 0;
      font-size: 24px;
      font-weight: 600;
      color: #171717;
      margin-bottom: 8px;
    }

    p {
      font-size: 14px;
      color: #777;
      margin-top: 0;
      margin-bottom: 24px;
    }

    .connections-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .connection-button {
      width: 100%;
      padding: 16px;
      font-size: 14px;
      font-weight: 500;
      color: #171717;
      background: white;
      border: 1px solid #d4d4d4;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .connection-button:hover {
      border-color: #525252;
      background: #fafafa;
    }

    .connection-button:active {
      background: #f5f5f5;
    }

    .connection-name {
      font-weight: 500;
      color: #171717;
    }

    .connection-type {
      font-size: 12px;
      color: #737373;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>

<body>
  <nav class="navbar">
    <div class="navbar-inner">
      <div class="navbar-left">
        <span class="tenant-name">${htmlEncode(d.tenant.name)}</span>
      </div>
      <div class="navbar-right">
        Secured by Metorial
      </div>
    </div>
  </nav>

  <div class="container">
    <div class="form-card">
      <h1>Select Connection</h1>
      <p>Please select how you would like to authenticate:</p>

      <form class="connections-list" method="get">
        <input type="hidden" name="client_secret" value="${htmlEncode(d.clientSecret)}" />
        ${d.connections
          .map(
            (connection, index) => `
          <button class="connection-button" type="submit" name="connection_id" value="${htmlEncode(connection.id)}"${index === 0 ? ' autofocus' : ''}>
            <span class="connection-name">${htmlEncode(connection.name)}</span>
            <span class="connection-type">${htmlEncode(connection.providerType)}${connection.providerName ? ` - ${htmlEncode(connection.providerName)}` : ''}</span>
          </button>
        `
          )
          .join('')}
      </form>
    </div>
  </div>

</body>

</html>`;
