import { ErrorPage, NotFound } from '@metorial-io/pages';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

export let RouterErrorPage = () => {
  let error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;

  let message = error instanceof Error ? error.message : 'unknown error';

  return (
    <ErrorPage
      title="An error occurred"
      description={`An error occurred while trying to render this page: ${message}`}
    />
  );
};
