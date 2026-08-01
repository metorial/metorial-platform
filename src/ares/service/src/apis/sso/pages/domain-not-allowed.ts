import { htmlEncode } from '../../../lib/htmlEncode';

export let ssoDomainNotAllowedHtml = (d: {
  domain: string | null;
  email: string;
  tenantName: string;
}) => {
  let domain = d.domain ? htmlEncode(d.domain) : null;
  let email = htmlEncode(d.email);
  let tenantName = htmlEncode(d.tenantName);

  let explanation = domain
    ? `Your identity provider signed you in as <strong>${email}</strong>, but the domain <strong>${domain}</strong> is not configured for ${tenantName} in Metorial.`
    : `Your identity provider signed you in as <strong>${email}</strong>, which is not a valid email address.`;

  return `<!DOCTYPE html>
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
      background: #f0f0f0;
      height: 100dvh;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    * {
      box-sizing: border-box;
    }

    main {
      width: calc(100% - 40px);
      max-width: 500px;
      padding: max(min(100px, 5vw), 20px) 20px;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      min-height: 70vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }

    section {
      width: 100%;
      display: flex;
      flex-direction: column;
    }

    img {
      width: 40px;
      height: auto;
      margin: 0px auto 50px auto;
    }

    h1 {
      font-size: 18px;
      font-weight: 600;
      color: #333;
      text-align: center;
      margin-bottom: 10px;
    }

    p {
      font-size: 16px;
      color: #666;
      text-align: center;
      margin-bottom: 20px;
      line-height: 1.5;
    }

    strong {
      color: #333;
      font-weight: 600;
      word-break: break-all;
    }
  </style>
</head>

<body>
  <main>
    <section>
      <img src="https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg" alt="Metorial" />

      <h1>This email domain is not configured</h1>

      <p>${explanation}</p>

      <p>Please contact your administrator to have this domain added and verified, then try signing in again.</p>
    </section>
  </main>
</body>

</html>`;
};
