import { useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/layout';

export let EmailVerified = () => {
  let [searchParams] = useSearchParams();
  let email = searchParams.get('email');

  return (
    <AuthLayout
      main={{
        title: 'Email Verified',
        description: (
          <>
            Your email address {email && <span style={{ opacity: 0.6 }}>({email})</span>} has
            been verified.
          </>
        )
      }}
    />
  );
};
