#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const variant = process.argv[2];
if (!variant) {
  console.error('Usage: node white-label/generate.js <property-slug>');
  process.exit(1);
}

const configPath = path.join(__dirname, `${variant}.json`);
if (!fs.existsSync(configPath)) {
  console.error(`Config not found: ${configPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const baseApp = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'));

const whiteLabel = {
  expo: {
    ...baseApp.expo,
    name: config.appName,
    slug: `balkina-${config.propertySlug}`,
    scheme: config.scheme || config.propertySlug,
    icon: config.iconPath || baseApp.expo.icon,
    splash: {
      ...baseApp.expo.splash,
      image: config.splashPath || baseApp.expo.splash.image,
      backgroundColor: config.primaryColor || baseApp.expo.splash.backgroundColor,
    },
    ios: {
      ...baseApp.expo.ios,
      bundleIdentifier: config.bundleId,
    },
    android: {
      ...baseApp.expo.android,
      package: config.androidPackage,
    },
    extra: {
      ...baseApp.expo.extra,
      propertySlug: config.propertySlug,
      propertyName: config.appName,
      primaryColor: config.primaryColor,
    },
  },
};

const outputPath = path.join(__dirname, '..', 'app.whitelabel.json');
fs.writeFileSync(outputPath, JSON.stringify(whiteLabel, null, 2));
console.log(`Generated ${outputPath} for ${config.appName}`);
console.log(`Bundle ID: ${config.bundleId}`);
console.log(`Scheme: ${whiteLabel.expo.scheme}`);
