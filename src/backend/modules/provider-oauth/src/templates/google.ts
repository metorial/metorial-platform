import { providerOauthTemplateService } from '../services';

providerOauthTemplateService.ensureTemplate({
  slug: 'google',
  name: 'Google',
  providerName: 'Google',
  providerUrl: 'https://www.google.com',

  imageUrl: 'https://cdn.metorial.com/2025-06-13--14-59-55/logos/providers/google.svg',

  variables: [],

  configJsonata: JSON.stringify(
    {
      issuer: 'https://accounts.google.com',
      authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      device_authorization_endpoint: 'https://oauth2.googleapis.com/device/code',
      token_endpoint: 'https://oauth2.googleapis.com/token',
      userinfo_endpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
      revocation_endpoint: 'https://oauth2.googleapis.com/revoke',
      jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
      response_types_supported: [
        'code',
        'token',
        'id_token',
        'code token',
        'code id_token',
        'token id_token',
        'code token id_token',
        'none'
      ],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: ['openid', 'email', 'profile'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
      claims_supported: [
        'aud',
        'email',
        'email_verified',
        'exp',
        'family_name',
        'given_name',
        'iat',
        'iss',
        'name',
        'picture',
        'sub'
      ],
      code_challenge_methods_supported: ['plain', 'S256'],
      grant_types_supported: [
        'authorization_code',
        'refresh_token',
        'urn:ietf:params:oauth:grant-type:device_code',
        'urn:ietf:params:oauth:grant-type:jwt-bearer'
      ]
    },
    null,
    2
  ),

  scopes: [
    {
      identifier: 'https://www.googleapis.com/auth/userinfo.email',
      description: 'View your email address'
    },
    {
      identifier: 'https://www.googleapis.com/auth/userinfo.profile',
      description: 'View basic profile information'
    },
    {
      identifier: 'https://www.googleapis.com/auth/cloud-platform',
      description: 'See, edit, configure, and delete your Google Cloud data'
    },
    {
      identifier: 'https://www.googleapis.com/auth/cloud-platform.read-only',
      description: 'View your data across Google Cloud services'
    },
    {
      identifier: 'https://www.googleapis.com/auth/gmail.readonly',
      description: 'Read all Gmail resources and metadata (no write operations)'
    },
    {
      identifier: 'https://mail.google.com/',
      description: 'Full access to the Gmail mailbox, including permanent deletion'
    },
    {
      identifier: 'https://www.googleapis.com/auth/gmail.send',
      description: 'Send email messages only'
    },
    {
      identifier: 'https://www.googleapis.com/auth/gmail.compose',
      description: 'Create, read, update, send and delete drafts'
    },
    {
      identifier: 'https://www.googleapis.com/auth/gmail.modify',
      description: 'Read and modify Gmail messages (except immediate permanent deletion)'
    },
    {
      identifier: 'https://www.googleapis.com/auth/gmail.metadata',
      description: 'Read Gmail metadata (headers, labels) without message bodies'
    },
    {
      identifier: 'https://www.googleapis.com/auth/gmail.labels',
      description: 'Create, read, update and delete Gmail labels'
    },
    {
      identifier: 'https://www.googleapis.com/auth/calendar',
      description: 'See, edit, share, and permanently delete all calendars you can access'
    },
    {
      identifier: 'https://www.googleapis.com/auth/calendar.readonly',
      description: 'View any calendar you can access'
    },
    {
      identifier: 'https://www.googleapis.com/auth/calendar.freebusy',
      description: 'View your availability in your calendars'
    },
    {
      identifier: 'https://www.googleapis.com/auth/calendar.events',
      description: 'View and edit events on all your calendars'
    },
    {
      identifier: 'https://www.googleapis.com/auth/calendar.events.readonly',
      description: 'View events on all your calendars'
    },
    {
      identifier: 'https://www.googleapis.com/auth/calendar.settings.readonly',
      description: 'View your Calendar settings'
    },
    {
      identifier: 'https://www.googleapis.com/auth/calendar.addons.execute',
      description: 'Run as a Calendar add‑on'
    },
    {
      identifier: 'https://www.googleapis.com/auth/calendar.addons.current.event.read',
      description: 'See events you open in Google Calendar (add‑on context)'
    },
    {
      identifier: 'https://www.googleapis.com/auth/calendar.addons.current.event.write',
      description: 'Edit events you open in Google Calendar (add‑on context)'
    },
    {
      identifier: 'https://www.googleapis.com/auth/calendar.events.owned',
      description: 'Manage events on Google calendars you own'
    },
    {
      identifier: 'https://www.googleapis.com/auth/calendar.events.owned.readonly',
      description: 'View events on Google calendars you own'
    },
    {
      identifier: 'https://www.googleapis.com/auth/calendar.events.freebusy',
      description: 'See availability on calendars you have access to'
    },
    {
      identifier: 'https://www.googleapis.com/auth/calendar.app.created',
      description: 'Make secondary calendars, and manage events on them'
    },
    {
      identifier: 'https://www.googleapis.com/auth/calendar.calendarlist',
      description: "See, add, and remove calendars you're subscribed to"
    },
    {
      identifier: 'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
      description: 'View your subscribed calendar list'
    },
    {
      identifier: 'https://www.googleapis.com/auth/calendar.calendars',
      description:
        'See and change properties of calendars you have access to, and create secondary calendars'
    },
    {
      identifier: 'https://www.googleapis.com/auth/calendar.calendars.readonly',
      description: 'View properties (title, timezone, description) of accessible calendars'
    },
    {
      identifier: 'https://www.googleapis.com/auth/calendar.acls',
      description: 'See and change sharing permissions on calendars you own'
    },
    {
      identifier: 'https://www.googleapis.com/auth/calendar.acls.readonly',
      description: 'View sharing permissions of calendars you own'
    },
    {
      identifier: 'https://www.googleapis.com/auth/calendar.events.public.readonly',
      description: 'View events on public calendars'
    },
    {
      identifier: 'https://www.googleapis.com/auth/keep',
      description: 'See, edit, create and delete all your Google Keep data'
    },
    {
      identifier: 'https://www.googleapis.com/auth/keep.readonly',
      description: 'View all your Google Keep notes and lists'
    },
    {
      identifier: 'https://www.googleapis.com/auth/drive',
      description: 'Full access to all Google Drive files'
    },
    {
      identifier: 'https://www.googleapis.com/auth/drive.readonly',
      description: 'Read all files in Google Drive'
    },
    {
      identifier: 'https://www.googleapis.com/auth/drive.file',
      description: 'View and manage Drive files created or opened by the app'
    },
    {
      identifier: 'https://www.googleapis.com/auth/drive.metadata',
      description: 'Read, search, and modify file metadata in Drive'
    },
    {
      identifier: 'https://www.googleapis.com/auth/drive.metadata.readonly',
      description: 'Read and search file metadata'
    },
    {
      identifier: 'https://www.googleapis.com/auth/drive.appdata',
      description: "View and manage the app's hidden configuration data in Drive"
    },
    {
      identifier: 'https://www.googleapis.com/auth/drive.appfolder',
      description: 'Same as appdata—the app’s own folder in Drive'
    },
    {
      identifier: 'https://www.googleapis.com/auth/drive.install',
      description: "Allow the app to show up in Drive’s 'Open with' or 'New' menu"
    },
    {
      identifier: 'https://www.googleapis.com/auth/drive.labels',
      description: 'View and manage Drive labels'
    },
    {
      identifier: 'https://www.googleapis.com/auth/drive.labels.readonly',
      description: 'View and use Drive labels'
    },
    {
      identifier: 'https://www.googleapis.com/auth/drive.admin.labels',
      description: 'Admin-level access to manage labels organization-wide'
    },
    {
      identifier: 'https://www.googleapis.com/auth/drive.admin.labels.readonly',
      description: 'View all Drive labels and label administration policies'
    }
  ]
});
