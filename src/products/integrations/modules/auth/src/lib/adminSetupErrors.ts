import {
  badRequestError,
  conflictError,
  ServiceError,
  tooManyRequestsError
} from '@lowerdeck/error';

export let adminSetupInvalidBindingError = () =>
  new ServiceError(
    badRequestError({
      message: 'Admin setup sessions cannot be bound to an identity, consumer, or config',
      code: 'admin_setup_invalid_binding'
    })
  );

export let adminSetupToolFiltersError = () =>
  new ServiceError(
    badRequestError({
      message: 'Admin setup sessions do not support tool filters',
      code: 'admin_setup_invalid_configuration'
    })
  );

export let adminSetupEmailNotSupportedError = () =>
  new ServiceError(
    badRequestError({
      message: 'Setup links can only be emailed for admin setup sessions',
      code: 'admin_setup_email_not_supported'
    })
  );

export let adminSetupEmailSessionInactiveError = (status: string) =>
  new ServiceError(
    badRequestError({
      message: `Setup links cannot be emailed for a setup session that is ${status}`,
      code: 'admin_setup_email_session_inactive'
    })
  );

export let adminSetupEmailRecipientsRequiredError = () =>
  new ServiceError(
    badRequestError({
      message: 'At least one email address or organization member is required',
      code: 'admin_setup_email_recipients_required'
    })
  );

export let adminSetupEmailTooManyRecipientsError = (maxRecipients: number) =>
  new ServiceError(
    badRequestError({
      message: `A setup link can be emailed to at most ${maxRecipients} recipients at once`,
      code: 'admin_setup_email_too_many_recipients'
    })
  );

export let adminSetupEmailMemberNotFoundError = (organizationMemberId: string) =>
  new ServiceError(
    badRequestError({
      message: `Organization member ${organizationMemberId} was not found or has no email address`,
      code: 'admin_setup_email_member_not_found'
    })
  );

export let adminSetupEmailConflictError = (recipientEmail: string) =>
  new ServiceError(
    conflictError({
      message: `Could not record the setup link email to ${recipientEmail} because of a concurrent request, please retry`,
      code: 'admin_setup_email_conflict'
    })
  );

export let adminSetupEmailLimitReachedError = (maxRecipientsPerDay: number) =>
  new ServiceError(
    tooManyRequestsError({
      message: `A setup link can be emailed to at most ${maxRecipientsPerDay} different recipients within 24 hours`,
      code: 'admin_setup_email_limit_reached'
    })
  );

export let adminSetupInstanceEmailLimitReachedError = (maxRecipientsPerDay: number) =>
  new ServiceError(
    tooManyRequestsError({
      message: `Setup links of this instance can be emailed to at most ${maxRecipientsPerDay} different recipients within 24 hours`,
      code: 'admin_setup_email_limit_reached'
    })
  );
