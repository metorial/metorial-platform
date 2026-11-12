import { badRequestError, isServiceError, ServiceError } from '@lowerdeck/error';
import { slatePackImportPresenter } from '../../presenters';
import { processSlatePackQueue } from '../../queues/mirror/packs';
import { slatePackService } from '../../services';
import { isMirrorMode } from '../../mode';

export let SLATE_PACK_UPLOAD_PATH = '/slates-registry-packs/upload';

let json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

// Streams the raw upload into object storage; the RPC transport would buffer it as JSON.
export let handleSlatePackUpload = async (req: Request) => {
  try {
    if (!isMirrorMode()) {
      throw new ServiceError(
        badRequestError({ message: 'Slate packs can only be imported in mirror mode.' })
      );
    }
    if (!req.body) {
      throw new ServiceError(badRequestError({ message: 'The upload has no body.' }));
    }

    let fileName = new URL(req.url).searchParams.get('file_name') ?? 'upload.slatepack';
    let packImport = await slatePackService.createImport({ fileName, body: req.body });

    await processSlatePackQueue.add(
      { packImportId: packImport.id },
      { deduplication: { id: packImport.id } }
    );

    return json(200, slatePackImportPresenter(packImport));
  } catch (error) {
    if (isServiceError(error)) {
      let response = error.toResponse();
      return json(response.status ?? 500, response);
    }

    console.error('[Registry]: Slate pack upload failed', error);
    return json(500, { ok: false, code: 'internal_server_error', status: 500 });
  }
};
