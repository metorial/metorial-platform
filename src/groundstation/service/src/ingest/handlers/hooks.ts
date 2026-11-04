import { notImplementedError } from '@lowerdeck/error';
import type { IngestHandler } from '../request';
import { errorResponse } from '../response';

export let hookHandler: IngestHandler = async () => errorResponse(notImplementedError());
