import { getFederationConfig } from '@metorial-enterprise/federation-frontend-config';
import { useForm } from '@metorial/data-hooks';
import { Button, CenteredSpinner, Flex, Input, Or, Spacer } from '@metorial/ui';
import { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { CodeInput } from '../components/codeInput';
import { useAuth } from '../state/portal/auth';
import { useBoot } from '../state/portal/client';

let Wrapper = styled.div`
  min-height: 100dvh;
  padding: 20px;
  display: grid;
  grid-template-columns: calc(50% - 40px) calc(50% - 40px);
  align-items: center;
  gap: 40px;

  @media (max-width: 1000px) {
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

let Aside = styled.aside`
  background: linear-gradient(to right, #000428, #004e92);
  height: 100%;
  border-radius: 12px;
  box-shadow: rgba(0, 0, 0, 0.24) 0px 3px 8px;
  color: white;
  padding: 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-end;
  gap: 15px;
  text-align: right;

  h1 {
    font-size: 3.5rem;
  }

  p {
    font-size: 1.25rem;
    max-width: 600px;
    opacity: 0.8;
  }

  @media (max-width: 1000px) {
    display: none;
  }
`;

let Main = styled.main`
  display: flex;
  justify-content: center;
`;

let MainInner = styled.div`
  display: flex;
  flex-direction: column;
  width: 400px;
  max-width: calc(100vw - 40px);

  & > h2 {
    font-size: 1.25rem;
  }

  & > p {
    font-size: 0.875rem;
    color: #666;
  }

  .legal {
    margin-top: 20px;
    font-size: 12px;
    color: #666;

    a {
      color: inherit;
      text-decoration: underline;
    }
  }
`;

let AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <Wrapper>
      <Aside>
        <h1>Welcome to Metorial</h1>
        <p>Your secure portal for managing AI apps.</p>
      </Aside>

      <Main>
        <MainInner>{children}</MainInner>
      </Main>
    </Wrapper>
  );
};

export let LoginPage = () => {
  let auth = useAuth();
  let boot = useBoot();

  let authenticateWithEmailCodeStartMutator = auth.useAuthenticateWithEmailCodeStart();
  let authenticateWithEmailCodeCompleteMutator = auth.useAuthenticateWithEmailCodeComplete();
  let authenticateWithSsoStartMutator = auth.useAuthenticateWithSsoStart();
  let authenticateWithSsoCompleteMutator = auth.useAuthenticateWithSsoComplete();

  let hasEmailFactor = auth.data?.factors.some(f => f.type == 'email_code');
  let ssoFactors = auth.data?.factors.filter(f => f.type == 'sso');

  let navigate = useNavigate();

  useEffect(() => {
    if (boot.data?.type != 'authenticated') return;

    let url = new URL(boot.data.portalUrl);
    navigate(url.pathname + url.search);
  }, [boot.data]);

  let [step, setStep] = useState<'choose' | 'email_code'>('choose');

  let form = useForm({
    initialValues: {
      email: ''
    },
    schema: yup =>
      yup.object({
        email: yup.string().email('Enter a valid email').required('Email is required')
      }),
    onSubmit: async ({ email }) => {
      let [res] = await authenticateWithEmailCodeStartMutator.mutate({ email });
      if (res) setStep('email_code');
    }
  });

  if (import.meta.env.PROD) {
    useEffect(() => {
      window.location.replace(
        `${new URL(getFederationConfig().urls.apis.admin).origin}/auth/google?redirect_url=${encodeURIComponent(
          `${window.location.origin}/users`
        )}`
      );
    }, []);

    return null;
  }

  if (auth.isLoading || boot.isLoading || boot.data?.type == 'authenticated') {
    return (
      <AuthLayout>
        <CenteredSpinner />
      </AuthLayout>
    );
  }

  let anyIsLoading =
    authenticateWithEmailCodeStartMutator.isLoading ||
    authenticateWithEmailCodeCompleteMutator.isLoading ||
    authenticateWithSsoStartMutator.isLoading ||
    authenticateWithSsoCompleteMutator.isLoading;

  if (step == 'email_code') {
    return (
      <AuthLayout>
        <h2>Enter Verification Code</h2>
        <Spacer height={10} />
        <p>
          We have sent a verification code to {form.values.email}. Please enter the code below
          to continue.
        </p>

        <Spacer height={25} />

        <CodeInput
          onComplete={code => {
            authenticateWithEmailCodeCompleteMutator.mutate({
              email: form.values.email,
              code
            });
          }}
        />
        <authenticateWithEmailCodeCompleteMutator.RenderError />
      </AuthLayout>
    );
  }

  let factors: React.ReactNode[] = [];

  if (hasEmailFactor) {
    factors.push(
      <form onSubmit={form.handleSubmit}>
        <Input {...form.getFieldProps('email')} label="Email" type="email" />
        <form.RenderError field="email" />

        <Spacer height={15} />

        <Button
          type="submit"
          loading={authenticateWithEmailCodeStartMutator.isLoading}
          success={authenticateWithEmailCodeStartMutator.isSuccess}
          disabled={anyIsLoading}
          fullWidth
        >
          Login with Email
        </Button>
        <authenticateWithEmailCodeStartMutator.RenderError />
      </form>
    );
  }

  if (ssoFactors?.length) {
    factors.push(
      <Flex direction="column" gap={15}>
        {ssoFactors.map(factor => (
          <Button
            key={factor.id}
            as="span"
            disabled={anyIsLoading}
            onClick={async () => {
              let [startRes] = await authenticateWithSsoStartMutator.mutate({
                authFactorId: factor.id
              });
              if (startRes) window.location.replace(startRes.url);
            }}
            fullWidth
          >
            Login with {factor.name}
          </Button>
        ))}
      </Flex>
    );
  }

  return (
    <AuthLayout>
      <h2>Login to {boot.data?.portal.name}</h2>

      <Spacer height={25} />

      {factors.map((factor, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <>
              <Spacer height={25} />
              <Or />
              <Spacer height={25} />
            </>
          )}

          {factor}
        </Fragment>
      ))}

      <p className="legal">
        By signing up for, logging in to and/or using a{' '}
        <a href="https://metorial.com">Metorial</a> service, you agree to Metorial's{' '}
        <a href="https://metorial.com/legal/terms-of-service">terms of service</a> and{' '}
        <a href="https://metorial.com/legal/privacy-policy">privacy policy</a>.
      </p>
    </AuthLayout>
  );
};
