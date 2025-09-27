export let completeHtml = () => `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/vite.svg" />
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

    section {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 20px;
      align-items: center;
      justify-content: center;
    }

    img {
      width: 40px;
      height: auto;
      margin: 0px auto;
    }

    h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }

    p {
      margin: 0;
      font-size: 14px;
      color: #666;
      font-weight: 500;
    }
  </style>
</head>

<body>

  <section>
    <img src="https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg" alt="Metorial" />

    <h1>Authentication Complete</h1>
    <p>You can close this window and return to the application.</p>
  </section>

  <script>
    function sendToOpener(data) {
      if (window.opener) {
        window.opener.postMessage(data, "*");
      }
    }

    setTimeout(() => {
      sendToOpener({ type: 'oauth_complete' });
    }, 100);
  </script>
    
</body>

</html>`;
