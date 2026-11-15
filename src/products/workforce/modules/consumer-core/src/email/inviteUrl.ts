export let buildConsumerInviteUrl = (d: {
  portalUrl: string;
  inviteId: string;
  consumerProfileId: string;
  email: string;
}) => {
  let url = new URL(d.portalUrl);

  url.searchParams.set('consumer_invite_id', d.inviteId);
  url.searchParams.set('consumer_profile_id', d.consumerProfileId);
  url.searchParams.set('email', d.email);

  return url.toString();
};
