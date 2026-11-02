# App Icon Setup Instructions

## Creating the App Icon (1024x1024 PNG)

Since the SVG logo has been created at `public/logo.svg`, you need to create a 1024x1024 PNG for iOS/Android app icons.

### Option 1: Using macOS Preview (Easiest)
1. Open `public/logo.svg` in Safari or Chrome
2. Take a screenshot or export as image
3. Open in Preview → Tools → Adjust Size → 1024x1024 pixels
4. Export as PNG

### Option 2: Using Online Tool
1. Go to https://cloudconvert.com/svg-to-png
2. Upload `public/logo.svg`
3. Set dimensions to 1024x1024
4. Download the PNG

### Option 3: Using Xcode (After we add the icon)
1. Open the project in Xcode: `npx cap open ios`
2. In Project Navigator, select `App` → `Assets.xcassets` → `AppIcon`
3. Drag and drop a 1024x1024 PNG into the "App Store iOS" slot
4. Xcode will automatically generate all required sizes

## Icon Design Specifications

**Current Logo Features:**
- CU Boulder gold/black color scheme (#CFB87C gold, #1A1A1A black)
- Cloud icon with rain drops (weather theme)
- "Skywatch" text with "CU Boulder ATOC" subtitle
- Clean, modern design

**Icon Requirements:**
- Size: 1024x1024 pixels
- Format: PNG (no transparency for iOS)
- Background: White or light gray recommended
- Content: The cloud logo should be centered and sized appropriately

## Applying the Icon

### iOS
After creating icon-1024.png:
```bash
# Copy to iOS assets (we'll automate this with a script)
cp public/icon-1024.png ios/App/App/Assets.xcassets/AppIcon.appiconset/
```

Then in Xcode:
1. Open `ios/App/App.xcodeproj`
2. Select App → Assets.xcassets → AppIcon
3. The icon should appear in all slots

### Android  
```bash
# Use Android Asset Studio or copy manually
# Android uses multiple sizes: 48dp, 72dp, 96dp, 144dp, 192dp, 512dp
```

## For Now
The web version will show the SVG logo. Once you create the PNG icon, we can add it to the native apps.

**Next Steps:**
1. Create icon-1024.png using one of the methods above
2. Place it in `public/` folder
3. We'll configure it in Xcode during the widget setup
