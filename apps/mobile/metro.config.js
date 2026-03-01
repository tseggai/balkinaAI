const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so hoisted deps are visible
config.watchFolders = [monorepoRoot];

// Ensure mobile-local react (19.1) is resolved instead of hoisted react (18.x)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Force critical packages to resolve from the mobile workspace
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  '@types/react': path.resolve(projectRoot, 'node_modules/@types/react'),
};

module.exports = config;
