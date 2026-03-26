import { input } from '@inquirer/prompts';
import fs from 'fs-extra';
import path from 'path';
import { Cases } from './case';
import { getEndpoints, getEndpointVersions, type IntrospectedType } from './fetch';

// Generate type exports for Python packages
let generateTypeExports = (
  typeIdToName: Map<string, { typeName: string; mapperName: string }>,
  version: string
): string => {
  let typeNames = Array.from(typeIdToName.values()).map(t => t.typeName);
  let mapperNames = Array.from(typeIdToName.values()).map(t => t.mapperName);

  // Sort for consistent output
  typeNames.sort();
  mapperNames.sort();

  let exports = [
    '# Generated type exports',
    '# These types are automatically exported for better IDE support',
    '',
    '# Type classes',
    ...typeNames.map(name => `# ${name}`),
    '',
    '# Mapper classes',
    ...mapperNames.map(name => `# ${name}`),
    '',
    '# All types and mappers are available via:',
    '# from .resources import *',
    '# from .endpoints import *',
    ''
  ];

  return exports.join('\n');
};

// Update the main public API to include generated types
let updateMainPublicAPI = async (
  typeIdToName: Map<string, { typeName: string; mapperName: string }>,
  version: string,
  rootOutputFolder: string
) => {
  // Find the main public API file
  let mainApiPath = path.join(
    rootOutputFolder,
    '..',
    '..',
    '..',
    'packages',
    'metorial',
    'src',
    'metorial',
    '__init__.py'
  );

  try {
    if (await fs.pathExists(mainApiPath)) {
      let currentContent = await fs.readFile(mainApiPath, 'utf-8');

      // Generate import statements for the generated types
      let typeNames = Array.from(typeIdToName.values()).map(t => t.typeName);
      let mapperNames = Array.from(typeIdToName.values()).map(t => t.mapperName);

      // Create import statement for the generated package
      let generatedImport = `from metorial_generated.${version} import *`;

      // Check if the import already exists
      if (!currentContent.includes(generatedImport)) {
        // Add the import after the existing imports
        let lines = currentContent.split('\n');
        let insertIndex = lines.findIndex(line => line.startsWith('__version__'));

        if (insertIndex > 0) {
          lines.splice(insertIndex, 0, '', '    # Generated types from API', generatedImport);
          await fs.writeFile(mainApiPath, lines.join('\n'));
        }
      }
    }
  } catch (error) {
    console.warn('Could not update main public API:', error);
  }
};

let args = process.argv.slice(2);
let url = args[0];
let rootOutputFolder = args[1];
let language = args[2];

if (!url) url = await input({ message: 'API URL' });
if (!rootOutputFolder) rootOutputFolder = await input({ message: 'Output folder' });
if (!language) {
  language = await input({ message: 'Language (typescript, python, or go)' });
  if (!language) language = 'python';
}

let fileExtension: string;

if (language === 'typescript') {
  fileExtension = '.ts';
} else if (language === 'python') {
  fileExtension = '.py';
} else if (language === 'go') {
  fileExtension = '.go';
} else {
  throw new Error(`Unsupported language: ${language}`);
}

rootOutputFolder = path.join(process.cwd(), rootOutputFolder);

// Import language-specific utilities
let toPyIdentifier: (name: string) => string = (name: string) => name;
let toPyFolderName: (name: string) => string = (name: string) => name;
let toGoFolderName: (name: string) => string = (name: string) => name;

if (language === 'python') {
  let pythonUtils = await import('./languages/python/utils');
  toPyIdentifier = pythonUtils.toPyIdentifier;
  toPyFolderName = pythonUtils.toPyFolderName;
}

if (language === 'go') {
  let goUtils = await import('./languages/go/utils');
  toGoFolderName = goUtils.toGoFolderName;
}

let mapperModule = await import(`./languages/${language}/mapper`);
let typeModule = await import(`./languages/${language}/type`);
let endpointModule = await import(`./languages/${language}/endpoint`);

let matchesResourcePath = (sdkPath: string, resource: string) =>
  sdkPath === resource || sdkPath.startsWith(`${resource}.`);

let urls = url.split(',');
let workingUrl = null;
for (let u of urls) {
  try {
    await fetch(u);
    workingUrl = u;
    break;
  } catch (e) {}
}

if (!workingUrl) {
  throw new Error('None of the provided URLs are reachable.');
}

let versions = await getEndpointVersions(workingUrl);

// For Go, only generate magnetar versions
let filteredVersions = language === 'go'
  ? versions.versions.filter(v => v.version.includes('magnetar'))
  : versions.versions;

for (let version of filteredVersions) {
  let { endpoints, types, controllers } = await getEndpoints(url, version.version);

  // For Go, separate endpoints into public and management groups.
  // Dashboard and consumer endpoints are excluded entirely.
  let goManagementEndpoints: typeof endpoints = [];
  if (language === 'go') {
    let excludePrefixes = ['dashboard.', 'consumer.'];
    let mgmtPrefix = 'management.instance.';

    // Extract management endpoints and rewrite their sdkPaths to strip the prefix
    goManagementEndpoints = endpoints
      .filter(e => e.allPaths.some(p => p.sdkPath.startsWith(mgmtPrefix)))
      .map(e => ({
        ...e,
        allPaths: e.allPaths
          .filter(p => p.sdkPath.startsWith(mgmtPrefix))
          .map(p => ({ ...p, sdkPath: p.sdkPath.slice(mgmtPrefix.length) }))
      }))
      .filter(e => e.allPaths.length > 0);

    // Keep only public endpoints (not dashboard, management, or consumer)
    let allExcludePrefixes = [...excludePrefixes, 'management.'];
    endpoints = endpoints.filter(e =>
      !e.allPaths.every(p =>
        allExcludePrefixes.some(prefix => p.sdkPath.startsWith(prefix))
      )
    );
    for (let e of endpoints) {
      e.allPaths = e.allPaths.filter(p =>
        !allExcludePrefixes.some(prefix => p.sdkPath.startsWith(prefix))
      );
    }
    endpoints = endpoints.filter(e => e.allPaths.length > 0);
  }

  // For Go, output goes directly to the output folder (no src/ subdirectory)
  let outputFolder = language === 'go'
    ? rootOutputFolder
    : path.join(rootOutputFolder, 'src', version.version);

  await fs.ensureDir(outputFolder);

  let resourcesFolder = `${outputFolder}/resources`;

  await fs.ensureDir(outputFolder);
  if (language !== 'go') {
    await fs.emptyDir(outputFolder);
  } else {
    // For Go, clean up generated directories before regenerating
    await fs.emptyDir(resourcesFolder);
    await fs.emptyDir(`${outputFolder}/endpoints`);
  }
  await fs.ensureDir(resourcesFolder);

  let resourceFolders = new Set<string>();

  let typeIdToName = new Map<
    string,
    {
      typeName: string;
      mapperName: string;
    }
  >();

  // Track types per file to consolidate imports
  let fileTypes = new Map<
    string,
    Array<{
      id: string;
      typeName: string;
      mapperName: string;
      object: IntrospectedType;
    }>
  >();

  let collectTypes = async (i: {
    id: string;
    file: string;
    type: string;
    parts: string[];
    methodName: string;
    object: IntrospectedType;
  }) => {
    let typeName = Cases.toPascalCase([...i.parts, i.methodName, i.type].join('_'));
    let mapperName = Cases.toCamelCase(['map', ...i.parts, i.methodName, i.type].join('_'));

    if (!fileTypes.has(i.file)) {
      fileTypes.set(i.file, []);
    }
    fileTypes.get(i.file)!.push({
      id: i.id,
      typeName,
      mapperName,
      object: i.object
    });

    typeIdToName.set(i.id, { typeName, mapperName });
  };

  // Helper to determine Go package name from folder path
  let getGoPackageName = (folder: string): string => {
    let rel = path.relative(resourcesFolder, folder);
    if (rel === '' || rel === '.') return 'resources';
    // For nested packages, use the leaf folder name
    let parts = rel.split(path.sep);
    return parts[parts.length - 1];
  };

  let generateFileTypes = async (
    file: string,
    types: Array<{
      id: string;
      typeName: string;
      mapperName: string;
      object: IntrospectedType;
    }>
  ) => {
    if (types.length === 0) return;

    // Generate all types for this file
    let fileContent = '';

    // Add imports only once at the top
    if (language === 'python') {
      fileContent +=
        'from dataclasses import dataclass\nfrom typing import Any, Dict, List, Optional, Union\nfrom datetime import datetime\nimport dataclasses\n\n';
    } else if (language === 'typescript') {
      fileContent += `import { mtMap } from '@metorial/util-resource-mapper';\n\n`;
    } else if (language === 'go') {
      // For Go, generate type/mapper code first, then determine imports
      let dir = path.dirname(file);
      let pkgName = getGoPackageName(dir);

      let goBody = '';
      for (let typeInfo of types) {
        goBody += await typeModule.generateTypeFromIntrospectedType(
          typeInfo.typeName,
          typeInfo.object
        );
        goBody += await mapperModule.generateMapper(
          typeInfo.mapperName,
          typeInfo.typeName,
          typeInfo.object
        );
      }

      // Determine needed imports by inspecting the generated code
      let imports: string[] = [];
      if (goBody.includes('json.Unmarshal') || goBody.includes('json.Marshal')) {
        imports.push(`\t"encoding/json"`);
      }
      if (goBody.includes('time.Time')) {
        imports.push(`\t"time"`);
      }

      fileContent += `package ${pkgName}\n\n`;
      if (imports.length > 0) {
        fileContent += `import (\n${imports.join('\n')}\n)\n\n`;
      }
      fileContent += goBody;

      await fs.writeFile(file, fileContent);
      return;
    }

    // Generate all types and mappers
    for (let typeInfo of types) {
      fileContent += await typeModule.generateTypeFromIntrospectedType(
        typeInfo.typeName,
        typeInfo.object
      );
      fileContent += await mapperModule.generateMapper(
        typeInfo.mapperName,
        typeInfo.typeName,
        typeInfo.object
      );
    }

    await fs.writeFile(file, fileContent);
  };

  let seenFiles = new Set<string>();

  for (let endpoint of endpoints) {
    for (let epath of endpoint.allPaths) {
      // Keep kebab-case parts for type naming (preserves word boundaries for PascalCase)
      let kebabParts = epath.sdkPath.split('.').map(Cases.toKebabCase);

      let parts = [...kebabParts];
      if (language === 'python') {
        parts = parts.map(toPyFolderName);
      } else if (language === 'go') {
        parts = parts.map(toGoFolderName);
      }
      let methodName = parts.pop()!;
      let kebabMethodName = kebabParts.pop()!;

      // For type naming, use kebab-case parts so PascalCase conversion preserves word boundaries
      // (e.g., "provider-deployments" → "ProviderDeployments" instead of "providerdeployments" → "Providerdeployments")
      let typeNameParts = language === 'go' ? kebabParts : parts;
      let typeNameMethod = language === 'go' ? kebabMethodName : methodName;

      let folder = `${resourcesFolder}/${parts.join('/')}`;

      await fs.ensureDir(folder);

      let fileName = Cases.toKebabCase(methodName);
      if (language === 'python') {
        fileName = toPyFolderName(fileName);
      } else if (language === 'go') {
        fileName = Cases.toSnakeCase(kebabMethodName);
      }
      let file = `${folder}/${fileName}${fileExtension}`;

      await fs.ensureFile(file);

      if (!seenFiles.has(file)) {
        // File will be generated later with consolidated imports
      }

      seenFiles.add(file);

      await collectTypes({
        file,
        parts: typeNameParts,
        methodName: typeNameMethod,
        type: 'output',
        id: endpoint.outputId,
        object: types.find(t => t.id === endpoint.outputId)!.type
      });

      if (endpoint.bodyId) {
        await collectTypes({
          file,
          parts: typeNameParts,
          methodName: typeNameMethod,
          type: 'body',
          id: endpoint.bodyId,
          object: types.find(t => t.id === endpoint.bodyId)!.type
        });
      }

      if (endpoint.queryId) {
        await collectTypes({
          file,
          parts: typeNameParts,
          methodName: typeNameMethod,
          type: 'query',
          id: endpoint.queryId,
          object: types.find(t => t.id === endpoint.queryId)!.type
        });
      }

      for (let i = 1; i < parts.length; i++) {
        let part = parts.slice(0, i).join('/');
        resourceFolders.add(`${resourcesFolder}/${part}`);
      }

      resourceFolders.add(folder);
    }
  }

  // Generate all files with consolidated imports
  for (let [file, types] of fileTypes) {
    await generateFileTypes(file, types);
  }

  // Generate index files for TypeScript and Python (Go doesn't need them)
  if (language !== 'go') {
    for (let folder of [...resourceFolders, resourcesFolder]) {
      let files = (await fs.readdir(folder)).sort();
      let imports = files
        .map(file => {
          let name = file.replace(fileExtension, '');
          if (language === 'python') {
            return `from .${toPyIdentifier(name)} import *`;
          } else {
            return `export * from './${name}';`;
          }
        })
        .join('\n');

      let indexFile: string;
      if (language === 'typescript') {
        indexFile = `${folder}/index.ts`;
      } else if (language === 'python') {
        indexFile = path.join(folder, '__init__.py');
      } else {
        throw new Error(`Unsupported language: ${language}`);
      }

      await fs.writeFile(indexFile, imports);
    }
  }

  let endpointsDir = `${outputFolder}/endpoints`;

  await fs.ensureDir(endpointsDir);

  let resources = new Set<string>();
  for (let endpoint of endpoints) {
    for (let epath of endpoint.allPaths) {
      resources.add(epath.sdkPath.split('.').slice(0, -1).join('.'));
    }
  }

  for (let resource of resources) {
    let resourceParts = resource.split('.');
    if (resourceParts.length == 0) continue;

    let resourceEndpoints = endpoints
      .map(e => {
        let p = e.allPaths.find(
          p =>
            matchesResourcePath(p.sdkPath, resource) &&
            p.sdkPath.split('.').length === resourceParts.length + 1
        );
        if (!p) return undefined!;

        return {
          ...e,
          path: p
        };
      })
      .filter(Boolean);

    if (!resourceEndpoints.length) continue;

    let controller = controllers.find(c => c.id == resourceEndpoints[0].controllerId);
    if (!controller) continue;

    let controllerKebabPath = resourceParts.map(Cases.toKebabCase);
    let controllerPath = [...controllerKebabPath];
    if (language === 'python') {
      controllerPath = controllerPath.map(toPyFolderName);
    } else if (language === 'go') {
      controllerPath = controllerPath.map(toGoFolderName);
    }

    let typeDefinitions = new Map<string, IntrospectedType>();
    for (let fileTypeArray of fileTypes.values()) {
      for (let typeInfo of fileTypeArray) {
        typeDefinitions.set(typeInfo.id, typeInfo.object);
      }
    }

    let source = await endpointModule.createController({
      endpoints: resourceEndpoints,
      controller,
      path: controllerPath,
      // For Go, pass kebab-case path so PascalCase names have correct word boundaries
      namePath: language === 'go' ? controllerKebabPath : controllerPath,
      typeIdToName,
      types
    });

    let fileNameParts = resourceParts.map(Cases.toKebabCase);
    if (language === 'python') {
      fileNameParts = fileNameParts.map(toPyFolderName);
    } else if (language === 'go') {
      fileNameParts = fileNameParts.map(Cases.toSnakeCase);
    }
    let file = `${endpointsDir}/${fileNameParts.join('_')}${fileExtension}`;

    await fs.writeFile(file, source);
  }

  // For Go, generate management endpoints into a separate package
  if (language === 'go' && goManagementEndpoints.length > 0) {
    let mgmtEndpointsDir = `${outputFolder}/endpoints/management`;
    await fs.ensureDir(mgmtEndpointsDir);
    await fs.emptyDir(mgmtEndpointsDir);

    // Collect management resource types into typeIdToName (they share IDs with public types)
    // The sdkPaths have already been rewritten to strip management.instance. prefix,
    // so resource files/types are shared with the public resource packages.

    let mgmtResources = new Set<string>();
    for (let endpoint of goManagementEndpoints) {
      for (let epath of endpoint.allPaths) {
        mgmtResources.add(epath.sdkPath.split('.').slice(0, -1).join('.'));
      }
    }

    for (let resource of mgmtResources) {
      let resourceParts = resource.split('.');
      if (resourceParts.length == 0) continue;

      let resourceEndpoints = goManagementEndpoints
        .map(e => {
          let p = e.allPaths.find(
            p =>
              matchesResourcePath(p.sdkPath, resource) &&
              p.sdkPath.split('.').length === resourceParts.length + 1
          );
          if (!p) return undefined!;
          return { ...e, path: p };
        })
        .filter(Boolean);

      if (!resourceEndpoints.length) continue;

      let controller = controllers.find(c => c.id == resourceEndpoints[0].controllerId);
      if (!controller) continue;

      let controllerKebabPath = resourceParts.map(Cases.toKebabCase);
      let controllerPath = controllerKebabPath.map(toGoFolderName);

      let source = await endpointModule.createController({
        endpoints: resourceEndpoints,
        controller,
        path: controllerPath,
        namePath: controllerKebabPath,
        typeIdToName,
        types
      });

      // Replace package declaration: management endpoints use package "management"
      source = source.replace(/^package endpoints/, 'package management');

      let fileNameParts = resourceParts.map(Cases.toSnakeCase);
      let file = `${mgmtEndpointsDir}/${fileNameParts.join('_')}${fileExtension}`;

      await fs.writeFile(file, source);
    }
  }

  // Generate index/init files for endpoints
  if (language !== 'go') {
    let endpointsFiles = (await fs.readdir(endpointsDir)).filter(f => f.endsWith(fileExtension));
    let endpointsIndexContent = endpointsFiles
      .filter(file => {
        // Exclude index.ts or __init__.py itself
        if (language === 'typescript') return file !== 'index.ts';
        if (language === 'python') return file !== '__init__.py';
        return true;
      })
      .map(file => {
        let name = file.replace(fileExtension, '');
        if (language === 'python') {
          return `from .${toPyIdentifier(name)} import *`;
        } else {
          return `export * from './${name}';`;
        }
      })
      .join('\n');

    if (language === 'typescript') {
      await fs.writeFile(`${endpointsDir}/index.ts`, endpointsIndexContent);
    } else if (language === 'python') {
      await fs.writeFile(path.join(endpointsDir, '__init__.py'), endpointsIndexContent);
    }
  }

  if (language === 'python') {
    // Generate comprehensive type exports for the generated package
    let typeExports = generateTypeExports(typeIdToName, version.version);

    await fs.writeFile(
      `${outputFolder}/__init__.py`,
      `from .resources import *\nfrom .endpoints import *\n\n# Type exports for better discoverability\n${typeExports}`
    );

    // Also update the main public API to include generated types
    await updateMainPublicAPI(typeIdToName, version.version, rootOutputFolder);
  } else if (language === 'typescript') {
    await fs.writeFile(
      `${outputFolder}/index.ts`,
      "export * from './resources';\nexport * from './endpoints';\n"
    );
  }

  // For Go, run go fmt on all generated files
  if (language === 'go') {
    let { execSync } = await import('child_process');
    try {
      execSync(`gofmt -w "${outputFolder}/resources" "${outputFolder}/endpoints"`, {
        stdio: 'inherit'
      });
    } catch (e) {
      console.warn('Warning: gofmt failed:', e);
    }
  }
}
