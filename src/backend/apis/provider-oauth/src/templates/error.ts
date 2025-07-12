export let errorHtml = (d: {
  title: string;
  message: string;
  details?: string;
}) => `<!DOCTYPE html>
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
    }
  </style>
</head>

<body>
  <main>
    <section>
      <img src="https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg" alt="Metorial" />

      <h1>${d.title}</h1>

      <p>${d.message}</p>

      ${d.details ? `<p style="color: #777; font-size: 12px;">${d.details}</p>` : ''}
    </section>
  </main>
</body>

</html>`;
