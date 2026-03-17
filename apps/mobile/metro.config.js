const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Monorepo root (two levels up from apps/mobile)
const monorepoRoot = path.resolve(__dirname, '../..');

const config = getDefaultConfig(__dirname);

// Ensure Metro watches the entire monorepo for changes
config.watchFolders = [monorepoRoot];

// Resolve packages from both the mobile app's node_modules
// and the monorepo root's node_modules (hoisted deps)
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
