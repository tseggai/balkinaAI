// SDK 52+ auto-configures Metro for monorepos — no manual setup needed
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
