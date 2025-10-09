import { getImageUrl, Profile, ProviderOAuthConnection } from '@metorial/db';
import { AuthForm } from '@metorial/module-provider-oauth';

export let formHtml = async (d: {
  form: AuthForm;
  profile: Profile;
  connection: ProviderOAuthConnection;
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

    .profile-image {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
      border: 1px solid #e5e5e5;
    }

    .profile-name {
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

    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #171717;
      margin-bottom: 6px;
    }

    .required {
      color: #737373;
    }

    input[type="text"],
    input[type="password"],
    select {
      width: 100%;
      padding: 10px 12px;
      font-size: 14px;
      border: 1px solid #d4d4d4;
      border-radius: 6px;
      background: white;
      color: #171717;
      font-family: inherit;
      transition: border-color 0.2s;
    }

    input[type="text"]:focus,
    input[type="password"]:focus,
    select:focus {
      outline: none;
      border-color: #525252;
    }

    input::placeholder {
      color: #a3a3a3;
    }

    select {
      cursor: pointer;
    }

    button[type="submit"] {
      width: 100%;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 500;
      color: white;
      background: #171717;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.2s;
    }

    button[type="submit"]:hover {
      background: #404040;
    }

    button[type="submit"]:active {
      background: #525252;
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

    .error-message {
      margin-top: 16px;
      color: #d92d20;
      font-size: 13px;
      display: none;
    }
  </style>
</head>

<body>
  <nav class="navbar">
    <div class="navbar-inner">
      <div class="navbar-left">
        <img src="${await getImageUrl(d.profile)}" alt="${d.profile.name}" class="profile-image" />
        <span class="profile-name">${d.profile.name}</span>
      </div>
      <div class="navbar-right">
        Secured by Metorial
      </div>
    </div>
  </nav>

  <div class="container">
    <div class="form-card">
      <h1>Connect to ${d.connection.name ?? d.connection.providerName}</h1>
      <p>Before we can securely connect your account, please provide the following information:</p>

      <form method="POST">
        ${d.form.fields
          .map(field => {
            if (field.type === 'select') {
              return `
              <div class="form-group">
                <label for="${field.key}">
                  ${field.label}
                  ${field.isRequired ? '<span class="required">*</span>' : ''}
                </label>
                <select 
                  id="${field.key}" 
                  name="${field.key}"
                  ${field.isRequired ? 'required' : ''}
                >
                  <option value="">Select an option</option>
                  ${field.options
                    .map(option => `<option value="${option.value}">${option.label}</option>`)
                    .join('')}
                </select>
              </div>
            `;
            } else {
              return `
              <div class="form-group">
                <label for="${field.key}">
                  ${field.label}
                  ${field.isRequired ? '<span class="required">*</span>' : ''}
                </label>
                <input 
                  type="${field.type}" 
                  id="${field.key}" 
                  name="${field.key}"
                  ${field.placeholder ? `placeholder="${field.placeholder}"` : ''}
                  ${field.isRequired ? 'required' : ''}
                />
              </div>
            `;
            }
          })
          .join('')}
        
        <button type="submit">Continue</button>

        <div class="error-message"></div>
      </form>
    </div>
  </div>

  <script>
    // Focus the first input field on load
    document.addEventListener('DOMContentLoaded', () => {
      const firstInput = document.querySelector('.form-card input, .form-card select');
      if (firstInput) {
        firstInput.focus();
      }

      let form = document.querySelector('form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        let submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';

        let formData = new FormData(form);
        let json = Object.fromEntries(formData.entries());

        fetch(form.action, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fieldValues: json })
        }).then(r => r.json()).then(d => {
          if (d.url) {
            window.location.replace(d.url);
          } else {
            let errorMessage = form.querySelector('.error-message');
            errorMessage.textContent = d.message || 'An unknown error occurred. Please try again.';
            errorMessage.style.display = 'block';
            submitButton.disabled = false;
            submitButton.textContent = 'Continue';
          }
        })  
      });
    });
  </script>
</body>

</html>`;
