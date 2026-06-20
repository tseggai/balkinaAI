// Dynamic Expo config. Reads the base app.json and, when APP_VARIANT is set,
// merges the matching white-label property variant from ./white-label/<variant>.json.
// This is what injects `extra.propertySlug` so the customer app boots into the
// branded property storefront — and it works in Expo Go (`expo start`) as well
// as EAS builds, since both honour the APP_VARIANT environment variable:
//
//   APP_VARIANT=portonovi npx expo start
//   APP_VARIANT=portonovi eas build --profile production --platform ios
//
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT;
  if (!variant) return config;

  const variantPath = path.join(__dirname, 'white-label', `${variant}.json`);
  if (!fs.existsSync(variantPath)) {
    console.warn(`[app.config] white-label variant not found: ${variantPath} — using base config`);
    return config;
  }

  const wl = JSON.parse(fs.readFileSync(variantPath, 'utf8'));

  // Only override icon/splash if the referenced asset actually exists, so a
  // variant that hasn't shipped art yet still runs (important for Expo Go).
  const assetExists = (p) => p && fs.existsSync(path.join(__dirname, p));

  return {
    ...config,
    name: wl.appName || config.name,
    scheme: wl.scheme || config.scheme,
    ...(assetExists(wl.iconPath) ? { icon: wl.iconPath } : {}),
    ...(assetExists(wl.splashPath)
      ? {
          splash: {
            ...config.splash,
            image: wl.splashPath,
            // 'cover' lets a property ship a full-bleed loading image; 'contain'
            // (the default) centres a logo on the background colour.
            resizeMode: wl.splashResizeMode || config.splash?.resizeMode || 'contain',
            backgroundColor: wl.splashBackgroundColor || wl.backgroundColor || wl.primaryColor || config.splash?.backgroundColor,
          },
        }
      : {}),
    ios: { ...config.ios, ...(wl.bundleId ? { bundleIdentifier: wl.bundleId } : {}) },
    android: { ...config.android, ...(wl.androidPackage ? { package: wl.androidPackage } : {}) },
    extra: {
      ...config.extra,
      propertySlug: wl.propertySlug,
      propertyName: wl.appName,
      primaryColor: wl.primaryColor,
      // Remote URL for the full-bleed in-app boot loader (set to the property's
      // splash_image_url so the loading screen matches the portal upload).
      splashImageUrl: wl.splashImageUrl,
    },
  };
};
