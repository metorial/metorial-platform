export type OAuthProvider = 'google' | 'github';

export type OAuthCredentials = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export let socials = {
  google: {
    id: 'google' as const,
    name: 'Google',
    getAuthUrl(state: string, credentials: OAuthCredentials) {
      let url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.append('client_id', credentials.clientId);
      url.searchParams.append('redirect_uri', credentials.redirectUri);
      url.searchParams.append('response_type', 'code');
      url.searchParams.append('scope', 'openid email profile');
      url.searchParams.append('access_type', 'offline');
      url.searchParams.append('prompt', 'consent');
      url.searchParams.append('state', state);
      return url.toString();
    },
    async exchangeCodeForData(code: string, credentials: OAuthCredentials) {
      let tokenData = (await fetch('https://oauth2.googleapis.com/token', {
        body: new URLSearchParams({
          code,
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          redirect_uri: credentials.redirectUri,
          grant_type: 'authorization_code'
        }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        method: 'POST'
      }).then(res => res.json())) as { access_token: string; refresh_token: string };

      if (!tokenData.access_token) {
        throw new Error('No access token; ' + JSON.stringify(tokenData));
      }

      let accountData = (await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      }).then(res => res.json())) as {
        sub: string;
        email: string;
        email_verified: boolean;
        name: string;
        picture: string;
      };

      if (!accountData.email) throw new Error('No email');

      return {
        email: accountData.email,
        emailVerified: accountData.email_verified === true,
        name: accountData.name || 'Anonymous',
        id: accountData.sub + '@google.com',
        token: tokenData.refresh_token,
        photoUrl: accountData.picture
      };
    }
  },

  github: {
    id: 'github' as const,
    name: 'Github',
    getAuthUrl(state: string, credentials: OAuthCredentials) {
      let url = new URL('https://github.com/login/oauth/authorize');
      url.searchParams.append('client_id', credentials.clientId);
      url.searchParams.append('redirect_uri', credentials.redirectUri);
      url.searchParams.append('scope', 'user:email');
      url.searchParams.append('state', state);
      return url.toString();
    },
    async exchangeCodeForData(code: string, credentials: OAuthCredentials) {
      let tokenDataString = await fetch('https://github.com/login/oauth/access_token', {
        body: new URLSearchParams({
          code,
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          redirect_uri: credentials.redirectUri
        }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'Ares Auth Service'
        },
        method: 'POST'
      }).then(res => res.text());

      let tokenData = JSON.parse(tokenDataString) as { access_token: string };

      if (!tokenData.access_token) {
        throw new Error('No access token; ' + JSON.stringify(tokenData));
      }

      let accountDataString = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'User-Agent': 'Ares Auth Service'
        }
      }).then(res => res.text());

      let accountData = JSON.parse(accountDataString) as {
        id: string;
        email?: string;
        name: string;
        avatar_url: string;
        login: string;
      };

      let emailDataString = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Ares Auth Service'
        }
      }).then(res => res.text());

      let emailData = JSON.parse(emailDataString) as {
        email: string;
        primary: boolean;
        verified: boolean;
      }[];
      let selectedEmail = emailData.find(email => email.primary);

      if (!selectedEmail) throw new Error('No primary email');

      return {
        email: selectedEmail.email,
        emailVerified: selectedEmail.verified === true,
        name: accountData.name || accountData.login,
        id: accountData.id + '@github.com',
        token: tokenData.access_token,
        photoUrl: accountData.avatar_url
      };
    }
  }
};
