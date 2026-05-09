import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { cargo, type CargoDocumentVersion } from '../cargo';
import type { FileOwner } from './file';
import {
  documentParticipantService,
  type EnrichedCargoDocumentActor
} from './documentParticipant';
import { resolveCargoScopeForOwner } from './scope';

export type EnrichedCargoDocumentVersion = Omit<CargoDocumentVersion, 'editors'> & {
  editors: EnrichedCargoDocumentActor[];
};

class DocumentVersionServiceImpl {
  private async getScope(owner: FileOwner) {
    return await resolveCargoScopeForOwner(owner);
  }

  private async enrichVersion(d: {
    owner: FileOwner;
    version: CargoDocumentVersion;
  }): Promise<EnrichedCargoDocumentVersion> {
    return {
      ...d.version,
      editors: await documentParticipantService.enrichActors({
        owner: d.owner,
        actors: d.version.editors
      })
    };
  }

  async listDocumentVersions(d: {
    owner: FileOwner;
    documentId: string[];
  }) {
    let scope = await this.getScope(d.owner);

    return Paginator.create(() => async input => {
      let result = await cargo.documentVersion.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        documentId: d.documentId,
        ...input
      } as any);

      return {
        items: await Promise.all(
          result.items.map(async version =>
            await this.enrichVersion({
              owner: d.owner,
              version
            })
          )
        ),
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }

  async getDocumentVersionById(d: {
    owner: FileOwner;
    documentVersionId: string;
  }) {
    let scope = await this.getScope(d.owner);
    let version = await cargo.documentVersion.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      documentVersionId: d.documentVersionId
    });

    return await this.enrichVersion({
      owner: d.owner,
      version
    });
  }
}

export let documentVersionService = Service.create(
  'fileDocumentVersion',
  () => new DocumentVersionServiceImpl()
).build();
