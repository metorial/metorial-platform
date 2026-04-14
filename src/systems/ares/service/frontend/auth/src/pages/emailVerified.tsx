import { Spacer, Text, Title } from '@metorial-io/ui';
import { useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/layout';

export let EmailVerified = () => {
  let [searchParams] = useSearchParams();
  let email = searchParams.get('email');

  return (
    <AuthLayout>
      <Title as="h1" weight="bold" size="4">
        Email Verified
      </Title>

      <Spacer height={10} />

      <Text color="gray600" weight="medium" size="2">
        Your email address {email && <span style={{ opacity: 0.6 }}>({email})</span>} has been
        verified.
      </Text>
    </AuthLayout>
  );
};
