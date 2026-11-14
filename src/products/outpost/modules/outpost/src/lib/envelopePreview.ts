export let getEnvelopePreview = (envelope: string) =>
  `${envelope.slice(0, 16)}...${envelope.slice(-4)}`;
