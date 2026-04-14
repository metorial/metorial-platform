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
  Switch,
  Text,
  Title
} from '@metorial-io/ui';
import { differenceInMinutes } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CodeInput } from '../components/codeInput';
import { AuthLayout } from '../components/layout';
import { useNonNullable } from '../hooks/useNonNullable';
import { authIntentState } from '../state/authIntent';
import type { IAuthIntent } from '../state/client';

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
    <AuthLayout>
      <Title as="h1" weight="bold" size="4">
        Let's finish setting up your account
      </Title>

      <Spacer height={10} />

      <Text color="gray600" weight="medium" size="2">
        Please tell us a little bit more about yourself.
      </Text>

      <Spacer height={25} />

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

let AuthIntentStep = ({
  step,
  verify,
  verifyLoading,
  verifyError,
  authIntent,
  resendStep,
  resending
}: {
  step: IAuthIntent['steps'][0] | undefined | null;
  authIntent: IAuthIntent;
  verify: (d: { input: { type: 'email_code'; code: string }; stepId: string }) => void;
  verifyLoading: boolean;
  verifyError?: string;
  resendStep: () => void;
  resending: boolean;
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

  if (step?.type == 'email_code') {
    return (
      <AuthLayout>
        <Title as="h1" weight="bold" size="4">
          Verify Your Email
        </Title>

        <Spacer height={10} />

        <Text color="gray600" weight="medium" size="2">
          We've sent a 6-digit code to {step.email}. Please enter it below.
        </Text>

        <Spacer height={25} />

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
    <AuthLayout>
      <CenteredSpinner />
    </AuthLayout>
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
        <AuthLayout>
          <CenteredSpinner />
        </AuthLayout>
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
        verifyError={verify.error?.message}
        resendStep={() => resendStep.mutate({ stepId: currentStep.id })}
        resending={resendStep.isLoading}
        authIntent={authIntent.data}
      />
    </>
  );
};
