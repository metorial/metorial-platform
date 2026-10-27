import { Context } from '@lowerdeck/hono';
import { createHash } from 'node:crypto';
import { html, raw } from 'hono/html';
import { getPublicMcpInstallInstructions } from './installInstructions';
import { publicMcpInstallScript } from './installPageScript';
import { publicMcpInstallStyles } from './installPageStyles';

let scriptHash = createHash('sha256').update(publicMcpInstallScript).digest('base64');
let styleHash = createHash('sha256').update(publicMcpInstallStyles).digest('base64');

let renderDocument = (
  c: Context,
  d: {
    title: string;
    body: ReturnType<typeof html>;
    status: 200 | 404 | 503;
    interactive?: boolean;
    routingMiss?: boolean;
  }
) =>
  c.html(
    html`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="referrer" content="no-referrer" />
          <title>${d.title} · Metorial</title>
          ${raw('<style>' + publicMcpInstallStyles + '</style>')}
        </head>
        <body>
          <div class="page">
            <div class="brand" aria-label="Metorial">
              <svg width="30" height="30" viewBox="0 0 56 56" fill="none" aria-hidden="true">
                <path
                  d="M28.12 0L50 44.24L44 56L28.12 21L11.88 56L6 44.24L28.12 0Z"
                  fill="black"
                />
              </svg>
              <span>Metorial</span>
            </div>
            <main>
              ${d.body}
              <footer>
                Hosted by
                <a href="https://metorial.com" target="_blank" rel="noopener noreferrer"
                  >Metorial</a
                >
                ·
                <a
                  href="https://metorial.com/legal/terms-of-service"
                  target="_blank"
                  rel="noopener noreferrer"
                  >Terms</a
                >
                ·
                <a
                  href="https://metorial.com/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  >Privacy</a
                >
              </footer>
            </main>
          </div>
          ${d.interactive ? raw('<script>' + publicMcpInstallScript + '</script>') : ''}
        </body>
      </html>`,
    d.status,
    {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': `default-src 'none'; style-src 'sha256-${styleHash}'; script-src 'sha256-${scriptHash}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...(d.routingMiss ? { 'Metorial-Public-Mcp-Miss': '1' } : {})
    }
  );

export let renderPublicMcpInstallError = (
  c: Context,
  d: { title: string; description: string; status: 404 | 503; routingMiss?: boolean }
) =>
  renderDocument(c, {
    ...d,
    body: html`<h1>${d.title}</h1>
      <p class="description">${d.description}</p>`
  });

export let renderPublicMcpInstallPage = (
  c: Context,
  d: {
    name: string;
    description: string | null;
    providerName: string;
    slug: string;
    url: string;
  }
) => {
  let clients = getPublicMcpInstallInstructions(d);

  return renderDocument(c, {
    title: `Connect to ${d.name}`,
    status: 200,
    interactive: true,
    body: html`
      <header>
        <h1>Connect to ${d.name}</h1>
        <p class="description">${d.description || `Connect your AI client to ${d.name}.`}</p>
      </header>

      <div class="endpoint">
        <div class="endpoint-text">
          <p class="endpoint-label">Server URL</p>
          <code id="endpoint" title="${d.url}">${d.url}</code>
        </div>
        <button class="copy" type="button" data-copy="endpoint" aria-label="Copy server URL">
          Copy URL
        </button>
      </div>

      <section aria-labelledby="choose-client">
        <h2 id="choose-client">Choose Your Client</h2>
        <div class="clients" role="group" aria-label="MCP client">
          ${clients.map(
            client => html`
              <button
                class="client"
                type="button"
                data-client="${client.id}"
                aria-controls="setup-${client.id}"
                aria-pressed="${client.id === 'cursor' ? 'true' : 'false'}"
              >
                ${client.name}
              </button>
            `
          )}
        </div>
      </section>

      ${clients.map(
        client => html`
          <section
            id="setup-${client.id}"
            data-client-panel="${client.id}"
            aria-labelledby="heading-${client.id}"
          >
            <h2 id="heading-${client.id}" class="setup-title">Set Up ${client.name}</h2>
            <ol>
              ${client.steps.map(
                (step, index) => html`
                  <li class="step">
                    <span class="number" aria-hidden="true">${index + 1}</span>
                    <div>
                      <p class="step-heading">${step.title}</p>
                      <p class="step-description">${step.description}</p>
                      ${
                        step.code
                          ? html`
                              <div class="code-box">
                                <div class="code-top">
                                  <span>${step.code.label}</span>
                                  <button
                                    class="copy"
                                    type="button"
                                    data-copy="code"
                                    aria-label="Copy ${client.name} ${step.title} configuration"
                                  >
                                    Copy
                                  </button>
                                </div>
                                <pre><code>${step.code.value}</code></pre>
                              </div>
                            `
                          : ''
                      }
                    </div>
                  </li>
                `
              )}
            </ol>
            <p class="client-docs">
              <a href="${client.docsUrl}" target="_blank" rel="noopener noreferrer"
                >${client.name} Setup Guide ↗</a
              >
            </p>
          </section>
        `
      )}

      <div class="signin-note">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <rect x="5" y="10" width="14" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        <p>
          You’ll sign in to your own ${d.providerName} account when you connect. Your client
          will guide you through authorization.
        </p>
      </div>

      <div id="announcement" class="sr-only" role="status" aria-live="polite"></div>
    `
  });
};
