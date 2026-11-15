import {
  Button,
  CenteredSpinner,
  Error,
  Input,
  LinkButton,
  Spacer,
  Text
} from '@metorial-io/ui';
import { useEffect, useRef, useState } from 'react';
import { CodeInput } from '../components/codeInput';
import { AuthLayout } from '../components/layout';
import {
  MethodButton,
  MethodIcon,
  MethodList,
  PasskeyAnimation
} from '../components/twoFactor';
import {
  twoFactorChallengeState,
  useTwoFactorChallengeCode,
  useTwoFactorChallengePasskey
} from '../state/twoFactor';

export let TwoFactorChallenge = (p: {
  authIntentId: string;
  clientSecret: string;
  stepId: string;
  email: string;
  onVerified: () => void;
}) => {
  let credentials = {
    authIntentId: p.authIntentId,
    clientSecret: p.clientSecret,
    stepId: p.stepId
  };
  let challenge = twoFactorChallengeState.use(credentials);
  let code = useTwoFactorChallengeCode(credentials);
  let passkey = useTwoFactorChallengePasskey(credentials);
  let [method, setMethod] = useState<'totp' | 'passkey' | 'recovery_code' | null>(null);
  let [value, setValue] = useState('');
  let submitted = useRef('');
  let initialMethodSelected = useRef(false);
  let passkeyStarted = useRef(false);

  let busy = code.isLoading || passkey.isLoading;
  let verified = !!code.data || !!passkey.data;

  useEffect(() => {
    if (
      initialMethodSelected.current ||
      challenge.isLoading ||
      !challenge.data ||
      challenge.error
    )
      return;

    initialMethodSelected.current = true;
    if (challenge.data.passkey && !challenge.data.totp) setMethod('passkey');
    else if (challenge.data.totp && !challenge.data.passkey) setMethod('totp');
  }, [challenge.data, challenge.isLoading, challenge.error]);

  useEffect(() => {
    if (method !== 'passkey') {
      passkeyStarted.current = false;
      return;
    }
    if (passkeyStarted.current || busy || verified) return;

    passkeyStarted.current = true;
    void passkey.mutate();
  }, [method, busy, verified, passkey.mutate]);

  useEffect(() => {
    if (!verified) return;
    let timer = window.setTimeout(p.onVerified, passkey.data ? 700 : 0);
    return () => window.clearTimeout(timer);
  }, [verified, passkey.data, p.onVerified]);

  let submit = async (token: string) => {
    if (busy || verified || submitted.current === token || !method || method === 'passkey')
      return;
    submitted.current = token;
    await code.mutate({ type: method, code: token });
  };

  let choose = (next: typeof method) => {
    setValue('');
    submitted.current = '';
    setMethod(next);
  };

  let restart = () => {
    let url = new URL('/login', window.location.origin);
    let params = new URLSearchParams(window.location.search);
    for (let key of ['client_id', 'redirect_url', 'redirect_uri', 'next_url', 'nextUrl']) {
      let value = params.get(key);
      if (value) url.searchParams.set(key, value);
    }
    window.location.assign(url.toString());
  };

  let title = !method
    ? 'Verify it’s you'
    : method === 'totp'
      ? 'Enter your authenticator code'
      : method === 'passkey'
        ? 'Sign in with your passkey'
        : 'Use a recovery code';
  let description = !method
    ? 'Choose how you’d like to complete your sign-in.'
    : method === 'totp'
      ? 'Open your authenticator app and enter the 6-digit code for your Metorial account.'
      : method === 'passkey'
        ? 'Use your fingerprint, face, or security key to verify it’s you.'
        : 'Enter one of the recovery codes you saved when you set up two-factor authentication.';

  return (
    <AuthLayout main={{ title, description }}>
      {challenge.isLoading ? (
        <CenteredSpinner />
      ) : challenge.error ? (
        <Error>{challenge.error.message}</Error>
      ) : (
        <>
          {!method && (
            <>
              <MethodList>
                {challenge.data?.passkey && (
                  <MethodButton onClick={() => choose('passkey')}>
                    <MethodIcon type="passkey" />
                    <div>
                      <Text weight="strong" size="2">
                        Use a Passkey
                      </Text>
                      <Text color="gray600" size="1">
                        Your face, fingerprint, or security key
                      </Text>
                    </div>
                  </MethodButton>
                )}
                {challenge.data?.totp && (
                  <MethodButton onClick={() => choose('totp')}>
                    <MethodIcon type="totp" />
                    <div>
                      <Text weight="strong" size="2">
                        Authenticator App
                      </Text>
                      <Text color="gray600" size="1">
                        A 6-digit code from your authenticator
                      </Text>
                    </div>
                  </MethodButton>
                )}
              </MethodList>
              <Spacer size={20} />
            </>
          )}

          {method === 'totp' && (
            <CodeInput
              value={value}
              onChange={next => {
                setValue(next);
                if (next.length < 6) submitted.current = '';
              }}
              onComplete={submit}
              disabled={busy || verified}
              autoFocus
              error={!!code.error}
            />
          )}

          {method === 'recovery_code' && (
            <Input
              label="Recovery Code"
              value={value}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              disabled={busy || verified}
              onChange={event => {
                let next = event.target.value.toUpperCase();
                setValue(next);
                if (next.replace(/[-\s]/g, '').length === 20) void submit(next);
                else submitted.current = '';
              }}
            />
          )}

          {method === 'passkey' && (
            <>
              <PasskeyAnimation
                state={passkey.data ? 'verified' : passkey.isLoading ? 'working' : 'idle'}
              />
              <Spacer size={20} />
              <Button
                fullWidth
                loading={passkey.isLoading}
                success={!!passkey.data}
                disabled={busy || verified}
                onClick={() => passkey.mutate()}
              >
                {passkey.error ? 'Restart Passkey Authentication' : 'Use Passkey'}
              </Button>
            </>
          )}

          {method && (
            <>
              {method === 'passkey' && (
                <>
                  <Spacer size={15} />
                  <Text size="1" color="gray600">
                    Follow the prompt from your browser to continue.
                  </Text>
                </>
              )}

              {((method === 'passkey' && passkey.error) ||
                (method !== 'passkey' && code.error)) && (
                <>
                  <Spacer size={10} />
                  <Error>
                    {method === 'passkey'
                      ? 'Unable to use that passkey. Try again or use a recovery code.'
                      : code.error?.message}
                  </Error>
                </>
              )}
            </>
          )}
          <Spacer size={25} />
          <Text size="1" color="gray600">
            {method !== 'recovery_code' && (
              <>
                Use a{' '}
                <LinkButton
                  disabled={busy || verified}
                  onClick={() => choose('recovery_code')}
                >
                  Recovery Code
                </LinkButton>{' '}
                or go{' '}
              </>
            )}
            <LinkButton disabled={busy || verified} onClick={restart}>
              {method === 'recovery_code' ? 'Go back to Sign In' : 'back to Sign In'}
            </LinkButton>
          </Text>
        </>
      )}
    </AuthLayout>
  );
};
