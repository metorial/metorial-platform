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
  Title
} from '@metorial-io/ui';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GithubLogo } from '../components/github';
import { GoogleLogo } from '../components/google';
import { AuthLayout } from '../components/layout';
import { authState } from '../state/auth';

export let AuthHomeScene = ({
  clientId,
  sessionOrUserId,
  nextUrl,
  email,
  type,

  setAuthIntent
}: {
  clientId: string;
  email: string | undefined;
  type: 'login' | 'signup' | 'switch';
  nextUrl: string;
  sessionOrUserId: string | undefined;

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

      setAuthIntent?.({
        authIntentId: res.id,
        authIntentClientSecret: res.clientSecret
      });
    }
  });

  let canAutoSubmit = form.values.email && email; // && type == 'login';
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

        setAuthIntent?.({
          authIntentId: res.id,
          authIntentClientSecret: res.clientSecret
        });
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

  if (((canAutoSubmit || sessionOrUserId) && !startAuthentication.error) || auth.isLoading)
    return (
      <AuthLayout>
        {captcha}
        <CenteredSpinner />
      </AuthLayout>
    );

  let options = auth.data?.options ?? [];
  let hasEmailOption = options.some(o => o.type === 'email');
  let hasOAuthOptions = options.some(o => o.type.startsWith('oauth.'));
  let ssoOptions = options.filter(o => o.type.startsWith('sso.'));
  let hasAlternativeOptions = hasOAuthOptions || ssoOptions.length > 0;

  let lines: React.ReactNode[] = [];

  if (hasEmailOption) {
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
          Continue
        </Button>
        <startAuthentication.RenderError />

        {type != 'switch' && (
          <>
            <Spacer height={10} />

            <Text align="center" color="gray600" weight="medium" size="1">
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

  if (hasOAuthOptions) {
    let oauthProviders: {
      icon: React.ReactNode;
      type: string;
    }[] = [];

    if (options.some(o => o.type === 'oauth.google')) {
      oauthProviders.push({
        icon: <GoogleLogo />,
        type: 'google'
      });
    }

    if (options.some(o => o.type === 'oauth.github')) {
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
                  provider: providerType as any,
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

  if (ssoOptions.length > 0) {
    lines.push(
      <>
        {ssoOptions.map((option, i) => {
          let ssoTenantId = option.type.replace('sso.', '');
          let name = option.name ?? 'Single Sign-On';

          return (
            <Fragment key={option.type}>
              {i > 0 && <Spacer height={10} />}

              <Button
                onClick={() => {
                  setLoadingSource(option.type);
                  startAuthentication.mutate({
                    type: 'sso',
                    clientId,
                    ssoTenantId,
                    redirectUrl: nextUrl
                  });
                }}
                size="2"
                fullWidth
                variant="outline"
                loading={startAuthentication.isLoading && loadingSource == option.type}
                disabled={startAuthentication.isLoading}
              >
                SSO - {name}
              </Button>
            </Fragment>
          );
        })}
      </>
    );
  }

  return (
    <AuthLayout>
      {captcha}

      <Title as="h1" weight="bold" size="4">
        {
          {
            login: 'Log in',
            signup: 'Sign up',
            switch: 'Choose account'
          }[type]
        }
      </Title>

      <Spacer height={10} />

      <Text color="gray600" weight="medium" size="2">
        {
          {
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
        }
      </Text>

      <Spacer height={25} />

      {!!auth.data?.users.length && (
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
