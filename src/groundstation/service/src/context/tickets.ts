let maxTicketRefs = 8;

let ticketPattern = /(?<![A-Za-z0-9])([A-Z][A-Z0-9]+-\d+)(?![A-Za-z0-9])/g;

export let ticketRefsFromBranch = (branch: string | undefined) => {
  if (!branch) return [];

  let refs = new Set<string>();

  for (let match of branch.matchAll(ticketPattern)) {
    refs.add(match[1]!);
    if (refs.size >= maxTicketRefs) break;
  }

  return [...refs];
};
