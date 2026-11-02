import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Directory configuration
const DATA_FILE = path.join(__dirname, 'weather_log.json');
const HISTORY_DIR = path.join(__dirname, 'history');
const PUBLIC_FEED_DIR = path.join(__dirname, 'public_feed');
const PUBLIC_FEED_FILE = path.join(PUBLIC_FEED_DIR, 'latest_24h.json');
const TARGET_URL = 'https://sundowner.colorado.edu/weather/atoc8/';

app.use(cors());
app.use(express.static('public'));

// Ensure directories exist
[HISTORY_DIR, PUBLIC_FEED_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

// Helper to read JSON file safely
const readJsonFile = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) return [];
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
        return [];
    }
};

// Helper to write JSON file safely
const writeJsonFile = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(`Error writing ${filePath}:`, err);
    }
};

const scrapeWeather = async () => {
    console.log('Scraping weather data...');
    try {
        const { data } = await axios.get(TARGET_URL);
        const $ = cheerio.load(data);
        
        // Helper to extract text safely
        const getRowData = (rowNum) => {
            const row = $(`table tr:nth-child(${rowNum})`);
            return {
                current: row.find('td:nth-child(2)').text().trim(),
                min: row.find('td:nth-child(3)').text().trim(),
                max: row.find('td:nth-child(4)').text().trim(),
                average: row.find('td:nth-child(5)').text().trim()
            };
        };

        const timestampRaw = $('table tr:nth-child(1) th:nth-child(1)').text().trim();

        const weatherData = {
            timestamp: timestampRaw,
            fetchedAt: new Date().toISOString(),
            temperature: getRowData(3).current,
            dewpoint: getRowData(4).current,
            humidity: getRowData(5).current,
            pressure: getRowData(6).current,
            windSpeed: getRowData(7).current,
            peakGust: getRowData(8).current,
            windDirection: getRowData(9).current,
            rainfall: getRowData(10).current
        };

        // Validate data
        if (!weatherData.temperature) {
            console.warn("Scraping failed: No temperature found");
            return;
        }

        // --- 1. Update Main Log (Live Dashboard) ---
        const mainLog = readJsonFile(DATA_FILE);
        const lastEntry = mainLog[mainLog.length - 1];
        
        // Only update if timestamp is new
        if (!lastEntry || lastEntry.timestamp !== weatherData.timestamp) {
            mainLog.push(weatherData);
            
            // Limit main log (keep manageable size for quick loading)
            if (mainLog.length > 2000) {
                mainLog.shift();
            }
            writeJsonFile(DATA_FILE, mainLog);
            
            // --- 2. Update Daily Archive (Permanent Record) ---
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const dailyFile = path.join(HISTORY_DIR, `weather_${today}.json`);
            
            const dailyLog = readJsonFile(dailyFile);
            dailyLog.push(weatherData);
            writeJsonFile(dailyFile, dailyLog);
            
            // --- 3. Update Public Feed (Last 24 Hours) ---
            // Calculate entries for 24h: 12 entries/hour * 24 hours = 288 entries
            // We use the main log as source but strictly limit to last 288
            const last24h = mainLog.slice(-288);
            writeJsonFile(PUBLIC_FEED_FILE, last24h);
            
            console.log(`✅ New data logged: ${weatherData.timestamp} - ${weatherData.temperature}°F`);
            console.log(`📂 Archived to: weather_${today}.json`);
            console.log(`🌐 Public feed updated: ${last24h.length} entries`);
            
        } else {
            console.log('⏭️ Data not updated on source yet.');
        }

    } catch (error) {
        console.error("❌ Error scraping data:", error.message);
    }
};

// --- API Endpoints ---

// Live Data
app.get('/api/weather', (req, res) => {
    const log = readJsonFile(DATA_FILE);
    const latest = log.length > 0 ? log[log.length - 1] : null;
    res.json({
        latest,
        history: log // Returns full history currently in main log
    });
});

// Force Refresh
app.post('/api/refresh', async (req, res) => {
    await scrapeWeather();
    const log = readJsonFile(DATA_FILE);
    const latest = log.length > 0 ? log[log.length - 1] : null;
    res.json({
        latest,
        history: log
    });
});

// List Available History Dates
app.get('/api/history', (req, res) => {
    try {
        const files = fs.readdirSync(HISTORY_DIR);
        const dates = files
            .filter(f => f.startsWith('weather_') && f.endsWith('.json'))
            .map(f => f.replace('weather_', '').replace('.json', ''))
            .sort()
            .reverse(); // Newest first
        res.json(dates);
    } catch (err) {
        res.status(500).json({ error: "Failed to list history" });
    }
});

// Get Specific History Date
app.get('/api/history/:date', (req, res) => {
    const date = req.params.date;
    // Basic validation to prevent directory traversal
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "Invalid date format" });
    }
    
    const filePath = path.join(HISTORY_DIR, `weather_${date}.json`);
    if (fs.existsSync(filePath)) {
        res.json(readJsonFile(filePath));
    } else {
        res.status(404).json({ error: "Date not found" });
    }
});

// Initialize
scrapeWeather();
setInterval(scrapeWeather, 5 * 60 * 1000);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`📂 History: ${HISTORY_DIR}`);
    console.log(`🌐 Public Feed: ${PUBLIC_FEED_FILE}`);
});
