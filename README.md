# Skywatch

A weather dashboard for the University of Colorado Boulder ATOC station at SEEC, using observations from the [Sundowner station page](https://sundowner.colorado.edu/weather/atoc8/). Skywatch combines a small JavaScript frontend with an Express scraper for browser use and Capacitor projects for iOS and Android.

## Features

- Current temperature, dewpoint, humidity, pressure, wind speed, gusts, wind direction, and rainfall.
- Temperature and wind charts showing the latest 288 observations, approximately 24 hours at five-minute intervals.
- Wind direction arrows with adjustable chart density.
- Automatic refresh every five minutes while the dashboard is open, plus a manual **Update** button.
- Local caching to display previously fetched observations when a request fails.
- A **Data Sources** menu for daily archives, JSON file imports, and public JSON URLs.
- Native iOS widget and background refresh source included; see the mobile status below.

## Quick start: browser

Use **Node.js 22.12 or newer**, npm, and Git. No API key or OneDrive account is required. The initial dependency installation and live weather requests require internet access; Tailwind CSS also loads from a CDN.

```bash
git clone https://github.com/JValdivia23/skywatch.git
cd skywatch
npm ci
```

This is a private repository, so authenticate with GitHub and obtain repository access before cloning.

Start the scraper and API in one terminal:

```bash
npm start
```

Start the frontend in a second terminal, from the same directory:

```bash
npm run dev
```

Open **[http://localhost:5180](http://localhost:5180)**. Vite forwards `/api` requests to the backend on port **3000**. If 5180 is occupied, use the URL printed by Vite.

The backend attempts a scrape on startup and every five minutes afterward. A fresh clone starts with no observations; charts fill as data arrives, or you can import an existing JSON history file.

### Bun alternative

With Bun installed, use the committed Bun lockfile:

```bash
bun install --frozen-lockfile
bun --bun run start
```

In a second terminal:

```bash
bun --bun run dev
```

`--bun` runs the scripts with Bun instead of Node. For a production web build, use `bun --bun run build` or `npm run build`.

## How it works

| Platform | Weather requests | History storage |
| --- | --- | --- |
| Web browser | Frontend → Vite `/api` proxy → Express → station HTML | Backend JSON files and browser `localStorage` cache |
| Native iOS / Android | Frontend → `CapacitorHttp` → station HTML, parsed with `DOMParser` | Device `localStorage`; no Express server required |

Both scrapers read the same HTML table and skip consecutive observations with the same station timestamp. Keep the selectors in `server.js` and `src/main.js` aligned when the station page changes.

The active frontend is `index.html` and `src/main.js`. The existing `.tsx` files are legacy scaffolding and are not used by this entry point. The backend currently uses ES modules, as configured by `"type": "module"` in `package.json`.

## Data and sharing

The backend creates these local files automatically:

| Path | Contents |
| --- | --- |
| `weather_log.json` | Rolling history, up to 2,000 observations |
| `history/weather_YYYY-MM-DD.json` | Daily archives, grouped by UTC collection date |
| `public_feed/latest_24h.json` | Latest 288 observations, approximately 24 hours |

These files, dependencies, logs, and build output are excluded from Git. Cloning the repository shares the application source; share weather history separately if needed. OneDrive is optional and syncs these files only when the project is stored in a synced folder. Run only one scraper against a shared data folder to avoid conflicting writes.

Open the database icon at the top right of the dashboard to use **Data Sources**:

1. **Local History Archive:** Choose a date and click **Load**. Requires the backend.
2. **Import JSON File:** Select a daily archive, rolling log, or feed file.
3. **Load from URL:** Supply a direct URL returning a JSON array. In a browser, the host must allow cross-origin requests. A OneDrive sharing page may return HTML rather than downloadable JSON; file import is the simplest fallback.
4. **Return to Live Data:** Resume automatic updates after viewing imported history.

JSON imports use an array of observations with this shape. Values shown are illustrative; weather measurements are stored as strings as scraped from the station.

```json
[
  {
    "timestamp": "11/2/26 10:00a",
    "fetchedAt": "2026-11-02T17:00:00.000Z",
    "temperature": "42.7",
    "dewpoint": "30.1",
    "humidity": "61",
    "pressure": "835.2",
    "windSpeed": "6.3",
    "peakGust": "12.4",
    "windDirection": "270",
    "rainfall": "0.00"
  }
]
```

The frontend caches history under the `weather_history` key in `localStorage`. Cached observations can be stale; check the displayed station timestamp.

## Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the versions recorded in `package-lock.json` |
| `npm start` | Run the scraper and API on port 3000 |
| `npm run dev` | Run the Vite frontend, default port 5180 |
| `npm run build` | Build web assets into `dist/` |
| `npm run preview` | Preview `dist/` locally |

There is currently no automated test or lint suite. Validate changes with a production build and manual dashboard checks, including refresh, charts, imports, and cached data after a network failure.

`npm run preview` is a static build preview. Browser live data requires `/api` to reach the Express backend; the development proxy is configured for `npm run dev`. A deployed browser version needs an API reverse proxy or equivalent hosting configuration. GitHub Pages alone does not run the scraper.

## Mobile projects and current status

The `ios/` and `android/` directories contain native projects and custom iOS widget code. **Native dependency versions currently need reconciliation:** `package.json` declares Capacitor 5, while the iOS Swift package references Capacitor 8.0.1 and the Android project includes Java 21 / SDK 36 settings. The browser setup above does not depend on resolving this mismatch. Native builds are not verified as part of this repository handoff.

Before building mobile apps, align the JavaScript and native Capacitor versions and review the corresponding Xcode / Android Studio requirements. The usual workflow after that is:

```bash
npm run build
npx cap sync
npx cap open ios       # macOS and Xcode required
# or
npx cap open android   # Android Studio and the matching JDK / SDK required
```

Always build the web assets before syncing. The app's foreground weather requests use native HTTP and do not require the backend.

For iOS, select your own signing team and review the app and widget bundle identifiers. The configured App Group is `group.com.valdivia.skywatch.app`, and the background task identifier is `com.valdivia.skywatch.app.refresh`; keep identifiers consistent across Swift code, entitlements, and `Info.plist` if you change them. The app targets currently specify iOS 26.2.

The widget reads shared weather history. Background refresh and widget timelines are scheduled by iOS, so updates are not guaranteed at fixed intervals. [WIDGET_SETUP.md](WIDGET_SETUP.md) and [ICON_SETUP.md](ICON_SETUP.md) contain earlier setup notes; some identifiers and instructions predate the current native projects. Use the checked-in targets and source as the reference.

## API

The backend defaults to `http://localhost:3000`. Set the `PORT` environment variable to change it, and update the Vite proxy target if using a different backend port.

| Method | Endpoint | Response |
| --- | --- | --- |
| `GET` | `/api/weather` | `{ "latest": object or null, "history": [...] }` |
| `POST` | `/api/refresh` | Attempts a scrape, then returns the same shape as `/api/weather` |
| `GET` | `/api/history` | Available `YYYY-MM-DD` archive dates, newest first |
| `GET` | `/api/history/:date` | Observation array for that date; 404 if absent |

If a scrape fails, existing logs remain available. A successful API response may therefore contain older observations; on an empty installation it can contain `latest: null`. The API has no authentication and is intended for local development; review access controls before exposing it beyond a trusted environment.

## Project layout

```text
index.html              Dashboard markup, styles, and frontend entry point
src/main.js             Scraping, caching, data imports, UI, and Chart.js charts
server.js               Express API, station scraper, archives, and feed writer
public/logo.svg         Dashboard logo
vite.config.js          Frontend build and development API proxy
capacitor.config.json   Capacitor app ID, name, and web asset directory
ios/                    Xcode project, Swift app delegate, and widget sources
android/                Android / Gradle project
debug_scrape.js         Utility to print the timestamp fetched from the station
```

## Troubleshooting

- **Dashboard stays at “Loading” or shows no data:** Start both terminals, inspect the backend log, and check `http://localhost:3000/api/weather`. An initial scrape can fail if the station is unavailable or its HTML has changed.
- **Port 3000 is already in use:** Reuse the existing Skywatch backend or stop it before starting another. If changing `PORT`, also change `vite.config.js`.
- **History is missing after cloning:** Collected observations are local runtime data and are intentionally excluded from Git. Import an archive or let the scraper collect new data.
- **A shared URL fails to load:** Check that it returns raw JSON and permits browser CORS requests. Download the file and import it if necessary.
- **Mobile changes do not appear:** Rebuild web assets, sync after resolving the native version mismatch, then rebuild the native app.

## License

ISC.
