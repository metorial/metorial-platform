export let publicMcpInstallStyles = `
:root {
  color-scheme: light;
  --gray100: #fafafa;
  --gray200: #f6f6f6;
  --gray300: #efefef;
  --gray350: #e6e6e6;
  --gray650: #777;
  --gray700: #555;
  --gray900: #222;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  color: var(--gray900);
  background: white;
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  -webkit-font-smoothing: antialiased;
}

.page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 32px;
  color: black;
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
}

main {
  width: min(520px, 100%);
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  color: black;
  font-size: 25px;
  line-height: 1.3;
  font-weight: 650;
  letter-spacing: -0.7px;
}

.description {
  margin-top: 8px;
  max-width: 450px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--gray700);
}

.endpoint {
  margin: 23px 0 25px;
  border: 1px solid var(--gray350);
  border-radius: 9px;
  padding: 13px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.endpoint-text {
  flex: 1;
  min-width: 0;
}

.endpoint-label {
  margin-bottom: 6px;
  color: var(--gray650);
  font-size: 11px;
  font-weight: 500;
}

.endpoint code {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

code,
pre {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}

button,
a {
  -webkit-tap-highlight-color: transparent;
}

button {
  font: inherit;
  cursor: pointer;
  color: inherit;
  background: white;
}

button:focus-visible,
a:focus-visible {
  outline: 2px solid var(--gray900);
  outline-offset: 4px;
}

.copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-shrink: 0;
  min-width: 60px;
  min-height: 30px;
  padding: 5px 8px;
  border: 1px solid var(--gray350);
  border-radius: 5px;
  font-size: 11px;
  font-weight: 500;
}

.copy:hover {
  background: var(--gray200);
}

h2 {
  margin-bottom: 11px;
  font-size: 13px;
  font-weight: 600;
}

.clients {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 26px;
}

.client {
  min-height: 39px;
  padding: 9px 7px;
  border: 1px solid var(--gray350);
  border-radius: 7px;
  font-size: 12px;
  font-weight: 500;
  transition:
    background 120ms,
    border-color 120ms;
}

.client:hover {
  background: var(--gray100);
}

.client[aria-pressed="true"] {
  background: var(--gray900);
  border-color: var(--gray900);
  color: white;
}

.setup-title {
  margin-bottom: 17px;
}

ol {
  list-style: none;
  padding: 0;
  margin: 0;
}

.step {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 12px;
  position: relative;
  padding-bottom: 21px;
}

.step:not(:last-child)::before {
  content: "";
  position: absolute;
  left: 11px;
  top: 29px;
  bottom: 5px;
  width: 1px;
  background: var(--gray350);
}

.step:last-child {
  padding-bottom: 0;
}

.number {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--gray350);
  border-radius: 50%;
  font-size: 11px;
  color: var(--gray700);
}

.step-heading {
  padding-top: 3px;
  font-size: 13px;
  font-weight: 500;
}

.step-description {
  margin-top: 5px;
  color: var(--gray700);
  font-size: 12px;
  line-height: 1.7;
}

.code-box {
  margin-top: 11px;
  border: 1px solid var(--gray350);
  border-radius: 7px;
  overflow: hidden;
  background: var(--gray100);
}

.code-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--gray350);
  color: var(--gray650);
  font-size: 10px;
}

.code-top .copy {
  min-height: 25px;
  border-color: transparent;
  background: transparent;
}

pre {
  margin: 0;
  padding: 14px;
  overflow-x: auto;
  font-size: 11px;
  line-height: 1.8;
  tab-size: 2;
}

.signin-note {
  display: flex;
  gap: 10px;
  margin-top: 24px;
  padding: 13px 14px;
  background: var(--gray200);
  border-radius: 7px;
  color: var(--gray700);
  font-size: 12px;
  line-height: 1.6;
}

.signin-note svg {
  flex-shrink: 0;
  margin-top: 2px;
}

.client-docs {
  margin-top: 18px;
  font-size: 12px;
  line-height: 1.6;
  text-align: right;
}

a {
  color: var(--gray700);
  text-underline-offset: 3px;
}

footer {
  margin-top: 30px;
  padding-top: 17px;
  border-top: 1px solid var(--gray300);
  color: var(--gray650);
  font-size: 11px;
  line-height: 1.7;
}

footer a {
  color: inherit;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

@media (max-width: 540px) {
  .page {
    padding: 32px 20px;
  }
  .brand {
    margin-bottom: 30px;
  }
  h1 {
    font-size: 23px;
  }
  .clients {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .endpoint {
    padding: 12px;
    gap: 7px;
  }
  .endpoint code {
    font-size: 11px;
  }
  .client-docs {
    margin-top: 18px;
    font-size: 12px;
    line-height: 1.6;
    text-align: right;
  }
}

[data-client-panel] {
  margin-bottom: 24px;
}

h1,
.description,
.step-description,
.code-top span {
  overflow-wrap: anywhere;
}
`;
