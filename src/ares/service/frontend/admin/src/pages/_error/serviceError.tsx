import { ServiceError } from '@lowerdeck/error';
import { ErrorPage, NotFound } from '@metorial-io/pages';

export let ServiceErrorPage = ({ error }: { error: ServiceError<any> }) => {
  if (error.data.status == 404) return <NotFound />;

  return <ErrorPage title="Unable to load data" description={error.data.message} />;
};
