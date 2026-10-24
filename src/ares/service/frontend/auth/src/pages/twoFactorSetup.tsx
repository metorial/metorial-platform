import { useForm, useMutation } from '@metorial-io/data-hooks';
import {
  Button,
  CenteredSpinner,
  Error,
  Input,
  LinkButton,
  Spacer,
  Switch,
  Text,
  theme
} from '@metorial-io/ui';
import { useEffect, useRef, useState } from 'react';
import { styled } from 'styled-components';
import { CodeInput } from '../components/codeInput';
import { AuthLayout } from '../components/layout';
import { AccountHint, SetupPanel } from '../components/twoFactor';
import { twoFactorSetupState, type SetupCredentials } from '../state/twoFactor';

let Scan = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;

  img {
    width: 140px;
    height: 140px;
    border: 1px solid ${theme.colors.gray300};
    border-radius: 7px;
  }
  @media (max-width: 400px) {
    flex-direction: column;
  }
`;

let Codes = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  font-family: monospace;
  font-size: 12px;
  text-align: center;

  @media (max-width: 420px) {
    grid-template-columns: 1fr;
  }
`;

let Actions = styled.div`
  display: flex;
  gap: 10px;
`;

let readCredentials = (): SetupCredentials | null => {
  let hash = new URLSearchParams(window.location.hash.slice(1));
  let id = hash.get('setup_id') ?? new URLSearchParams(window.location.search).get('setup_id');
  if (!id) return null;
  let secret = hash.get('client_secret');
  if (secret) {
    sessionStorage.setItem(`two-factor:${id}`, secret);
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}?setup_id=${encodeURIComponent(id)}`
    );
  }
  secret ??= sessionStorage.getItem(`two-factor:${id}`);
  return secret ? { setupId: id, clientSecret: secret } : null;
};

export let TwoFactorSetup = () => {
  let [credentials] = useState(readCredentials);
  let [callbackFailed] = useState(() =>
    new URLSearchParams(window.location.search).has('setup_error')
  );
  let setup = twoFactorSetupState.use(credentials);
  let confirmTotp = useMutation(setup.mutators.confirmTotp, { disableToast: true });
  let register = useMutation(setup.mutators.register, { disableToast: true });
  let confirmPasskey = useMutation(setup.mutators.confirmPasskey, { disableToast: true });
  let recovery = useMutation(setup.mutators.recoveryCodes, { disableToast: true });
  let cancel = useMutation(setup.mutators.cancel);
  let [manual, setManual] = useState(false);
  let [saved, setSaved] = useState(false);
  let [finished, setFinished] = useState(false);
  let [code, setCode] = useState('');
  let [copied, setCopied] = useState(false);
  let recoveryRequested = useRef(false);
  let submitted = useRef('');
  let busy =
    confirmTotp.isLoading ||
    register.isLoading ||
    confirmPasskey.isLoading ||
    cancel.isLoading;
  let data = setup.data;
  let form = useForm({
    initialValues: { name: 'My Passkey' },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Enter a name for your passkey').max(100)
      }),
    onSubmit: async values => {
      if (register.data)
        await confirmPasskey.mutate({ name: values.name, response: register.data });
    }
  });

  useEffect(() => {
    if (data?.status === 'ready' && !callbackFailed) window.location.replace(data.callbackUrl);
    if (data?.status === 'completed' && !recoveryRequested.current) {
      recoveryRequested.current = true;
      void recovery.mutate();
    }
  }, [data?.status]);

  if (
    setup.error &&
    setup.error.data?.code !== 'two_factor_invalid' &&
    setup.error.data?.status !== 404
  ) {
    return (
      <AuthLayout
        main={{ title: 'Unable to load setup', description: 'Please try again in a moment.' }}
      >
        <Button fullWidth onClick={() => setup.refetch()}>
          Try Again
        </Button>
      </AuthLayout>
    );
  }

  if (!credentials || setup.error || data?.status === 'expired' || callbackFailed)
    return (
      <AuthLayout
        main={{
          title: 'Let’s start again',
          description:
            'This setup link has expired. Return to your account security settings to start a new setup.'
        }}
      >
        {data?.returnUrl && (
          <Button fullWidth onClick={() => window.location.replace(data.returnUrl)}>
            Back to Account Security
          </Button>
        )}
        {!data?.returnUrl && (
          <Text color="gray600" size="2">
            Close this page and return to your account dashboard.
          </Text>
        )}
      </AuthLayout>
    );

  if (!data || data.status === 'ready')
    return (
      <AuthLayout>
        <CenteredSpinner />
      </AuthLayout>
    );

  let back = () => {
    sessionStorage.removeItem(`two-factor:${credentials.setupId}`);
    window.location.replace(data.returnUrl);
  };

  if (data.status === 'completed') {
    if (!recoveryRequested.current || recovery.isLoading)
      return (
        <AuthLayout>
          <CenteredSpinner />
        </AuthLayout>
      );
    if (recovery.error)
      return (
        <AuthLayout
          main={{
            title: 'Unable to display recovery codes',
            description:
              'Your security settings were saved. You can generate a new set of recovery codes from your account security settings.'
          }}
        >
          <Button fullWidth onClick={back}>
            Back to Account Security
          </Button>
        </AuthLayout>
      );
    let codes = recovery.data?.codes ?? [];
    if (codes.length && !finished)
      return (
        <AuthLayout
          progress={2}
          main={{
            title: 'Save your recovery codes',
            description:
              'These codes let you sign in if you lose access to your authenticator or passkeys. Each code works once. Store these somewhere safe. You won’t be able to see them again.'
          }}
        >
          <SetupPanel>
            <Codes>
              {codes.map(value => (
                <span key={value}>{value}</span>
              ))}
            </Codes>
          </SetupPanel>
          <Spacer size={15} />
          <Actions>
            <Button
              variant="outline"
              success={copied}
              onClick={async () => {
                await navigator.clipboard.writeText(codes.join('\n'));
                setCopied(true);
              }}
            >
              Copy Codes
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                let url = URL.createObjectURL(
                  new Blob([`Metorial Recovery Codes\n\n${codes.join('\n')}`], {
                    type: 'text/plain'
                  })
                );
                let anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = 'metorial-recovery-codes.txt';
                anchor.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Download
            </Button>
          </Actions>
          <Spacer size={20} />
          <Switch
            checked={saved}
            onCheckedChange={setSaved}
            label="I’ve saved my recovery codes somewhere safe."
          />
          <Spacer size={20} />
          <Button fullWidth disabled={!saved} onClick={() => setFinished(true)}>
            Finish Setup
          </Button>
        </AuthLayout>
      );
    return (
      <AuthLayout
        progress={3}
        main={{
          title: 'Your account is more secure',
          description:
            'Two-factor authentication is now on. We’ll ask for a second step when you sign in with email or a password.'
        }}
      >
        <Button fullWidth onClick={back}>
          Back to Account Security
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      progress={1}
      main={{
        title: data.method === 'totp' ? 'Set up your authenticator' : 'Add a passkey',
        description:
          data.method === 'totp'
            ? 'Add another layer of security with a code from your authenticator app.'
            : 'Use your fingerprint, face, or a security key as your second sign-in step.'
      }}
    >
      <AccountHint
        action={
          data.method === 'totp'
            ? 'Setting up an authenticator for'
            : 'Setting up a passkey for'
        }
        email={data.email}
      />
      <Spacer size={25} />
      {data.method === 'totp' ? (
        <>
          <SetupPanel>
            <Scan>
              {data.qrCode && (
                <img
                  src={data.qrCode}
                  alt="Scan to add your Metorial account to your authenticator app"
                />
              )}
              <div>
                <Text size="2" weight="strong">
                  Scan this QR code
                </Text>
                <Spacer size={5} />
                <Text size="2" color="gray600">
                  <span>
                    Open 1Password, Google Authenticator, or another authenticator app and add
                    a new account.{' '}
                    {!manual && (
                      <LinkButton onClick={() => setManual(!manual)}>
                        Manually enter the setup key instead.
                      </LinkButton>
                    )}
                  </span>
                </Text>
              </div>
            </Scan>
          </SetupPanel>
          <Spacer size={12} />

          {manual && (
            <>
              <Spacer size={12} />
              <Input label="Setup Key" value={data.secret ?? ''} readOnly />
            </>
          )}
          <Spacer size={25} />
          <Text size="2">Enter the 6-digit code from your app</Text>
          <Spacer size={12} />
          <CodeInput
            value={code}
            onChange={next => {
              setCode(next);
              if (next.length < 6) submitted.current = '';
            }}
            onComplete={async value => {
              if (busy || submitted.current === value) return;
              submitted.current = value;
              await confirmTotp.mutate(value);
            }}
            disabled={busy}
            error={!!confirmTotp.error}
          />
          <Spacer size={12} />
          {confirmTotp.error && <Error>{confirmTotp.error.message}</Error>}
        </>
      ) : register.data ? (
        <form onSubmit={form.handleSubmit}>
          <Input
            label="Name Your Passkey"
            autoFocus
            disabled={busy}
            {...form.getFieldProps('name')}
          />
          <form.RenderError field="name" />
          <Spacer size={16} />
          {confirmPasskey.error && (
            <>
              <Error>{confirmPasskey.error.message}</Error>
              <Spacer size={12} />
            </>
          )}
          <Button
            fullWidth
            type="submit"
            loading={confirmPasskey.isLoading}
            success={confirmPasskey.isSuccess}
          >
            Continue
          </Button>
        </form>
      ) : (
        <>
          <SetupPanel>
            <div>
              <Text size="2" weight="strong">
                Use biometric authentication
              </Text>
              <Spacer size={5} />
              <Text size="2" color="gray600">
                Touch ID, Face ID, or Windows Hello.
              </Text>
            </div>

            <div>
              <Text size="2" weight="strong">
                Use a security key
              </Text>
              <Spacer size={5} />
              <Text size="2" color="gray600">
                Connect a USB or NFC security key.
              </Text>
            </div>
          </SetupPanel>
          <Spacer size={20} />
          <Button
            fullWidth
            loading={register.isLoading}
            success={register.isSuccess}
            disabled={cancel.isLoading}
            onClick={() => register.mutate()}
          >
            Create Passkey
          </Button>
          <Spacer size={12} />
          {register.error && (
            <>
              <Error>
                The prompt was dismissed or the passkey could not be created. Please try again.
              </Error>
              <Spacer size={10} />
            </>
          )}
        </>
      )}
    </AuthLayout>
  );
};
