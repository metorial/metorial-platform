export let completeDashboardHtml = () => `<!DOCTYPE html>
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
    }

    img {
      width: 40px;
      height: auto;
      margin: 0px auto;
      animation: scale 1.5s ease-in-out infinite;
    }

    @keyframes scale {
      0% {
        transform: scale(1);
      }

      50% {
        transform: scale(1.3);
      }

      100% {
        transform: scale(1);
      }
    }
  </style>
</head>

<body>

  <section>
    <img src="https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg" alt="Metorial" />
  </section>

  <script>
    function sendToOpener(data) {
      if (window.opener) {
        window.opener.postMessage(data, "*");
      }
    }

    setTimeout(() => {
      sendToOpener({ type: 'scm_complete' });

      setTimeout(() => {
        try {
          window.close();
        } catch {}
      }, 2000);
    }, 100);
  </script>
    
</body>

</html>`;
