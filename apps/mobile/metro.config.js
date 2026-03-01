const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so hoisted deps are visible
config.watchFolders = [monorepoRoot];

// Search mobile's node_modules first (React 19), then root (shared deps)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// In this monorepo, React 18 is hoisted to root (for web/admin) while mobile
// needs React 19.1.0 (for RN 0.81 / Expo SDK 54). Force 'react' imports to
// resolve from mobile's local node_modules where React 19 is installed.
const mobileModules = path.resolve(projectRoot, 'node_modules');
const allModulePaths = [mobileModules, path.resolve(monorepoRoot, 'node_modules')];
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Only redirect bare 'react' and 'react/...' imports — these are the ones
  // that conflict between React 18 (root) and React 19 (mobile).
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    const newContext = {
      ...context,
      nodeModulesPaths: [mobileModules],
    };
    if (originalResolveRequest) {
      return originalResolveRequest(newContext, moduleName, platform);
    }
    return context.resolveRequest(newContext, moduleName, platform);
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
