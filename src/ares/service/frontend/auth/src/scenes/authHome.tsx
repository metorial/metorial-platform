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
import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { styled } from 'styled-components';
import { GithubLogo } from '../components/github';
import { GoogleLogo } from '../components/google';
import { AuthLayout } from '../components/layout';
import {
  type AuthConnectionOption,
  type AuthConnectionSelection,
  authState
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

  let canAutoSubmit = form.values.email && email && !reason;
  let autoSubmittedRef = useRef(false);

  useEffect(() => {
    if (
      email &&
      canAutoSubmit &&
      !startAuthentication.isLoading &&
      !startAuthentication.isSuccess
    ) {
      if (autoSubmittedRef.current) return;
      autoSubmittedRef.current = true;

      form.setFieldValue('email', email);
      form.submitForm();
    }
  }, [canAutoSubmit, email, startAuthentication.isLoading, startAuthentication.isSuccess]);

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
    ((canAutoSubmit || sessionOrUserId) &&
      !connectionSelection &&
      !startAuthentication.error) ||
    auth.isLoading
  )
    return (
      <AuthLayout>
        {captcha}
        <CenteredSpinner />
      </AuthLayout>
    );

  let options = auth.data?.options ?? [];
  let hasEmailOption = options.some(o => o.type === 'email');
  let oauthOptions = options.filter(o => o.type === 'oauth');
  let ssoOptions = options.filter(o => o.type === 'sso');
  let hasOAuthOptions = oauthOptions.length > 0;
  let hasAlternativeOptions = hasOAuthOptions || ssoOptions.length > 0;

  let activeBoot = selectionAuth.data ?? auth.data;
  let bootClient = activeBoot?.client;
  let bootAccount = bootClient?.account;
  let selectionAccount = connectionSelection?.account;
  let account = selectionAccount ?? bootAccount;

  let startSso = (option: AuthConnectionOption) => {
    setLoadingSource(`sso_${option.connectionId}`);
    startAuthentication.mutate({
      type: 'sso',
      clientId: connectionSelection?.clientId ?? clientId,
      ssoTenantId: option.tenantId,
      ssoConnectionId: option.connectionId,
      email: connectionSelection?.email ?? email,
      redirectUrl: nextUrl
    });
  };

  let lines: React.ReactNode[] = [];

  if (connectionSelection) {
    lines.push(
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
                startAuthentication.isLoading && loadingSource == `sso_${option.connectionId}`
              }
              disabled={startAuthentication.isLoading}
            >
              {option.tenantName} — {option.connectionName}
            </Button>
          </Fragment>
        ))}
      </>
    );
  }

  if (!connectionSelection && hasEmailOption) {
    lines.push(
      <form onSubmit={form.handleSubmit}>
        <Input label="Email" {...form.getFieldProps('email')} />
        <form.RenderError field="email" />

        <Spacer height={10} />

        <Button
          fullWidth
          size="3"
          type="submit"
          loading={
            (startAuthentication.isLoading || form.isSubmitting) && loadingSource == 'email'
          }
          disabled={startAuthentication.isLoading || form.isSubmitting}
        >
          {account && !account.allowEmailLogin && ssoOptions.length === 0
            ? 'Log in as guest'
            : 'Continue'}
        </Button>
        <startAuthentication.RenderError />

        {type != 'switch' && (
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
    );
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

    lines.push(
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
    );
  }

  if (!connectionSelection && ssoOptions.length > 0) {
    lines.push(
      <>
        {ssoOptions.map((option, i) => {
          return (
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
          );
        })}
      </>
    );
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

      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <>
              <Spacer height={20} />
              <Or />
              <Spacer height={20} />
            </>
          )}

          {line}
        </Fragment>
      ))}
    </AuthLayout>
  );
};
