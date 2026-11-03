import { ProjectDefinition } from './project';
import type { RawManifest } from './types';

/** Escape hatch used by tests: wraps an already-compiled manifest. */
export let rawProject = (raw: RawManifest) => new ProjectDefinition(raw);
