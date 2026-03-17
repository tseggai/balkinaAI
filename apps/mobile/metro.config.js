// SDK 52+ auto-detects monorepo and configures watchFolders + nodeModulesPaths
const { getDefaultConfig } = require('expo/metro-config');
module.exports = getDefaultConfig(__dirname);
