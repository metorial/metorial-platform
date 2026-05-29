import { ErrorPage, NotFound } from '@metorial/pages';
import { useRouteError } from 'react-router-dom';

export let RouterErrorPage = () => {
  let error = useRouteError();

  if ((error as any)?.status === 404) return <NotFound />;

  return (
    <ErrorPage
      title="An error occurred"
      description={`An error occurred while trying to render this page: ${
        (error as any).message ?? 'unknown error'
      }`}
    />
  );
};
