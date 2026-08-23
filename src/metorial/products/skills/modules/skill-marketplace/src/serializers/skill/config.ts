import {
  isAllowedSkillPath,
  safeNonScriptFileExtensions,
  scriptsFolder
} from '../../lib/files';

export type SkillConfigurationPolicy = {
  allowScripts: boolean;
  allowedFileExtensions?: string[] | null;
  allowNonStandardDirectories: boolean;
};

export let isRootSkillDocument = (path: string) => path.replace(/^\/+/, '') === 'SKILL.md';

export let normalizeSkillPath = (path: string) => path.replace(/^\/+/, '');

let normalizeFileExtension = (extension: string) => {
  let normalized = extension.trim().toLowerCase();
  if (!normalized) return null;
  return normalized.startsWith('.') ? normalized : `.${normalized}`;
};

let getFileExtension = (path: string) => {
  let fileName = normalizeSkillPath(path).split('/').at(-1) ?? '';
  let dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) return null;
  return normalizeFileExtension(fileName.slice(dotIndex));
};

let isScriptsPath = (path: string) => {
  let normalizedPath = normalizeSkillPath(path);
  return normalizedPath === scriptsFolder || normalizedPath.startsWith(`${scriptsFolder}/`);
};

export let getEffectiveAllowedFileExtensions = (config: SkillConfigurationPolicy) => {
  let allowedExtensions = (config.allowedFileExtensions ?? [])
    .map(normalizeFileExtension)
    .filter((extension): extension is string => !!extension);

  if (config.allowScripts) {
    return {
      shouldFilter: allowedExtensions.length > 0,
      extensions: allowedExtensions
    };
  }

  let safeExtensions = new Set(
    safeNonScriptFileExtensions
      .map(normalizeFileExtension)
      .filter((extension): extension is string => !!extension)
  );

  return {
    shouldFilter: true,
    extensions: allowedExtensions.length
      ? allowedExtensions.filter(extension => safeExtensions.has(extension))
      : [...safeExtensions]
  };
};

export let isAllowedBySkillConfig = (path: string, config: SkillConfigurationPolicy) => {
  let normalizedPath = normalizeSkillPath(path);

  if (isRootSkillDocument(normalizedPath)) return true;

  if (!config.allowNonStandardDirectories && !isAllowedSkillPath(normalizedPath)) {
    return false;
  }

  if (!config.allowScripts && isScriptsPath(normalizedPath)) return false;

  let allowedExtensions = getEffectiveAllowedFileExtensions(config);
  if (!allowedExtensions.shouldFilter) return true;

  let extension = getFileExtension(normalizedPath);
  return !!extension && allowedExtensions.extensions.includes(extension);
};
