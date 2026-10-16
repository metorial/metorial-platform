import { ErrorPage, NotFound } from '@metorial/pages';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { useHideBootSpinner } from '../lib/bootSpinner';

export let RouterErrorPage = () => {
  let error = useRouteError();

  useHideBootSpinner(true);

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;

  let message = error instanceof Error ? error.message : 'unknown error';

  return (
    <ErrorPage
      title="An error occurred"
      description={`An error occurred while trying to render this page: ${message}`}
    />
  );
};
