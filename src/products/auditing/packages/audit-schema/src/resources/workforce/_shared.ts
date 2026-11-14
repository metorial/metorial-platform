export type ConsumerAccessTargetSummary = {
  type: string;
  id: string | null;
  name: string | null;
};

export type ConsumerSurfaceSummary = {
  id: string;
  type: string;
  name: string;
  portalId: string | null;
};
