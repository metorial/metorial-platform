export let canDeleteDisplacedFile = (d: {
  isSameFile: boolean;
  status: string;
  isInternal: boolean;
  isReadOnly: boolean;
  isTemplateBacking: boolean;
  hasDocument: boolean;
  fileLinkCount: number;
  hasFileReferences: boolean;
  referenceCounts: Record<string, number>;
}) =>
  !d.isSameFile &&
  d.status === 'active' &&
  !d.isInternal &&
  !d.isReadOnly &&
  !d.isTemplateBacking &&
  !d.hasDocument &&
  !d.hasFileReferences &&
  Object.values(d.referenceCounts).every(count => count === 0);
