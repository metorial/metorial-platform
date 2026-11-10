export let getVisibleConsumerGroups = <T>(ctx: {
  consumerProfile?: unknown;
  consumerGroups?: T[];
}) => (ctx.consumerProfile ? (ctx.consumerGroups ?? []) : undefined);
