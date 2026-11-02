# Agent Guidelines for Skywatch

This document provides guidelines for AI coding agents working in the Skywatch codebase.

## Project Overview

Skywatch is a hybrid mobile weather dashboard built with Capacitor (iOS/Android/Web) that scrapes real-time weather data from the CU Boulder ATOC weather station. The codebase is intentionally minimal (~450 lines) with a single-file frontend architecture.

### Architecture

**Dual-Mode Hybrid Architecture:**
- **Mobile Apps (iOS/Android)**: Standalone apps that scrape weather data directly (no backend needed)
- **Web Browser**: Uses backend API to avoid CORS restrictions during development
- **Backend (server.js)**: Express server for web development only (optional for mobile)

**How it works:**

**Mobile (Standalone Mode):**
```javascript
if (Capacitor.isNativePlatform()) {
    // Direct scraping - no CORS restrictions on native platforms
    fetch('https://sundowner.colorado.edu/weather/atoc8/')
    // Parse HTML with DOMParser
    // Store in localStorage
}
```

**Web Browser (Development Mode):**
```javascript
else {
    // Use backend API to avoid CORS
    fetch('http://localhost:3000/api/weather')
    // Display data from backend
}
```

### Data Persistence & History

**1. Backend (server.js):**
- **Live Log:** `weather_log.json` (Main source for dashboard)
- **Daily Archive:** `history/weather_YYYY-MM-DD.json` (Permanent storage)
- **Public Feed:** `public_feed/latest_24h.json` (Fixed file for sharing)

**2. Frontend:**
- **Charts:** Displays last 288 data points (24 hours)
- **Import:** Can load external JSON files via Data Menu
- **URL Load:** Can fetch data from public OneDrive links

**3. iOS Widget:**
- Uses App Groups to share data between Main App and Widget Extension
- Updates via Background App Refresh (BGAppRefreshTask)

**Why this architecture?**
- **Mobile apps are fully standalone** - no server required, scrape directly from weather station
- **No CORS issues on mobile** - native apps don't have browser CORS restrictions
- **Web development uses backend** - avoids CORS during testing in browser
- **localStorage caching** - works offline with cached data
- **Best of both worlds** - standalone mobile + convenient web development

## Build, Lint, and Test Commands

### Development
```bash
npm run dev              # Start Vite dev server at http://localhost:5173
npm start                # Start Express scraper backend on port 3000
```

**Note on Runtime:** This project supports both **Node.js** and **Bun**.
- If using Bun, replace `npm` with `bun` (e.g., `bun install`, `bun run dev`).
- `package.json` scripts are compatible with both.

### Build
```bash
npm run build            # Build for production to dist/
npm run preview          # Preview production build locally
```

### Mobile Development
```bash
npm run build            # Build web assets first (required)
npx cap sync            # Sync web assets to native projects
npx cap open ios        # Open project in Xcode
npx cap open android    # Open project in Android Studio
```

### Testing
**No test framework is currently configured.** The project uses manual testing.

If tests are added in the future (recommended: Vitest), use:
```bash
npm test                      # Run all tests
npm test -- filename.test.js  # Run single test file
npm test -- -t "test name"    # Run specific test by name
```

### Linting & Formatting
**No linting or formatting tools are currently configured.** Consider adding ESLint and Prettier if modifying code extensively.

## Code Style Guidelines

### Language and Module System

- **Language**: JavaScript (ES6+), no TypeScript
- **Frontend**: ES modules (`import/export`) via Vite bundler
- **Backend**: CommonJS (`require/module.exports`) - package.json has `"type": "commonjs"`
- **No mixing**: Keep frontend ES modules, backend CommonJS

### File Naming Conventions

- **JavaScript files**: camelCase (main.js, server.js)
- **Config files**: kebab-case (vite.config.js, capacitor.config.json)
- **Follow existing patterns** in the project

### Variable Declarations

- **Use `const`** for all constants and immutable bindings (preferred)
- **Use `let`** for variables that will be reassigned
- **Never use `var`** (legacy ES5 pattern)

### Naming Conventions

```javascript
// Functions and variables: camelCase
const fetchWeatherData = async () => {};
let tempChart, windChart;
const weatherData = { ... };

// Constants: UPPER_SNAKE_CASE
const TARGET_URL = 'https://example.com';
const HISTORY_KEY = 'weather_history';
const DATA_FILE = 'weather_log.json';
```

### Function Patterns

- **Prefer arrow functions** for most function declarations
- **Use `async/await`** for asynchronous operations (no `.then()` chains)
- **Function expressions** over function declarations

```javascript
// Preferred
const updateData = async () => {
    const data = await fetchWeatherData();
    // ...
};

// Avoid
function updateData() {
    fetchWeatherData().then(data => { ... });
}
```

### Import/Export Patterns

**Frontend (src/main.js) - ES Modules:**
```javascript
import { Capacitor } from '@capacitor/core';
import { Chart, registerables } from 'chart.js';
// Use named imports with destructuring
```

**Backend (server.js) - CommonJS:**
```javascript
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
```

### Error Handling

- **Always use try-catch** for async operations and operations that may fail
- **Log errors** with `console.error()` for debugging
- **Throw descriptive errors** with context about what failed
- **Implement graceful degradation** when possible (fallback to cached data)

```javascript
try {
    const newData = await fetchWeatherData();
    if (!newData.temperature) {
        throw new Error("Could not parse temperature");
    }
    // ... process data
} catch (e) {
    console.error("Scrape Error:", e);
    // Fallback: load cached history
    const history = getHistory();
    if (history.length > 0) {
        updateUI(history[history.length - 1], history);
    }
}
```

### Code Organization

1. **Import statements first** at the top of file
2. **Constants** immediately after imports (UPPER_SNAKE_CASE)
3. **Helper functions** before main logic
4. **Main logic functions** in logical order
5. **Initialization code** at the bottom (DOMContentLoaded, etc.)

**Use section comments** to organize code:
```javascript
// --- Storage Helper ---
// --- Scraper Logic ---
// --- API Endpoints ---
```

### Comments

- **Section headers** with `// ---` dashes for major sections
- **Inline comments** for clarifications and complex logic
- **TODO comments** for future improvements
- **Avoid obvious comments** (don't state what code clearly does)

### Type Annotations

**No TypeScript is used.** Do not add JSDoc type annotations unless explicitly requested.

For validation, use runtime checks:
```javascript
if (!data.temperature) throw new Error("Missing temperature data");
```

### Data Persistence

**Frontend:**
- Use `localStorage` with key `'weather_history'`
- JSON serialize/deserialize: `JSON.stringify()` / `JSON.parse()`
- Limit to 2000 entries max (call `.shift()` to remove oldest)

**Backend:**
- Use file system: `fs.readFileSync` / `fs.writeFileSync`
- File: `weather_log.json` in project root
- Pretty-print with 2-space indentation: `JSON.stringify(data, null, 2)`
- Limit to 2000 entries max

### API Conventions

**Endpoints (server.js):**
```javascript
GET  /api/weather        // Returns { latest: {...}, history: [...] }
GET  /api/history        // List available daily archives
GET  /api/history/:date  // Get specific day's data
POST /api/refresh        // Triggers scrape, returns updated data
```

**Response format:**
```json
{
  "latest": { "timestamp": "...", "temperature": "...", ... },
  "history": [ {...}, {...}, ... ]
}
```

### UI/Styling

- **Tailwind CSS** via CDN for utility classes
- **Custom CSS** in `<style>` tags for complex components
- **Chart.js** for data visualization
- **Responsive design**: Use `maintainAspectRatio: false` for charts

### Version Control

⚠️ **Note**: This project does not currently have Git initialized. If you need to commit changes, initialize git first:
```bash
git init
# Create .gitignore with: node_modules/, dist/, weather_log.json, .DS_Store
git add .
git commit -m "Initial commit"
```

## Critical Don'ts

1. **Don't add TypeScript** - Keep it pure JavaScript
2. **Don't change module systems** - Frontend stays ES modules, backend stays CommonJS
3. **Don't add heavy dependencies** - Keep bundle size small for mobile
4. **Don't use synchronous operations in hot paths** - Except file I/O in server.js (acceptable)
5. **Don't break mobile compatibility** - Always test on Capacitor platforms
6. **Don't commit secrets** - No API keys or credentials (currently none in use)
7. **Don't remove error handling** - Graceful degradation is critical for this app

## Best Practices

- **Minimize bundle size** - This is a mobile app; small bundles = fast load times
- **Preserve existing patterns** - Match the style of surrounding code
- **Test on multiple platforms** - Web, iOS, and Android if making platform-specific changes
- **Handle network failures gracefully** - Weather scraping can fail; always have fallbacks
- **Validate scraped data** - Check for null/undefined before using data
- **Prevent duplicate entries** - Check timestamp before adding to history
- **Keep history bounded** - Never exceed 2000 entries in storage

## Common Tasks

### Adding a new weather metric
1. Update scraper in **both** `server.js` (backend) and `src/main.js` (mobile scraping)
2. Add to data object with descriptive key (camelCase)
3. Update UI in `updateUI()` function in `src/main.js`
4. Add display element in `index.html`

### Modifying scraping logic
1. **Backend scraping**: Modify `server.js` - uses Cheerio selectors on HTML (for web browser)
2. **Mobile scraping**: Modify `fetchWeatherDirect()` in `src/main.js` - uses DOMParser (for iOS/Android)
3. Target URL is `https://sundowner.colorado.edu/weather/atoc8/`
4. Always validate data before storing
5. Handle parsing errors gracefully
6. **Dual-mode**: Changes must be synchronized between backend and mobile scraping code

### Frontend Architecture (Dual-Mode)
- **Mobile**: `Capacitor.isNativePlatform() === true` → Direct scraping with DOMParser
- **Web**: `Capacitor.isNativePlatform() === false` → Fetch from backend API
- `fetchWeatherData()` automatically detects platform and uses appropriate method
- Refresh button triggers `POST /api/refresh` for web, direct scrape for mobile
- All modes cache data in localStorage for offline support

### Debugging mobile issues
1. Use `npx cap sync` after any web asset changes
2. Check Xcode/Android Studio console logs
3. Test CORS handling for native fetch vs web fetch
4. Verify Capacitor plugin compatibility

### Common Errors & Fixes

**"require is not defined" (ES Module Error)**
- **Cause:** Project is `"type": "module"`, but code uses `require()`.
- **Fix:** Convert `require()` to `import` statements.
  ```javascript
  // Bad
  const express = require('express');
  
  // Good
  import express from 'express';
  import { fileURLToPath } from 'url';
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  ```

## Project-Specific Notes

- **Weather source**: CU Boulder ATOC weather station (sundowner.colorado.edu)
- **Scrape interval**: Every 5 minutes (300000ms)
- **History limit**: 2000 entries max (frontend and backend)
- **Chart range**: Last 100 entries displayed
- **No authentication**: Public weather data, no API keys needed
- **Offline support**: Falls back to localStorage cache when scraping fails

## References

- [README.md](README.md) - Full project documentation
- [Capacitor Docs](https://capacitorjs.com/docs) - Mobile platform documentation
- [Chart.js Docs](https://www.chartjs.org/docs) - Charting library
- [Vite Docs](https://vite.dev) - Build tool documentation

---

**Last Updated**: 2026-01-26  
**Codebase Size**: ~450 lines (main.js: 224, server.js: 124, index.html: 104)
