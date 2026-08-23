import { useInterval } from '@looped/hooks';
import { delay } from '@lowerdeck/delay';
import { Turnstile } from '@marsidev/react-turnstile';
import { useForm, useMutation } from '@metorial-io/data-hooks';
import {
  Avatar,
  Button,
  CenteredSpinner,
  Entity,
  Error,
  Input,
  Or,
  Spacer,
  Text,
  theme
} from '@metorial-io/ui';
import { AnimatePresence, motion } from 'framer-motion';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { styled } from 'styled-components';
import { GithubLogo } from '../components/github';
import { GoogleLogo } from '../components/google';
import { AuthLayout } from '../components/layout';
import {
  type AuthConnectionOption,
  type AuthConnectionSelection,
  type AuthUserSelection,
  authState,
  useUserSelect
} from '../state/auth';

let Notice = styled.div`
  padding: 12px 14px;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 8px;
  background: ${theme.colors.gray200};
  color: ${theme.colors.gray800};
  font-size: 13px;
  line-height: 1.5;
`;

let AnimatedMethod = styled(motion.div)`
  width: 100%;
`;

let resemblesEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

let useDebouncedValue = <T,>(value: T, wait: number) => {
  let [debounced, setDebounced] = useState(value);

  useEffect(() => {
    let timeout = window.setTimeout(() => setDebounced(value), wait);
    return () => window.clearTimeout(timeout);
  }, [value, wait]);

  return debounced;
};

export let AuthHomeScene = ({
  clientId,
  sessionOrUserId,
  nextUrl,
  email,
  type,
  reason,

  setAuthIntent
}: {
  clientId: string;
  email: string | undefined;
  type: 'login' | 'signup' | 'switch';
  nextUrl: string;
  sessionOrUserId: string | undefined;
  reason?: string;

  setAuthIntent?: (d: { authIntentId: string; authIntentClientSecret: string }) => void;
}) => {
  let auth = authState.use({ clientId });
  let startAuthentication = useMutation(auth.mutators.start);
  let selectUserAuthentication = useUserSelect();

  let [captchaToken, setCaptchaToken] = useState<string>();
  let captchaTokenRef = useRef<string | undefined>(undefined);
  captchaTokenRef.current = captchaToken;

  let [captchaKey, setCaptchaKey] = useState(() => Date.now().toString());
  useInterval(() => setCaptchaKey(Date.now().toString()), 60 * 1000);

  let submitting = useRef(false);
  let [loadingSource, setLoadingSource] = useState<string>();
  let [connectionSelection, setConnectionSelection] = useState<AuthConnectionSelection | null>(
    null
  );
  let [userSelection, setUserSelection] = useState<AuthUserSelection | null>(null);
  let selectionAuth = authState.use(
    connectionSelection ? { clientId: connectionSelection.clientId } : null
  );
  let form = useForm({
    initialValues: {
      email: email ?? ''
    },
    schema: yup =>
      yup.object().shape({
        email: yup
          .string()
          .email('Make sure your email is valid')
          .required('Please enter your email')
      }),
    onSubmit: async values => {
      if (submitting.current || !nextUrl) return;
      submitting.current = true;

      setLoadingSource('email');

      let nextCaptchaToken = captchaTokenRef.current;
      if (auth.data?.captcha) {
        while (!nextCaptchaToken) {
          await delay(50);
          nextCaptchaToken = captchaTokenRef.current;
        }
      }

      let [res] = await startAuthentication.mutate({
        type: 'email',
        clientId,
        email: values.email,
        redirectUrl: nextUrl,
        captchaToken: nextCaptchaToken
      });

      submitting.current = false;

      if (!res) return;

      if (res.type == 'selection') {
        setConnectionSelection(res);
      } else {
        setAuthIntent?.({
          authIntentId: res.authIntent.id,
          authIntentClientSecret: res.authIntent.clientSecret
        });
      }
    }
  });

  let debouncedEmail = useDebouncedValue(form.values.email.trim(), 300);
  let userSelectionRequest = useRef(0);

  useEffect(() => {
    let request = ++userSelectionRequest.current;
    if (!resemblesEmail(debouncedEmail)) {
      setUserSelection(null);
      return;
    }

    selectUserAuthentication
      .mutate({ clientId, email: debouncedEmail })
      .then(([selection]) => {
        if (request === userSelectionRequest.current && selection) {
          setUserSelection(selection);
        }
      });
  }, [clientId, debouncedEmail]);

  let [sessionOrUserIdToLogInWith, setSessionOrUserIdToLogInWith] = useState<
    string | undefined
  >();

  useEffect(() => {
    if (sessionOrUserId) {
      setSessionOrUserIdToLogInWith(sessionOrUserId);
    }
  }, [sessionOrUserId]);

  let loggingInWithUserRef = useRef(false);
  useEffect(() => {
    if (!sessionOrUserIdToLogInWith || loggingInWithUserRef.current) return;
    loggingInWithUserRef.current = true;

    setLoadingSource(`session_${sessionOrUserIdToLogInWith}`);

    startAuthentication
      .mutate({
        type: 'session',
        clientId,
        userOrSessionId: sessionOrUserIdToLogInWith,
        redirectUrl: nextUrl
      })
      .then(([res]) => {
        if (!res) return;

        if (res.type == 'selection') {
          setConnectionSelection(res);
        } else {
          setAuthIntent?.({
            authIntentId: res.authIntent.id,
            authIntentClientSecret: res.authIntent.clientSecret
          });
        }
      });
  }, [sessionOrUserIdToLogInWith]);

  let captcha = (
    <>
      {auth.data?.captcha?.siteKey && (
        <Turnstile
          key={captchaKey}
          siteKey={auth.data.captcha.siteKey}
          options={{
            size: 'invisible'
          }}
          onError={() => {
            setCaptchaKey(Date.now().toString());
          }}
          onSuccess={async token => {
            setCaptchaToken(token);
          }}
        />
      )}
    </>
  );

  if (auth.error) {
    return (
      <AuthLayout>
        {captcha}
        <Error>{auth.error.data?.message ?? auth.error.message ?? 'An error occurred'}</Error>
      </AuthLayout>
    );
  }

  if (
    (sessionOrUserId && !connectionSelection && !startAuthentication.error) ||
    auth.isLoading
  )
    return (
      <AuthLayout>
        {captcha}
        <CenteredSpinner />
      </AuthLayout>
    );

  let normalizedEmail = form.values.email.trim().toLowerCase();
  let userSelectionMatchesEmail = userSelection?.email === normalizedEmail;
  let userSelectionSupportsSso =
    userSelection?.options.some(option => option.type === 'sso') ?? false;
  let activeUserSelection =
    userSelectionMatchesEmail ||
    (resemblesEmail(normalizedEmail) && userSelectionSupportsSso)
      ? userSelection
      : null;
  let options = activeUserSelection?.options ?? auth.data?.options ?? [];
  let hasEmailOption = options.some(o => o.type === 'email');
  let oauthOptions = options.filter(o => o.type === 'oauth');
  let ssoOptions = options.filter(o => o.type === 'sso');
  let hasOAuthOptions = oauthOptions.length > 0;
  let hasAlternativeOptions = hasOAuthOptions || ssoOptions.length > 0;

  let activeBoot = selectionAuth.data ?? auth.data;
  let bootClient = activeBoot?.client;
  let bootAccount = bootClient?.account;
  let selectionAccount = connectionSelection?.account;
  let account = selectionAccount ?? activeUserSelection?.account ?? bootAccount;

  let startSso = (option: AuthConnectionOption) => {
    setLoadingSource(`sso_${option.connectionId}`);
    startAuthentication.mutate({
      type: 'sso',
      clientId: connectionSelection?.clientId ?? activeUserSelection?.clientId ?? clientId,
      ssoTenantId: option.tenantId,
      ssoConnectionId: option.connectionId,
      email: connectionSelection?.email ?? form.values.email,
      redirectUrl: nextUrl
    });
  };

  let lines: { id: string; content: React.ReactNode }[] = [];

  if (connectionSelection) {
    lines.push({
      id: 'connection-selection',
      content: (
        <>
          {connectionSelection.options.map((option, i) => (
            <Fragment key={option.connectionId}>
              {i > 0 && <Spacer height={10} />}
              <Button
                onClick={() => startSso(option)}
                size="2"
                fullWidth
                variant="outline"
                loading={
                  startAuthentication.isLoading &&
                  loadingSource == `sso_${option.connectionId}`
                }
                disabled={startAuthentication.isLoading}
              >
                {option.tenantName} — {option.connectionName}
              </Button>
            </Fragment>
          ))}
        </>
      )
    });
  }

  let keepsEmailInput = auth.data?.options.some(option => option.type === 'email');
  if (!connectionSelection && keepsEmailInput) {
    lines.push({
      id: 'email',
      content: (
        <form id="auth-email-form" onSubmit={form.handleSubmit}>
          <Input label="Email" {...form.getFieldProps('email')} />
          <form.RenderError field="email" />
          <selectUserAuthentication.RenderError />

          {hasEmailOption && ssoOptions.length === 0 && (
            <>
              <Spacer height={10} />

              <Button
                fullWidth
                size="3"
                type="submit"
                variant={ssoOptions.length > 0 ? 'outline' : 'solid'}
                loading={
                  (startAuthentication.isLoading || form.isSubmitting) &&
                  loadingSource == 'email'
                }
                disabled={startAuthentication.isLoading || form.isSubmitting}
              >
                {ssoOptions.length > 0
                  ? 'Continue with email'
                  : account && !account.allowEmailLogin
                    ? 'Log in as guest'
                    : 'Continue'}
              </Button>
            </>
          )}
          <startAuthentication.RenderError />

          {type != 'switch' && ssoOptions.length === 0 && (
            <>
              <Spacer height={10} />

              <Text color="gray600" weight="medium" size="1">
                {type == 'login' ? (
                  <Link
                    to={`/signup?client_id=${encodeURIComponent(clientId)}&nextUrl=${encodeURIComponent(nextUrl)}`}
                    style={{ color: 'inherit' }}
                    aria-disabled={startAuthentication.isLoading || form.isSubmitting}
                  >
                    Don't have an account?{' '}
                    <span style={{ textDecoration: 'underline' }}>Create one</span>
                  </Link>
                ) : (
                  <Link
                    to={`/login?client_id=${encodeURIComponent(clientId)}&nextUrl=${encodeURIComponent(nextUrl)}`}
                    style={{ color: 'inherit' }}
                    aria-disabled={startAuthentication.isLoading || form.isSubmitting}
                  >
                    Already have an account?{' '}
                    <span style={{ textDecoration: 'underline' }}>Log in</span>.
                  </Link>
                )}
              </Text>
            </>
          )}
        </form>
      )
    });
  }

  if (!connectionSelection && hasOAuthOptions) {
    let oauthProviders: {
      icon: React.ReactNode;
      type: 'google' | 'github';
    }[] = [];

    if (oauthOptions.some(o => o.provider === 'google')) {
      oauthProviders.push({
        icon: <GoogleLogo />,
        type: 'google'
      });
    }

    if (oauthOptions.some(o => o.provider === 'github')) {
      oauthProviders.push({
        icon: <GithubLogo theme="light" />,
        type: 'github'
      });
    }

    lines.push({
      id: 'oauth',
      content: (
        <>
          {oauthProviders.map(({ icon, type: providerType }, i) => (
            <Fragment key={providerType}>
              {i > 0 && <Spacer height={10} />}

              <Button
                onClick={() => {
                  setLoadingSource(providerType);
                  startAuthentication.mutate({
                    type: 'oauth',
                    clientId,
                    provider: providerType,
                    redirectUrl: nextUrl
                  });
                }}
                size="2"
                fullWidth
                variant="outline"
                iconLeft={icon}
                loading={startAuthentication.isLoading && loadingSource == providerType}
                disabled={startAuthentication.isLoading}
              >
                {providerType[0].toUpperCase() + providerType.slice(1)}
              </Button>
            </Fragment>
          ))}
        </>
      )
    });
  }

  if (!connectionSelection && ssoOptions.length > 0) {
    let emailLineIndex = lines.findIndex(line => line.id === 'email');
    let ssoLine = {
      id: 'sso',
      content: (
        <>
          {ssoOptions.map((option, i) => {
            return (
              <Fragment key={option.connectionId}>
                {i > 0 && <Spacer height={10} />}

                <Button
                  onClick={() => startSso(option)}
                  size="3"
                  fullWidth
                  variant="solid"
                  loading={
                    startAuthentication.isLoading &&
                    loadingSource == `sso_${option.connectionId}`
                  }
                  disabled={startAuthentication.isLoading}
                >
                  Continue with {option.tenantName}
                  {ssoOptions.length > 1 ? ` — ${option.connectionName}` : ''}
                </Button>
              </Fragment>
            );
          })}
        </>
      )
    };
    lines.splice(emailLineIndex >= 0 ? emailLineIndex + 1 : 0, 0, ssoLine);
  }

  if (!connectionSelection && hasEmailOption && ssoOptions.length > 0) {
    let ssoLineIndex = lines.findIndex(line => line.id === 'sso');
    lines.splice(ssoLineIndex + 1, 0, {
      id: 'email-action',
      content: (
        <Button
          fullWidth
          size="3"
          type="submit"
          form="auth-email-form"
          variant="outline"
          loading={
            (startAuthentication.isLoading || form.isSubmitting) && loadingSource == 'email'
          }
          disabled={startAuthentication.isLoading || form.isSubmitting}
        >
          Continue with email
        </Button>
      )
    });
  }

  return (
    <AuthLayout
      main={{
        title: connectionSelection
          ? `Choose how to continue${account?.name ? ` to ${account.name}` : ''}`
          : account
            ? `Log in to ${account.name} on Metorial`
            : {
                login: 'Log in',
                signup: 'Sign up',
                switch: 'Choose account'
              }[type],
        description: connectionSelection
          ? `We found more than one sign-in connection for ${connectionSelection.email}.`
          : {
              login: hasEmailOption
                ? `Welcome back! Enter your email to continue.`
                : hasAlternativeOptions
                  ? `Welcome back! Choose a sign-in method to continue.`
                  : `Welcome back! No sign-in methods are currently available.`,
              signup: hasEmailOption
                ? `Nice to meet you! Enter your email to get started.`
                : hasAlternativeOptions
                  ? `Nice to meet you! Choose a sign-in method to get started.`
                  : `No sign-in methods are currently available for sign up.`,
              switch: `Choose the account you'd like to continue with.`
            }[type]
      }}
    >
      {captcha}

      {reason?.includes('social') && reason.includes('disabled') && (
        <>
          <Notice>
            Social login is disabled for this account. Choose one of the available sign-in
            methods below.
          </Notice>
          <Spacer height={20} />
        </>
      )}

      {reason == 'account_sso_required' && (
        <>
          <Notice>
            This email belongs to {account?.name ?? 'an account'} with its own sign-in policy.
            Choose an available account sign-in method below.
          </Notice>
          <Spacer height={20} />
        </>
      )}

      {!connectionSelection && !!auth.data?.users.length && (
        <>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}
          >
            {auth.data.users.map(({ user, ...session }) => (
              <div
                key={user.id}
                onClick={() => setSessionOrUserIdToLogInWith(session.id)}
                style={{ cursor: 'pointer' }}
              >
                <Entity.Wrapper style={{ background: 'white' }}>
                  <Entity.Content>
                    <Entity.Field
                      prefix={<Avatar entity={user} />}
                      title={
                        <>
                          {user.name}{' '}
                          {session.status == 'logged_out' && (
                            <span style={{ opacity: 0.5 }}>(Logged Out)</span>
                          )}
                        </>
                      }
                      value={user.email}
                    />

                    <Entity.Field title="Actions" right>
                      <Button
                        size="1"
                        onClick={() => setSessionOrUserIdToLogInWith(session.id)}
                        disabled={startAuthentication.isLoading}
                        loading={
                          startAuthentication.isLoading &&
                          loadingSource == `session_${session.id}`
                        }
                      >
                        {session.status == 'logged_out' ? 'Login' : 'Choose'}
                      </Button>
                    </Entity.Field>
                  </Entity.Content>
                </Entity.Wrapper>
              </div>
            ))}
          </div>

          <Spacer height={25} />
        </>
      )}

      <AnimatePresence initial={false} mode="popLayout">
        {lines.map((line, i) => (
          <AnimatedMethod
            layout
            key={line.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {i > 0 &&
              ((line.id === 'sso' && lines[i - 1]?.id === 'email') ||
              (line.id === 'email' && lines[i - 1]?.id === 'sso') ||
              (line.id === 'email-action' && lines[i - 1]?.id === 'sso') ? (
                <Spacer height={10} />
              ) : (
                <>
                  <Spacer height={20} />
                  <Or />
                  <Spacer height={20} />
                </>
              ))}

            {line.content}
          </AnimatedMethod>
        ))}
      </AnimatePresence>
    </AuthLayout>
  );
};
