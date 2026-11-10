import { defineSettings, setting } from '@metorial/settings';
import { v } from '@lowerdeck/validation';

let hour = 60 * 60;
let day = 24 * hour;

export let env = defineSettings({
  origin: {
    CODE_BUCKET_SERVICE_URL: v.string()
  },

  skillSync: {
    SKILL_SYNC_MANIFEST_PROPAGATION_ENABLED: setting(v.boolean(), {
      default: true,
      description:
        'Kill switch for the repository stage of manifest-mode destinations. When off, their propagations wait instead of failing.'
    }),

    SKILL_SYNC_DELETION_GUARD_MAX_UNEXPECTED_DELETES: setting(v.number(), {
      default: 250,
      description:
        'Unexpected deletes a single manifest sync may make before Origin refuses it.'
    }),
    SKILL_SYNC_DELETION_GUARD_MAX_UNEXPECTED_DELETE_RATIO: setting(v.number(), {
      default: 0.1,
      description:
        'Share of the managed files (0-1) a single manifest sync may delete unexpectedly.'
    }),

    SKILL_SYNC_BLOB_RETENTION: setting(v.number(), {
      default: 7 * day,
      description:
        'Seconds an unreferenced sync blob is kept. Must exceed SKILL_SYNC_MAX_SYNC_LIFETIME.'
    }),
    SKILL_SYNC_MANIFEST_RETENTION: setting(v.number(), {
      default: 7 * day,
      description: 'Seconds an unreferenced destination manifest is kept.'
    }),
    SKILL_SYNC_MANIFEST_KEEP_LAST: setting(v.number(), {
      default: 5,
      description: 'Manifests per destination that garbage collection always keeps.'
    }),
    SKILL_SYNC_MAX_SYNC_LIFETIME: setting(v.number(), {
      default: 2 * day,
      description: 'Seconds a manifest propagation may wait on Origin before it fails.'
    }),
    SKILL_SYNC_INLINE_HASH_MAX_BYTES: setting(v.number(), {
      default: 64 * 1024 * 1024,
      description: 'Largest file hashed inline during a sync; larger files use the hash queue.'
    }),

    SKILL_SYNC_DRIFT_CHECK_INTERVAL: setting(v.number(), {
      default: day,
      description:
        'Seconds after which an unchanged manifest is sent to Origin anyway to repair drift.'
    }),
    SKILL_SYNC_REPAIR_BACKOFF: setting.list(v.number(), {
      default: [15 * 60, hour, 4 * hour, 12 * hour],
      description:
        'Seconds between automatic repair attempts per repository; the last value repeats.'
    }),
    SKILL_SYNC_REPAIR_ALERT_AFTER: setting(v.number(), {
      default: day,
      description: 'Seconds of continuous repair failures after which a repository is alerted.'
    }),
    SKILL_SYNC_SOURCE_NOT_FOUND_MAX_RECOVERIES: setting(v.number(), {
      default: 3,
      description:
        'Automatic source recoveries (source_not_found, content_mismatch) per destination per 24 hours.'
    }),
    SKILL_SYNC_SOURCE_RECOVERY_EXHAUSTED_AFTER: setting(v.number(), {
      default: 3,
      description:
        'Consecutive 24-hour windows in which source recovery hits its limit before a repository stops repairing and is marked recovery_exhausted.'
    }),
    SKILL_SYNC_RECONCILER_CRONS_ENABLED: setting(v.boolean(), {
      default: true,
      description:
        'Runs the storage migration, code-bucket deletion, repair and drift-check crons. Turned off where tests drive those jobs directly.'
    }),
    SKILL_SYNC_MIGRATION_NON_GITHUB_MAX_FILES: setting(v.number(), {
      default: 20_000,
      description:
        'Destinations linked to a GitLab or Bitbucket repository with more files than this stay on code-bucket storage.'
    }),
    SKILL_SYNC_CODE_BUCKET_RETENTION: setting(v.number(), {
      default: 14 * day,
      description:
        'Seconds a migrated destination keeps its code bucket after every repository has a completed manifest sync.'
    }),

    SKILL_EXPORT_MAX_ARCHIVE_BYTES: setting(v.number(), {
      default: 20 * 1024 ** 3,
      description: 'Largest zip archive a skill export may produce.'
    })
  }
});
