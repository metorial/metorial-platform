import type {
  Artifact,
  SlateToolingArtifact,
  SlateToolingArtifactSignature
} from '../../prisma/generated/client';
import { contentChecksumAlgorithm } from '../lib/signature';

export let slateToolingPresenter = (
  tooling: SlateToolingArtifact & {
    artifact: Artifact;
    signatures: SlateToolingArtifactSignature[];
  }
) => ({
  object: 'slate.tooling',

  id: tooling.id,
  kind: tooling.kind,
  version: tooling.version,
  protocol: tooling.protocol,

  main: tooling.metadata.main,
  exports: tooling.metadata.exports,

  contentChecksum: tooling.checksum,
  contentChecksumAlgorithm,

  signatures: tooling.signatures.map(signature => ({
    kid: signature.kid,
    signature: signature.signature
  })),

  size: Number(tooling.artifact.size),

  createdAt: tooling.createdAt
});
