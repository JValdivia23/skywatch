# iOS Widget & Background Refresh Setup Guide

## 📋 OVERVIEW

This guide walks you through setting up:
1. **Background App Refresh** - Updates weather data every 15-30 minutes in the background
2. **Home Screen Widget** - Medium-sized widget showing temperature + trend chart
3. **App Groups** - Data sharing between app and widget

**Estimated Time:** 30-45 minutes

---

## 🚀 PHASE 1: Open Project in Xcode

```bash
npx cap open ios
```

This opens `ios/App/App.xcodeproj` in Xcode.

---

## 🔧 PHASE 2: Enable Background Capabilities

### Step 1: Select Project Settings
1. In Xcode Project Navigator (left sidebar), click on **"App"** (blue icon at top)
2. Select the **"App"** target (under TARGETS)
3. Click **"Signing & Capabilities"** tab

### Step 2: Add Background Modes Capability
1. Click **"+ Capability"** button (top left of main panel)
2. Search for **"Background Modes"**
3. Double-click to add it

4. In the Background Modes section, check:
   - ✅ **Background fetch**
   - ✅ **Background processing**

### Step 3: Verify Info.plist
The Info.plist should already have these keys (we added them earlier):
- `UIBackgroundModes` with values: `fetch`, `processing`
- `BGTaskSchedulerPermittedIdentifiers` with value: `com.skywatch.app.refresh`

If not visible in Xcode, that's fine - the file has them.

---

## 📦 PHASE 3: Create App Group

App Groups allow the main app and widget to share data.

### Step 1: Enable App Groups for Main App
1. Still in **"Signing & Capabilities"** tab for **App** target
2. Click **"+ Capability"** → Search for **"App Groups"**
3. Double-click to add it

4. Click the **"+"** button in the App Groups section
5. Enter: `group.com.skywatch.app`
6. Click **OK**

### Step 2: Test App Build
1. Press **Cmd + B** to build
2. Should compile successfully with no errors
3. If you see signing errors, configure your Team in "Signing & Capabilities"

---

## 🎨 PHASE 4: Create Widget Extension

### Step 1: Add New Target
1. In Xcode menu: **File** → **New** → **Target...**
2. In the template chooser:
   - Platform: **iOS**
   - Filter: Type "widget"
   - Select **"Widget Extension"**
   - Click **Next**

### Step 2: Configure Widget Target
- **Product Name:** `SkyWatchWidget` (exactly this name)
- **Team:** Select your team
- **Organization Identifier:** `com.skywatch` (should match app)
- **Bundle Identifier:** Will be `com.skywatch.app.SkyWatchWidget`
- **Project:** App
- **Embed in Application:** App
- **Include Configuration Intent:** ❌ Uncheck (we don't need it)

Click **Finish**

### Step 3: Activate Scheme
- A popup will ask: **"Activate 'SkyWatchWidget' scheme?"**
- Click **Activate** (you can switch back to App scheme later)

---

## 📝 PHASE 5: Replace Widget Code

### Step 1: Delete Default Files
In Project Navigator, expand **SkyWatchWidget** folder, you'll see:
- `SkyWatchWidget.swift` (default generated file)
- `Assets.xcassets`
- `Info.plist`

**Delete** the generated `SkyWatchWidget.swift` file (Move to Trash)

### Step 2: Add Our Widget Code
1. Right-click on **SkyWatchWidget** folder → **Add Files to "App"...**
2. Navigate to: `ios/SkyWatchWidget/SkyWatchWidget.swift` (the file we created earlier)
3. **IMPORTANT:** 
   - ✅ Check **"Copy items if needed"**
   - ✅ Check **SkyWatchWidget** target (not App target)
4. Click **Add**

Alternatively, you can drag the file from Finder into the SkyWatchWidget folder in Xcode.

### Step 3: Verify File Target
1. Click on `SkyWatchWidget.swift` in Project Navigator
2. In the right sidebar (File Inspector), check **Target Membership**
3. Ensure **SkyWatchWidget** is checked ✅
4. Ensure **App** is NOT checked ❌

---

## 🔐 PHASE 6: Configure Widget App Group

### Step 1: Enable App Group for Widget
1. Select **SkyWatchWidget** target (not App target)
2. Go to **"Signing & Capabilities"** tab
3. Click **"+ Capability"** → **"App Groups"**
4. Click **"+"** and enter: `group.com.skywatch.app` (same as main app)
5. Click **OK**

**CRITICAL:** Both the main app AND the widget must use the same App Group identifier!

### Step 2: Verify Both Targets Have App Group
- **App** target → Signing & Capabilities → App Groups → ✅ `group.com.skywatch.app`
- **SkyWatchWidget** target → Signing & Capabilities → App Groups → ✅ `group.com.skywatch.app`

---

## 🏗️ PHASE 7: Build & Test

### Step 1: Build Widget Extension
1. Select **SkyWatchWidget** scheme (top toolbar, left of device selector)
2. Select **iPhone Simulator** as device
3. Press **Cmd + B** to build

**Expected:** Should compile successfully!

**If you get errors:**
- Check that widget target has App Group enabled
- Check that `SkyWatchWidget.swift` is in the right target
- Try cleaning build folder: **Product** → **Clean Build Folder** (Cmd + Shift + K)

### Step 2: Build Main App
1. Switch to **App** scheme (top toolbar)
2. Press **Cmd + B** to build

Should compile successfully!

### Step 3: Run Main App
1. With **App** scheme selected
2. Press **Cmd + R** or click **Play ▶️**
3. App should launch in simulator
4. Wait for weather data to load
5. Weather data will be saved to App Group automatically

### Step 4: Add Widget to Home Screen (Simulator)
1. While simulator is running, click **Home button** or press **Cmd + Shift + H**
2. Long-press on empty area of home screen
3. Click **"+"** button (top left)
4. Search for **"Skywatch"** or scroll to find it
5. Select **"Skywatch"**
6. Choose **Medium** size
7. Click **"Add Widget"**

**Expected:** Widget appears showing current weather data!

---

## 🧪 PHASE 8: Test Background Refresh

### Method 1: Simulate Background Refresh in Simulator
1. In Xcode, while app is running: **Debug** → **Simulate Background Fetch**
2. Check Xcode console logs - should see:
   ```
   🔄 Skywatch: Background refresh started
   ✅ Skywatch: Weather data updated in background
   💾 Skywatch: Weather data saved to App Group for widget
   ```

### Method 2: Test on Physical Device
Background refresh works better on real devices:

1. Connect iPhone via USB
2. Select your iPhone as target device
3. Run the app
4. Use the app for a minute, then press Home button
5. Wait 15-30 minutes
6. Check widget - should show updated data

**Note:** iOS decides when to run background tasks. It may not happen exactly at 15 minutes.

### Method 3: Force Background Update (Advanced)
1. Go to iPhone Settings → Developer → Background Fetch (need Xcode/dev mode)
2. Can manually trigger background tasks

---

## 🎯 EXPECTED BEHAVIOR

### Main App:
- ✅ Launches and shows weather data
- ✅ Updates every 5 minutes while open
- ✅ Saves data to App Group when updated
- ✅ Schedules background refresh when closed

### Widget:
- ✅ Shows current temperature (large number)
- ✅ Shows mini trend chart (last 12 data points)
- ✅ Shows wind speed and humidity
- ✅ Shows last update timestamp
- ✅ Updates when main app updates
- ✅ Shows "⚠️ Stale" if data is >1 hour old

### Background Refresh:
- ✅ Runs every 15-30 minutes (iOS permitting)
- ✅ Fetches new weather data
- ✅ Updates widget automatically
- ✅ Works even when app is closed

---

## 📊 WIDGET DESIGN

### Medium Widget Layout:
```
┌─────────────────────────────────────┐
│ ☁️                    Trend (12h)   │
│                        ╱╲            │
│                       ╱  ╲           │
│ 42.7°F               ╱    ╲_        │
│                                      │
│ Wind: 7.0 mph   Humid: 15%          │
│                                      │
│ 1/26/26 5:00p          CU Boulder    │
└─────────────────────────────────────┘
```

**Colors:**
- Background: Black (#1A1A1A) → Dark Gray (#2A2A2A) gradient
- Primary text: White
- Temperature: White, large & bold
- Accent: CU Gold (#CFB87C)
- Chart: Gold line with gradient fill

---

## ⚠️ TROUBLESHOOTING

### Widget Shows "No data"
1. Run main app first to fetch weather data
2. Check Xcode console for "💾 Skywatch: Weather data saved to App Group"
3. Verify both targets have same App Group: `group.com.skywatch.app`
4. Remove and re-add widget to home screen

### Background Refresh Not Working
1. Check Settings → General → Background App Refresh → ON
2. Check Settings → Skywatch → Background App Refresh → ON
3. iOS may delay/skip background tasks if battery is low
4. Try "Debug → Simulate Background Fetch" in Xcode

### Build Errors
1. Clean build folder: **Product** → **Clean Build Folder**
2. Delete **DerivedData**: Xcode → Preferences → Locations → Derived Data → Delete
3. Restart Xcode
4. Make sure both targets are signed with same Team

### Widget Not Appearing in Widget Gallery
1. Build and run the widget extension scheme (not just the app)
2. Widget might take a minute to appear after first build
3. Restart simulator/device
4. Uninstall app and reinstall

---

## 🎉 SUCCESS CHECKLIST

- [ ] App builds without errors
- [ ] Widget extension builds without errors
- [ ] App launches and shows weather data
- [ ] Weather data appears in widget
- [ ] Widget shows temperature + mini chart
- [ ] Background refresh can be simulated
- [ ] App Group properly configured
- [ ] Widget updates when app updates

---

## 📱 USING ON REAL DEVICE

To test on your iPhone:

1. **Connect iPhone** via USB
2. **Trust computer** on iPhone if prompted
3. **Select iPhone** as target device in Xcode
4. **Configure signing:**
   - Select App target → Signing & Capabilities
   - Choose your Apple ID under "Team"
   - Do the same for SkyWatchWidget target
5. **Build and Run** (Cmd + R)
6. **Trust developer** on iPhone: Settings → General → VPN & Device Management

Then add widget to home screen and test!

---

## 🔄 SYNC TO REPOSITORY

The changes we made are:
- ✅ `ios/App/App/Info.plist` - Background modes config
- ✅ `ios/App/App/AppDelegate.swift` - Background refresh logic
- ✅ `ios/SkyWatchWidget/SkyWatchWidget.swift` - Widget code

All files are in your OneDrive folder and will sync automatically.

To use on another Mac:
1. Copy project folder from OneDrive
2. Run `npm install`
3. Open in Xcode: `npx cap open ios`
4. Follow PHASE 4 steps to add Widget Extension target (Xcode doesn't sync targets)
5. Add the Swift file to the target

---

## 📞 NEXT STEPS

1. Test the widget on Simulator
2. Test background refresh
3. Deploy to physical iPhone
4. Enjoy your standalone weather app with home screen widget! 🌤️

If you encounter any issues, check the Xcode console for detailed logs with emoji indicators (🔄 ✅ ❌ 💾).
