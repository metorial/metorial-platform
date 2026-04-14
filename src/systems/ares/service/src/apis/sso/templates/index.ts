let auth0Md = `# Auth0 SAML Setup

## Create application

From your Auth0 dashboard, click **Applications** from the left navigation menu.

If your application is already created, choose it from the list and move to [Configure Application](#configure-application).

![Auth0 SAML Step 1](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/auth0/1.png)

To create a new application, click the **Create Application** button.

Give your application a **Name** and click **Create**.

![Auth0 SAML Step 1.1](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/auth0/1_1.png)

## Configure application

Click the **Addons** tab and enable **SAML2 WEB APP** add-on.

![Auth0 SAML Step 2](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/auth0/2.png)

Enter the **Application Callback URL** \`{{REPLY_URL}}\` and click **Enable**.

![Auth0 SAML Step 3](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/auth0/3.png)

Click the **Usage** tab and download the **Identity Provider Metadata**.

![Auth0 SAML Step 4](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/auth0/4.png)

## Attribute mapping

No additional attribute mapping is required for Auth0 SAML.

## Next steps

You've successfully configured your SAML application. You can now assign users to your application and start using it.`;

let entraMd = `# Microsoft Entra ID SAML Setup

## Create application

From your Azure Admin console, click **Enterprise applications** from the left navigation menu.

![Microsoft Entra ID SAML Step 1](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/azure/1.png)

If your application is already created, choose it from the list and move to [Configure Application](#configure-application).

To create a new application, click **New application** from the top.

![Microsoft Entra ID SAML Step 2](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/azure/2.png)

Click **Create your own application**. Give your application a **Name** and click **Create**.

![Microsoft Entra ID SAML Step 3](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/azure/3.png)

## Configure application

Select **Single Sign On** from the **Manage** section of your app and then **SAML**.

![Microsoft Entra ID SAML Step 4](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/azure/4.png)

Click **Edit** on the **Basic SAML Configuration** section.

![Microsoft Entra ID SAML Step 5](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/azure/5.png)

Enter the following values in the **Basic SAML Configuration** section:

- **Identifier (Entity ID)**: \`{{ENTITY_ID}}\`
- **Reply URL (Assertion Consumer Service URL)**: \`{{REPLY_URL}}\`

Click **Save** to save your changes.

![Microsoft Entra ID SAML Step 6](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/azure/6.png)

## Attribute mapping

Click **Edit** on the **Attributes & Claims** section.

![Microsoft Entra ID SAML Step 7](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/azure/7.png)

Configure the following attributes under the **Attributes & Claims** section:

| Name                                                                 | Value                  |
| -------------------------------------------------------------------- | ---------------------- |
| \`http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress\` | user.mail              |
| \`http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname\`    | user.givenname         |
| \`http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name\`         | user.userprincipalname |
| \`http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname\`      | user.surname           |

![Microsoft Entra ID SAML Step 8](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/azure/8.png)

Go to the **SAML Signing Certificate** section and download the **Federation Metadata XML**.

![Microsoft Entra ID SAML Step 9](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/azure/9.png)

## Next steps

You've successfully configured your SAML application. You can now assign users to your application and start using it.`;

let genericOidcMd = `# OpenID Connect Provider Setup

To allow authentication using an OIDC Identity Provider, you must register an application with the IdP. The process might slightly vary from one IdP to another (refer to your IdP documentation).

## Required configuration

- **Redirect URI**: \`{{REDIRECT_URI}}\`
- **Client ID**: After registering your application, the OIDC Identity Provider will generate a unique Client ID. Copy this value.
- **Client Secret**: The IdP will also generate a Client Secret to authenticate the client. Copy this value as well.
`;

let genericSamlMd = `# Generic SAML 2.0 Provider Setup

## Configuration values

When setting up SAML with your Identity Provider, use the following values:

- **Assertion consumer service URL / Single Sign-On URL / Destination URL**: \`{{REPLY_URL}}\`
- **Entity ID / Identifier / Audience URI / Audience Restriction**: \`{{ENTITY_ID}}\`
- **Response**: \`Signed\`
- **Assertion Signature**: \`Signed\`
- **Signature Algorithm**: \`RSA-SHA256\`
- **Assertion Encryption**: \`Unencrypted\`

**Important**: Do not add a trailing slash at the end of the URLs.

## SAML attribute mapping

Configure your Identity Provider to map the following SAML attributes:

| SAML Attribute                                                         | Metorial mapping |
| ---------------------------------------------------------------------- | ---------------- |
| \`http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier\` | id               |
| \`http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress\`   | email            |
| \`http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname\`      | firstName        |
| \`http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname\`        | lastName         |

Refer to your Identity Provider's documentation for the exact attribute mapping process.
`;

let googleMd = `# Google SAML Setup

## Create application

From your Google Admin console, click **Apps** from the sidebar then click **Web and mobile apps** from the list.

If your application is already created, choose it from the list and move to [Configure Application](#configure-application).

To create a new application, click **Add custom SAML app** from the menu.

![Google SAML Step 1](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/google/1.png)

Give your application an **App name** and click **Continue**.

![Google SAML Step 2](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/google/2.png)

## Configure application

Click **DOWNLOAD METADATA** to download the metadata XML file, then click **Continue**.

![Google SAML Step 3](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/google/3.png)

Enter the following values in the **Service provider details** section:

- **ACS URL**: \`{{REPLY_URL}}\`
- **Entity ID**: \`{{ENTITY_ID}}\`

Click **Continue** to save the configuration.

![Google SAML Step 4](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/google/4.png)

## Attribute mapping

Under the **Attributes** section, configure the following attributes:

| App attributes | Google directory attributes |
| -------------- | --------------------------- |
| email          | Primary email               |
| firstName      | First name                  |
| lastName       | Last name                   |

Click **Finish** to save the configuration.

![Google SAML Step 5](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/google/5.png)

Click **User access** to configure the application to allow users to log in.

![Google SAML Step 6](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/google/6.png)

Check the **ON for everyone** checkbox and click **Save**.

![Google SAML Step 7](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/google/7.png)

## Next steps

You've successfully configured your SAML application. You can now assign users to your application and start using it.
`;

let jumpcloudMd = `# JumpCloud SAML Setup

## Create application

From your JumpCloud Admin console, click **SSO** from the left navigation menu.

If your application is already created, choose it from the list and move to [Configure Application](#configure-application).

To create a new application, click the plus icon and then **Custom SAML App**.

![JumpCloud SAML Step 1](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/jumpcloud/1.png)

Give your application a **Display Label**.

![JumpCloud SAML Step 2](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/jumpcloud/2.png)

## Configure application

Click on the **SSO** tab and enter the following values:

- **IdP Entity ID**: Use the suggested value
- **SP Entity ID**: \`{{ENTITY_ID}}\`
- **ACS URL**: \`{{REPLY_URL}}\`

![JumpCloud SAML Step 3](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/jumpcloud/3.png)

## Attribute mapping

Under the **Attributes** section, configure the following attributes:

| Service Provider Attribute Name | JumpCloud Attribute Name |
| ------------------------------- | ------------------------ |
| email                           | email                    |
| firstName                       | firstname                |
| lastName                        | lastname                 |

Make sure you have checked the **Declare Redirect Endpoint** checkbox.

Click **Activate** to save the application configuration.

![JumpCloud SAML Step 4](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/jumpcloud/4.png)

Go back to the SAML app you just created, click the **SSO** tab, and click the **Export Metadata** button to download the metadata XML file.

![JumpCloud SAML Step 5](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/jumpcloud/5.png)

## Next steps

You've successfully configured your SAML application. You can now assign users to your application and start using it.
`;

let adfsMd = `# Microsoft AD FS SAML Setup

## Create a claims aware Relying Party Trust

1. In Server Manager, click Tools, and then select AD FS Management.
2. Under Actions, click Add Relying Party Trust. ![Microsoft AD FS SAML Step 2](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/adfs/addtrust2.png)
3. On the Welcome page, choose Claims aware and click Start.
   ![Microsoft AD FS SAML Step 3](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/adfs/addtrust3.png)
4. On the Select Data Source page, click Import data about the relying party published online or on a local network. In Federation metadata address (host name or URL), type your federation metadata URL, and then click Next.
   ![Microsoft AD FS SAML Step 4](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/adfs/addtrust4.png)
5. On the Specify Display Name page type a name in Display name, under Notes type a description for this relying party trust, and then click Next.
6. On the Choose Issuance Authorization Rules page, select either Permit all users to access this relying party or Deny all users access to this relying party, and then click Next.
7. On the Ready to Add Trust page, review the settings, and then click Next to save your relying party trust information.
8. On the Finish page, click Close. This action automatically displays the Edit Claim Rules dialog box.

## Attribute mapping

On the Configure Claim Rule screen, enter a Claim Rule Name of your choice, select Active Directory as the Attribute Store, then add the following mapping:

- From the LDAP Attribute column, select \`E-Mail-Addresses\`. From the Outgoing Claim Type, type \`E-Mail Address\`.
- From the LDAP Attribute column, select \`Given-Name\`. From the Outgoing Claim Type, type \`Given Name\`.
- From the LDAP Attribute column, select \`Surname\`. From the Outgoing Claim Type, type \`Surname\`.
- From the LDAP Attribute column, select \`User-Principal-Name\`. From the Outgoing Claim Type, type \`Name ID\`.

## Transform Rule

Create a transform rule mapping the incoming \`Email-Address\` to outgoing \`NameID\` (of type \`Email\`). ADFS by default sends \`NameID\` as \`Unspecified\` which results in an \`InvalidNameIDPolicy\` error if this step is missed.

![Transform rule](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/adfs/nameid-email.png)

Alternatively, use the following Claim rule language:

\`\`\`sh
c:[Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] => issue(Type = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier", Issuer = c.Issuer, OriginalIssuer = c.OriginalIssuer, Value = c.Value, ValueType = c.ValueType, Properties["http://schemas.xmlsoap.org/ws/2005/05/identity/claimproperties/format"] = "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress");
\`\`\`

## Final configuration

Open Windows PowerShell as an administrator, then run the following command:

\`\`\`sh
Set-ADFSRelyingPartyTrust -TargetName <display-name> -SamlResponseSignature "MessageAndAssertion"
\`\`\`
`;

let oktaMd = `# Okta SAML Setup

## Create application

From your Okta account, click **Applications** from the left navigation menu.

If your application is already created, choose it from the list and move to [Configure Application](#configure-application).

To create a new application, click the **Create App Integration** button.

![Okta SAML Step 1](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/okta/1.png)

Choose **SAML 2.0** and click **Next**.

![Okta SAML Step 2](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/okta/2.png)

Give your application an **App Name** and click **Next**.

![Okta SAML Step 3](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/okta/3.png)

## Configure application

Enter the following values in the **SAML Settings** section:

- **Single sign on URL**: \`{{REPLY_URL}}\`
- **Audience URI (SP Entity ID)**: \`{{ENTITY_ID}}\`
- **Name ID format**: Select **EmailAddress** from the dropdown

![Okta SAML Step 4](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/okta/4.png)

## Attribute mapping

Under the **Attribute Statements** section, configure the following attributes:

| Name      | Value          |
| --------- | -------------- |
| id        | user.id        |
| email     | user.email     |
| firstName | user.firstName |
| lastName  | user.lastName  |

![Okta SAML Step 5](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/okta/5.png)

On the next screen select **I'm an Okta customer adding an internal app** and click **Finish**.

![Okta SAML Step 6](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/okta/6.png)

Click the **Sign On** tab and go to the **SAML Signing Certificates** section.

Click the **Actions** dropdown for the active certificate and click **View IdP metadata**. A separate window will open with the metadata XML file, which you can copy.

![Okta SAML Step 7](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/okta/7.png)

## Next steps

You've successfully configured your SAML application. You can now assign users to your application and start using it.
`;

let oneloginMd = `# OneLogin SAML Setup

## Create application

From your OneLogin account, click **Applications** from the top navigation menu.

If your application is already created, choose it from the list and move to [Configure Application](#configure-application).

To create a new application, click the **Add App** button.

![OneLogin SAML Step 1](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/onelogin/1.png)

Search for **SAML Test Connector** in the **Find Applications** section. Select **SAML Custom Connector (Advanced)** from the search results.

![OneLogin SAML Step 2](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/onelogin/2.png)

Give your application a **Display Name** and click **Save**.

![OneLogin SAML Step 3](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/onelogin/3.png)

## Configure application

Click the **Configuration** tab on the left.

Enter the following values in the **Application details** section:

- **Audience (Entity ID)**: \`{{ENTITY_ID}}\`
- **ACS (Consumer) URL Validator**: \`{{REPLY_URL}}\`
- **ACS (Consumer) URL**: \`{{REPLY_URL}}\`
- **SAML initiator**: Select **Service Provider** from the dropdown

Click **Save** to save the configuration.

![OneLogin SAML Step 4](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/onelogin/4.png)

![OneLogin SAML Step 4.1](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/onelogin/4_1.png)

Click the **More Actions** dropdown menu from the top right corner and click **SAML Metadata** to download the metadata XML file.

![OneLogin SAML Step 5](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/onelogin/5.png)

## Attribute mapping

Click the **Parameters** tab on the left.

Configure the following attributes:

| SAML Custom Connector Field | Value      |
| --------------------------- | ---------- |
| id                          | UUID       |
| email                       | Email      |
| firstName                   | First Name |
| lastName                    | Last Name  |

![OneLogin SAML Step 6](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/onelogin/6.png)

To map the **id** attribute to **UUID**:

Enter **id** in the **Field name** input and check the **Include in SAML assertion** checkbox. Click **Save** to continue.

![OneLogin SAML Step 7](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/onelogin/7.png)

Select **UUID** from the **Value** dropdown and click **Save**.

![OneLogin SAML Step 8](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/onelogin/8.png)

Repeat the same process for the other attributes (email, firstName, lastName).

## Next steps

You've successfully configured your SAML application. You can now assign users to your application and start using it.
`;

let pingoneMd = `# PingOne SAML Setup

## Create application

From your PingOne account, click **Connections** > **Applications** from the left navigation menu.

If your application is already created, choose it from the list and move to [Configure Application](#configure-application).

To create a new application, click the plus button.

![PingOne SAML Step 1](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/pingone/1.png)

Give your application an **Application Name**, choose **SAML Application** from the **Application Type** and click **Configure**.

## Configure application

![PingOne SAML Step 2](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/pingone/2.png)

Enter the following values in the **SAML Configuration** section:

- **ACS URLs**: \`{{REPLY_URL}}\`
- **Entity ID**: \`{{ENTITY_ID}}\`

Click **Save** to save the configuration.

![PingOne SAML Step 3](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/pingone/3.png)

Click the **Configuration** tab from the top and click **Download Metadata** to download the metadata XML file.

![PingOne SAML Step 4](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/pingone/4.png)

## Attribute mapping

Click the **Attribute Mappings** tab from the top and configure the following attributes:

| SAML App  | PingOne       |
| --------- | ------------- |
| id        | User ID       |
| email     | Email Address |
| firstName | Given Name    |
| lastName  | Family Name   |

![PingOne SAML Step 5](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/pingone/5.png)

Enable your app by clicking the **Toggle** button next to your app so it can be used by users.

![PingOne SAML Step 6](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/pingone/6.png)

## Next steps

You've successfully configured your SAML application. You can now assign users to your application and start using it.
`;

let ripplingMd = `# Rippling SAML Setup

## Create application

Go to **IT Management** > **Custom App** from the left navigation menu.

![Rippling SAML Step 1](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/rippling/1.png)

Click **Create New App** button.

Fill in the following fields:

- **App Name**
- **Select Categories**
- **Upload Logo**
- **What type of app would you like to create?** - Select **Single Sign-On (SAML)**

![Rippling SAML Step 2](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/rippling/2.png)

## Configure application

Copy the **IdP Metadata URL** or **IdP Metadata XML** from the next screen.

![Rippling SAML Step 3](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/rippling/3.png)

Enter the following values:

- **ACS URL**: \`{{REPLY_URL}}\`
- **Entity ID**: \`{{ENTITY_ID}}\`

![Rippling SAML Step 4](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/rippling/4.png)

From the **Settings** tab of your custom app, go to **Advanced SAML Settings** section and check the box for **Disable InResponseTo field in assertions for IdP initiated SSO**.

This prevents validation issues with the **InResponseTo** field.

![Rippling SAML Step 5](https://raw.githubusercontent.com/ory/docs/refs/heads/master/docs/polis/_assets/sso-providers/rippling/5.png)

## Next steps

You've successfully configured your SAML application. You can now assign users to your application and start using it.`;

export let templates = [
  { id: 'auth0', name: 'Auth0', md: auth0Md, type: 'saml' as const },
  { id: 'entra', name: 'Microsoft Entra ID', md: entraMd, type: 'saml' as const },
  {
    id: 'generic-oidc',
    name: 'Generic OIDC Provider',
    md: genericOidcMd,
    type: 'oidc' as const
  },
  {
    id: 'generic-saml',
    name: 'Generic SAML Provider',
    md: genericSamlMd,
    type: 'saml' as const
  },
  { id: 'google', name: 'Google Workspace', md: googleMd, type: 'saml' as const },
  { id: 'jumpcloud', name: 'JumpCloud', md: jumpcloudMd, type: 'saml' as const },
  { id: 'adfs', name: 'Microsoft AD FS', md: adfsMd, type: 'saml' as const },
  { id: 'okta', name: 'Okta', md: oktaMd, type: 'saml' as const },
  { id: 'onelogin', name: 'OneLogin', md: oneloginMd, type: 'saml' as const },
  { id: 'pingone', name: 'PingOne', md: pingoneMd, type: 'saml' as const },
  { id: 'rippling', name: 'Rippling', md: ripplingMd, type: 'saml' as const }
];
