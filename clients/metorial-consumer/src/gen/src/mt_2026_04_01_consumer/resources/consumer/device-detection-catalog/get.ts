import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ConsumerDeviceDetectionCatalogGetOutput = {
  object: 'consumer.device.detection_catalog';
  schema: number;
  version: string;
  tools: {
    key: string;
    name: string;
    description: string;
    maker: { id: string; name: string };
    website: string | null;
    surfaces: ('cli' | 'ide' | 'ide-extension' | 'desktop' | 'web' | 'cloud')[];
    ideExtensionIds: string[];
    platforms: {
      macos: {
        configDirs: string[];
        apps: string[];
        binaries: string[];
        processNames: string[];
      };
      windows: {
        configDirs: string[];
        apps: string[];
        binaries: string[];
        processNames: string[];
      };
      linux: {
        configDirs: string[];
        apps: string[];
        binaries: string[];
        processNames: string[];
      };
    };
  }[];
};

export let mapConsumerDeviceDetectionCatalogGetOutput =
  /* @__PURE__ */ mapObject<ConsumerDeviceDetectionCatalogGetOutput>([
    [
      'tools',
      0,
      [
        2,
        [
          1,
          [
            'ide_extension_ids',
            [
              'platforms',
              0,
              [
                1,
                [
                  ['macos', 0, [1, ['config_dirs', 'process_names']]],
                  ['windows', 0, [1, ['config_dirs', 'process_names']]],
                  ['linux', 0, [1, ['config_dirs', 'process_names']]]
                ]
              ]
            ]
          ]
        ]
      ]
    ]
  ]);
