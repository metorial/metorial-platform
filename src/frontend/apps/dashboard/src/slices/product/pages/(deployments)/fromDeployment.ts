export let getFromDeployment = (search: string, fallback?: string | null) =>
  new URLSearchParams(search).get('fromDeployment') ?? fallback ?? undefined;

export let withFromDeployment = (path: string, fromDeployment?: string | null) =>
  fromDeployment ? `${path}?fromDeployment=${encodeURIComponent(fromDeployment)}` : path;
