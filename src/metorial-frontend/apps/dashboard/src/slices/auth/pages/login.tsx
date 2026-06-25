import { useForm } from '@metorial/data-hooks';
import { SetupLayout } from '@metorial/layout';
import { Button, Input, Spacer, Text } from '@metorial/ui';
import { Link, useSearchParams } from 'react-router-dom';
import bg from '../../../assets/bg.webp';
import { useLogin } from '../state';

export let AuthLoginPage = () => {
  let login = useLogin();
  let [search] = useSearchParams();
  let redirect = search.get('redirect_uri');

  let form = useForm({
    initialValues: {
      email: '',
      password: ''
    },
    onSubmit: async values => {
      let [res] = await login.mutate(values);
      if (res) location.replace(redirect || '/');
    },
    schema: yup =>
      yup.object({
        email: yup.string().email('Invalid email').required('Email is required'),
        password: yup.string().required('Password is required')
      })
  });

  return (
    <SetupLayout
      main={{
        title: 'Login',
        description: `Welcome back to Metorial!`
      }}
      backgroundUrl={bg}
    >
      <form onSubmit={form.handleSubmit}>
        <Input label="Email" {...form.getFieldProps('email')} />
        <form.RenderError field="email" />

        <Spacer size={10} />

        <Input label="Password" type="password" {...form.getFieldProps('password')} />
        <form.RenderError field="password" />

        <Spacer size={10} />

        <Button type="submit" loading={login.isLoading} success={login.isSuccess}>
          Login
        </Button>

        <login.RenderError />

        <Spacer size={10} />

        <Text size="1">
          Don't have an account?{' '}
          <Link to={`/auth/signup?redirect_uri=${encodeURIComponent(redirect ?? '')}`}>
            Sign Up
          </Link>
        </Text>
      </form>
    </SetupLayout>
  );
};
