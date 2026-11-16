import { resourceSet } from '../../_lib/resource';
import { apiKeyResource } from './apiKey';
import {
  oauthApplicationClientSecretResource,
  oauthApplicationResource
} from './oauthApplication';
import {
  oauthAuthorizationRequestResource,
  oauthAuthorizationResource
} from './oauthAuthorization';
import { oauthInstallationResource } from './oauthInstallation';
import {
  serviceAccountCredentialResource,
  serviceAccountResource
} from './serviceAccount';

export let machineAccessResources = resourceSet({
  api_key: apiKeyResource,
  oauth_application: oauthApplicationResource,
  oauth_application_client_secret: oauthApplicationClientSecretResource,
  oauth_installation: oauthInstallationResource,
  oauth_authorization: oauthAuthorizationResource,
  oauth_authorization_request: oauthAuthorizationRequestResource,
  service_account: serviceAccountResource,
  service_account_credential: serviceAccountCredentialResource
});
