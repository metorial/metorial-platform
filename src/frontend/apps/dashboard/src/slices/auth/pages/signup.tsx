import { useForm } from '@metorial/data-hooks';
import { SetupLayout } from '@metorial/layout';
import { Button, Input, Spacer, Text } from '@metorial/ui';
import { Link, useSearchParams } from 'react-router-dom';
import bg from '../../../assets/bg.webp';
import bubbles from '../../../assets/bubbles.svg';
import { useSignup } from '../state';

export let AuthSignupPage = () => {
  let signup = useSignup();
  let [search] = useSearchParams();
  let redirect = search.get('redirect_uri');

  let form = useForm({
    initialValues: {
      name: '',
      email: '',
      password: '',
      passwordConfirm: ''
    },
    onSubmit: async values => {
      let [res] = await signup.mutate(values);
      if (res) location.replace(redirect || '/');
    },
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        email: yup.string().email('Invalid email').required('Email is required'),
        password: yup.string().required('Password is required'),
        passwordConfirm: yup
          .string()
          .required('Password confirmation is required')
          .oneOf([yup.ref('password')], 'Passwords must match')
      })
  });

  return (
    <SetupLayout
      main={{
        title: 'Sign Up',
        description: `Welcome to Metorial! `
      }}
      backgroundUrl={bg}
      bubblesUrl={bubbles}
    >
      <form onSubmit={form.handleSubmit}>
        <Input label="Name" {...form.getFieldProps('name')} />
        <form.RenderError field="name" />

        <Spacer size={10} />

        <Input label="Email" {...form.getFieldProps('email')} />
        <form.RenderError field="email" />

        <Spacer size={10} />

        <Input label="Password" type="password" {...form.getFieldProps('password')} />
        <form.RenderError field="password" />

        <Spacer size={10} />

        <Input
          label="Password Confirmation"
          type="password"
          {...form.getFieldProps('passwordConfirm')}
        />
        <form.RenderError field="passwordConfirm" />

        <Spacer size={10} />

        <Button type="submit" loading={signup.isLoading} success={signup.isSuccess}>
          Sign Up
        </Button>

        <signup.RenderError />

        <Spacer size={10} />

        <Text size="1">
          Already have an account?{' '}
          <Link to={`/auth/login?redirect_uri=${encodeURIComponent(redirect ?? '')}`}>
            Log in
          </Link>
        </Text>
      </form>
    </SetupLayout>
  );
};
