# White-Label Builds

## How to create a branded app for a property

### 1. Create the property in the database
Use the admin panel or SQL to create a `properties` row with branding details.

### 2. Create a config file
Copy `white-label/template.json` and customize:

```bash
cp white-label/template.json white-label/porto-montenegro.json
```

Edit the values (name, slug, colors, bundle ID, etc.)

### 3. Generate the app.json override
```bash
node white-label/generate.js porto-montenegro
```

This creates `app.whitelabel.json` which overrides the default `app.json`.

### 4. Build
```bash
EXPO_NO_CAPABILITY_SYNC=1 APP_VARIANT=porto-montenegro eas build --profile production --platform ios
```

### 5. Submit to App Store
```bash
eas submit --platform ios
```

The property gets its own App Store listing with their branding.
