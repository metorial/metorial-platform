import { useInterval } from '@looped/hooks';
import { Turnstile } from '@marsidev/react-turnstile';
import { useForm, useMutation } from '@metorial-io/data-hooks';
import {
  Button,
  CenteredSpinner,
  Error,
  Input,
  LinkButton,
  Spacer,
  Switch
} from '@metorial-io/ui';
import { differenceInMinutes } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { styled } from 'styled-components';
import { CodeInput } from '../components/codeInput';
import { AuthLayout } from '../components/layout';
import { useNonNullable } from '../hooks/useNonNullable';
import { authIntentState } from '../state/authIntent';
import type { IAuthIntent } from '../state/client';

let FullSpinner = styled.div`
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
`;

let CreateUserStep = ({
  authIntent,
  createUser,
  createUserLoading,
  createUserError
}: {
  authIntent: IAuthIntent;
  createUser: (d: {
    termsAccepted: boolean;
    firstName: string;
    lastName: string;
    timezone: string;
  }) => void;
  createUserLoading: boolean;
  createUserError?: string;
}) => {
  let [termsAccepted, setTermsAccepted] = useState(false);

  let form = useForm({
    schema: yup =>
      yup.object({
        firstName: yup.string().required('Please enter your first name'),
        lastName: yup.string().required('Please enter your last name')
      }),
    initialValues: {
      firstName: authIntent.userCreationPrefill?.firstName ?? '',
      lastName: authIntent.userCreationPrefill?.lastName ?? ''
    },
    onSubmit: async values => {
      await createUser({
        firstName: values.firstName,
        lastName: values.lastName,
        termsAccepted: termsAccepted,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
    }
  });

  return (
    <AuthLayout
      main={{
        title: `Let's finish setting up your account`,
        description: 'Please tell us a little bit more about yourself.'
      }}
    >
      <form onSubmit={form.handleSubmit}>
        <div
          style={{
            display: 'flex',
            gap: 10
          }}
        >
          <div style={{ flexGrow: 1 }}>
            <Input
              label="First Name"
              autoFocus
              disabled={createUserLoading}
              {...form.getFieldProps('firstName')}
            />
            <form.RenderError field="firstName" />
          </div>

          <div style={{ flexGrow: 1 }}>
            <Input
              label="Last Name"
              disabled={createUserLoading}
              {...form.getFieldProps('lastName')}
            />
            <form.RenderError field="lastName" />
          </div>
        </div>

        <Spacer size={15} />

        {authIntent.identifier && authIntent.identifier.type == 'email' && (
          <Input label="Email" disabled value={authIntent.identifier.value} />
        )}

        <div style={{ marginTop: 15, display: 'flex', justifyContent: 'center' }}>
          {createUserError && <Error>{createUserError}</Error>}
        </div>

        <Spacer size={15} />

        <Switch
          checked={termsAccepted}
          onCheckedChange={setTermsAccepted}
          label={
            <>
              I agree to the{' '}
              <a
                href="https://metorial.com/legal/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
              >
                Terms of Service
              </a>{' '}
              and the{' '}
              <a
                href="https://metorial.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </a>
              .
            </>
          }
        />

        <Spacer size={15} />

        <Button type="submit" loading={createUserLoading} fullWidth disabled={!termsAccepted}>
          Finish
        </Button>
      </form>
    </AuthLayout>
  );
};

let PasswordIntentStep = (p: {
  verify: (d: { input: { type: 'password'; password: string }; stepId: string }) => void;
  stepId: string;
  email: string | null;
  loading: boolean;
  success: boolean;
  error?: string;
  requestCode: () => void;
  requestingCode: boolean;
  codeSuccess: boolean;
  codeError?: string;
  captchaReady: boolean;
}) => {
  let form = useForm({
    initialValues: { password: '' },
    schema: yup =>
      yup.object({ password: yup.string().required('Please enter your password') }),
    onSubmit: async values =>
      p.verify({ stepId: p.stepId, input: { type: 'password', password: values.password } })
  });

  return (
    <AuthLayout
      main={{
        title: 'Enter Your Password',
        description: `Sign in to ${p.email ?? 'your account'}.`
      }}
    >
      <form onSubmit={form.handleSubmit}>
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          autoFocus
          disabled={p.loading || p.requestingCode}
          {...form.getFieldProps('password')}
        />
        <form.RenderError field="password" />
        {p.error && (
          <>
            <Spacer size={4} />
            <Error>{p.error}</Error>
          </>
        )}
        <Spacer size={15} />
        <Button
          fullWidth
          type="submit"
          loading={p.loading}
          success={p.success}
          disabled={p.requestingCode || !p.captchaReady}
        >
          Sign In
        </Button>
        <Spacer size={15} />
        <Button
          fullWidth
          variant="outline"
          type="button"
          loading={p.requestingCode}
          success={p.codeSuccess}
          disabled={p.loading}
          onClick={p.requestCode}
        >
          Send Me a Code Instead
        </Button>
        {p.codeError && <Error>{p.codeError}</Error>}
      </form>
    </AuthLayout>
  );
};

let AuthIntentStep = ({
  step,
  verify,
  verifyLoading,
  verifySuccess,
  verifyError,
  authIntent,
  resendStep,
  resending,
  requestCode,
  requestingCode,
  codeSuccess,
  codeError
}: {
  step: IAuthIntent['steps'][0] | undefined | null;
  authIntent: IAuthIntent;
  verify: (d: {
    input: { type: 'email_code'; code: string } | { type: 'password'; password: string };
    stepId: string;
  }) => void;
  verifyLoading: boolean;
  verifySuccess: boolean;
  verifyError?: string;
  resendStep: () => void;
  resending: boolean;
  requestCode: () => void;
  requestingCode: boolean;
  codeSuccess: boolean;
  codeError?: string;
}) => {
  let lastCode = useMemo(() => {
    return step?.codes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }, [step]);

  let [canResend, setCanResend] = useState(false);
  let [sentAt, setSentAt] = useState(() => lastCode?.createdAt ?? new Date());

  useEffect(() => {
    if (lastCode) {
      setSentAt(lastCode.createdAt);

      if (Math.abs(Date.now() - lastCode.createdAt.getTime()) > 1000 * 60) {
        setCanResend(true);
      }
    }
  }, [lastCode?.createdAt.getTime()]);

  useInterval(
    () => {
      if (Math.abs(differenceInMinutes(new Date(), sentAt)) > 1) setCanResend(true);
    },
    !canResend ? 1000 : null
  );

  if (step?.type == 'password') {
    return (
      <PasswordIntentStep
        stepId={step.id}
        email={step.email}
        verify={verify}
        loading={verifyLoading}
        success={verifySuccess}
        error={verifyError}
        requestCode={requestCode}
        requestingCode={requestingCode}
        codeSuccess={codeSuccess}
        codeError={codeError}
        captchaReady={!authIntent.captcha || authIntent.captcha.status == 'complete'}
      />
    );
  }

  if (step?.type == 'email_code') {
    return (
      <AuthLayout
        main={{
          title: 'Verify Your Email',
          description: `We've sent a 6-digit code to ${step.email}. Please enter it below.`
        }}
      >
        <div>
          <CodeInput
            onComplete={code => {
              verify({ stepId: step.id, input: { type: 'email_code', code } });
            }}
            disabled={verifyLoading}
          />
        </div>

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
          {verifyError && <Error>{verifyError}</Error>}
        </div>

        {canResend && (
          <>
            <Spacer size={15} />
            <LinkButton
              onClick={() => {
                resendStep();
                setCanResend(false);
                setSentAt(new Date());
              }}
              disabled={verifyLoading || resending}
              style={{ opacity: 0.5, fontSize: 12, textDecoration: 'none' }}
            >
              Resend Code
            </LinkButton>
          </>
        )}
      </AuthLayout>
    );
  }

  return (
    <FullSpinner>
      <CenteredSpinner />
    </FullSpinner>
  );
};

export let AuthIntentScene = (p: {
  authIntentId: string | undefined;
  authIntentClientSecret: string | undefined;
}) => {
  let navigate = useNavigate();

  let authIntent = authIntentState.use(
    p.authIntentClientSecret && p.authIntentId
      ? { authIntentId: p.authIntentId, authIntentClientSecret: p.authIntentClientSecret }
      : null
  );

  let verify = useMutation(authIntent.mutators.verifyStep, { disableToast: true });
  let createUser = useMutation(authIntent.mutators.createUser, { disableToast: true });
  let captcha = useMutation(authIntent.mutators.verifyCaptcha);
  let complete = useMutation(authIntent.mutators.complete);
  let resendStep = useMutation(authIntent.mutators.resendStep);
  let requestCode = useMutation(authIntent.mutators.requestEmailCode);

  let currentStep = useNonNullable(
    authIntent.data?.steps.find(step => step.status == 'current')
  );

  let completedRef = useRef(false);

  useEffect(() => {
    if (authIntent.data?.status == 'verified') {
      complete.mutate();
      completedRef.current = true;
    }
  }, [authIntent.data?.status]);

  useEffect(() => {
    if (authIntent.error?.data.status == 404 && !completedRef.current) {
      navigate('/login', {
        replace: true
      });
    }
  }, [authIntent.error]);

  if (authIntent.error) {
    if (authIntent.error.data.status == 404) {
      return (
        <FullSpinner>
          <CenteredSpinner />
        </FullSpinner>
      );
    }

    return (
      <AuthLayout>
        <Error>
          {authIntent.error.data?.message ?? authIntent.error.message ?? 'An error occurred'}
        </Error>
      </AuthLayout>
    );
  }

  if (authIntent.isLoading || !authIntent.data) {
    return (
      <AuthLayout>
        <CenteredSpinner />
      </AuthLayout>
    );
  }

  if (authIntent.data.status == 'needs_user') {
    return (
      <CreateUserStep
        authIntent={authIntent.data}
        createUser={createUser.mutate}
        createUserLoading={createUser.isLoading}
        createUserError={createUser.error?.message}
      />
    );
  }

  return (
    <>
      {authIntent.data.captcha && (
        <Turnstile
          siteKey={authIntent.data.captcha.siteKey}
          options={{
            size: 'invisible'
          }}
          onError={() => {
            toast.error('Unable to load captcha');
          }}
          onSuccess={async token => {
            await captcha.mutate({ token });
          }}
        />
      )}

      <AuthIntentStep
        step={authIntent.data.status == 'needs_verification' ? currentStep : null}
        verify={verify.mutate}
        verifyLoading={verify.isLoading}
        verifySuccess={verify.isSuccess}
        verifyError={verify.error?.message}
        resendStep={() => resendStep.mutate({ stepId: currentStep.id })}
        resending={resendStep.isLoading}
        requestCode={() => requestCode.mutate({ stepId: currentStep.id })}
        requestingCode={requestCode.isLoading}
        codeSuccess={requestCode.isSuccess}
        codeError={requestCode.error?.message}
        authIntent={authIntent.data}
      />
    </>
  );
};
