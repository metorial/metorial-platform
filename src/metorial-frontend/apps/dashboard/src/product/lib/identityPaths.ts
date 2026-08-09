import { Paths } from '@metorial/frontend-config';
import { useParams } from 'react-router-dom';

export let useIdentityPaths = () => {
  let { portalId } = useParams();
  return Paths.instance.portalIdentity(portalId);
};
