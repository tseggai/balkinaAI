const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so hoisted deps are visible
config.watchFolders = [monorepoRoot];

// Search mobile's node_modules first, then root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Force react to resolve from mobile workspace (React 19.1) instead of
// hoisted root (React 18). This must use resolveRequest because
// extraNodeModules is only a fallback and doesn't override normal resolution.
const mobileReactPath = path.resolve(projectRoot, 'node_modules/react');
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirect all 'react' and 'react/...' imports to mobile's React 19.1
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    const newContext = {
      ...context,
      nodeModulesPaths: [path.resolve(projectRoot, 'node_modules')],
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
