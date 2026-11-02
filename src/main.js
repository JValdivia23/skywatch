import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Chart, registerables } from 'chart.js';

// Debug check
console.log("src/main.js is loading...");
try {
    const debugEl = document.getElementById('last-updated');
    if(debugEl) debugEl.textContent = "JS Loaded, Initializing...";
} catch(e) { console.error("DOM Error", e); }

Chart.register(...registerables);

// Configuration
const TARGET_URL = 'https://sundowner.colorado.edu/weather/atoc8/';
const BACKEND_API = ''; // Use relative path for proxy


let tempChart, windChart;
let historyMode = false; // Track if we are viewing history
let currentWindDirectionData = []; // Store wind direction for chart plugin

// --- Wind Direction Arrows ---
// Maps compass directions to arrows showing where wind is GOING (reversed from source)
// Includes all 16-point compass directions
const windDirectionArrows = {
    // 8-point compass (primary)
    'N': '↓',   'S': '↑',   'E': '←',   'W': '→',
    'NE': '↙',  'SE': '↖',  'SW': '↗',  'NW': '↘',
    // 16-point compass (secondary) - use nearest diagonal
    'NNE': '↙', 'ENE': '←', 'ESE': '←', 'SSE': '↖',
    'SSW': '↗', 'WSW': '→', 'WNW': '→', 'NNW': '↘'
};

// Convert degrees (0-360) to 16-point compass direction
const degreesToCompass = (degrees) => {
    if (degrees === null || degrees === undefined || degrees === '') return null;
    const deg = parseFloat(degrees);
    if (isNaN(deg)) return degrees; // Return as-is if not a number (might already be compass)
    
    // Normalize to 0-360
    const normalized = ((deg % 360) + 360) % 360;
    
    // 16 compass points, each covers 22.5 degrees
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                        'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(normalized / 22.5) % 16;
    return directions[index];
};

const getWindDirectionArrow = (direction) => {
    if (!direction) return ''; // Empty for missing data
    
    // Convert degrees to compass if numeric
    const compass = degreesToCompass(direction);
    if (!compass) return '';
    
    // Normalize: uppercase and trim
    const normalized = compass.toUpperCase().trim();
    return windDirectionArrows[normalized] || '';
};

// --- Density Control ---
let currentDensity = 'quarter'; // Default to 1/4 density

const getDensitySetting = () => {
    return currentDensity;
};

const setDensitySetting = (density) => {
    currentDensity = density;
    
    // Update button states - use blue-200 for active, remove for inactive
    const quarterBtn = document.getElementById('density-quarter');
    const halfBtn = document.getElementById('density-half');
    const fullBtn = document.getElementById('density-full');
    
    // Remove active state from all
    [quarterBtn, halfBtn, fullBtn].forEach(btn => {
        if (btn) {
            btn.classList.remove('bg-blue-200');
            btn.classList.add('bg-gray-100');
        }
    });
    
    // Add active state to selected
    const activeBtn = density === 'quarter' ? quarterBtn : 
                      density === 'half' ? halfBtn : fullBtn;
    if (activeBtn) {
        activeBtn.classList.remove('bg-gray-100');
        activeBtn.classList.add('bg-blue-200');
    }
    
    // Redraw chart with new density
    if (windChart) {
        windChart.update();
    }
};

// --- Wind Direction Arrows Plugin ---
// This plugin draws Unicode arrows directly on the canvas
// because Chart.js pointStyle doesn't support Unicode characters
const windArrowsPlugin = {
    id: 'windArrows',
    afterDatasetsDraw: (chart) => {
        // Only apply to wind chart
        if (!chart.canvas || chart.canvas.id !== 'windChart') return;
        
        const ctx = chart.ctx;
        const windSpeedMeta = chart.getDatasetMeta(0); // Wind speed dataset
        
        if (!windSpeedMeta || !windSpeedMeta.data || windSpeedMeta.data.length === 0) return;
        
        // Get density setting for sampling
        const sampleRate = getDensitySetting() === 'quarter' ? 4 : 
                          getDensitySetting() === 'half' ? 2 : 1;
        
        // Draw arrows at each sampled data point
        windSpeedMeta.data.forEach((point, index) => {
            // Skip based on density
            if (index % sampleRate !== 0) return;
            
            // Get direction from stored data (could be degrees or compass)
            const direction = currentWindDirectionData[index];
            if (!direction) return; // No data, don't show anything
            
            // Convert degrees to compass if needed, then get arrow
            const compass = degreesToCompass(direction);
            if (!compass) return;
            
            const normalized = compass.toUpperCase().trim();
            const arrow = windDirectionArrows[normalized];
            if (!arrow) return;
            
            // Get wind speed for coloring
            const speed = parseFloat(chart.data.datasets[0].data[index]);
            
            // Set text properties
            ctx.save();
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = speed === 0 ? '#9ca3af' : '#000000'; // Gray for calm, black for wind
            
            // Draw arrow ON the wind speed line (at the point coordinates)
            ctx.fillText(arrow, point.x, point.y);
            ctx.restore();
        });
    }
};
Chart.register(windArrowsPlugin);

// --- Storage Helper ---
const HISTORY_KEY = 'weather_history';
const getHistory = () => {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
};
const saveHistory = (history) => {
    // Keep last 2000 entries to prevent overflow
    if (history.length > 2000) history.shift();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
};

// --- Direct Scraping (For Native Mobile) ---
const fetchWeatherDirect = async () => {
    console.log('📱 Mobile Mode: Scraping directly from weather station...');
    
    try {
        const httpResponse = await CapacitorHttp.get({
            url: TARGET_URL,
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
            }
        });
        
        if (httpResponse.status !== 200) {
            throw new Error(`HTTP ${httpResponse.status}: Failed to fetch weather data`);
        }
        
        const html = httpResponse.data;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Helper to get text from table row
        const getRow = (n) => {
            const row = doc.querySelector(`table tr:nth-child(${n})`);
            if (!row) return null;
            const cell = row.querySelector('td:nth-child(2)');
            return cell ? cell.textContent.trim() : null;
        };
        
        const timestampRaw = doc.querySelector('table tr:nth-child(1) th:nth-child(1)')?.textContent.trim();

        if (!timestampRaw) throw new Error("Could not parse timestamp from HTML");

        const data = {
            timestamp: timestampRaw,
            fetchedAt: new Date().toISOString(),
            temperature: getRow(3),
            dewpoint: getRow(4),
            humidity: getRow(5),
            pressure: getRow(6),
            windSpeed: getRow(7),
            peakGust: getRow(8),
            windDirection: getRow(9),
            rainfall: getRow(10)
        };

        if (!data.temperature) throw new Error("Could not parse temperature from HTML");
        
        return data;
        
    } catch (err) {
        console.error('❌ Direct Scraping Error:', err);
        throw err;
    }
};

// --- Backend API (For Web Browser) ---
const fetchWeatherFromBackend = async () => {
    try {
        console.log('🌐 Web Mode: Fetching from backend API...');
        const response = await fetch('/api/weather');
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`API request failed: ${response.status} - ${text}`);
        }
        const data = await response.json();
        if (!data.latest) throw new Error("No weather data available from API");
        return data;
    } catch (err) {
        console.error("❌ Backend API Error:", err);
        const debugEl = document.getElementById('last-updated');
        if(debugEl) debugEl.textContent = "Error: " + err.message;
        throw err;
    }
};

// --- Unified Fetch Function (Dual-Mode) ---
const fetchWeatherData = async () => {
    // Basic check if Capacitor is available/native
    const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
    
    if (isNative) {
        return await fetchWeatherDirect();
    } else {
        return await fetchWeatherFromBackend();
    }
};

// --- Data Update Logic ---
const updateData = async () => {
    // Skip if viewing history
    if (historyMode) return;

    try {
        const result = await fetchWeatherData();
        let newData, fullHistory;
        
        if (Capacitor.isNativePlatform()) {
            newData = result;
            fullHistory = getHistory();
            const lastEntry = fullHistory[fullHistory.length - 1];
            if (!lastEntry || lastEntry.timestamp !== newData.timestamp) {
                fullHistory.push(newData);
                saveHistory(fullHistory);
            }
        } else {
            newData = result.latest;
            fullHistory = result.history;
            if (fullHistory && fullHistory.length > 0) {
                saveHistory(fullHistory);
            }
        }
        
        updateUI(newData, fullHistory);
        return true;
    } catch (e) {
        console.error("⚠️ Failed to fetch new data:", e);
        // Fallback
        const history = getHistory();
        const last = history[history.length - 1];
        if (last) updateUI(last, history);
        return false;
    }
};

// --- UI Update ---
const updateUI = (latest, history) => {
    // Update Text
    const statusEl = document.getElementById('last-updated');
    if (statusEl) {
        statusEl.textContent = `Updated: ${latest.timestamp}`;
    }
    
    document.getElementById('temp').textContent = latest.temperature;
    document.getElementById('wind').textContent = latest.windSpeed;
    
    // Update wind direction arrow with debugging
    const windDirectionEl = document.getElementById('wind-direction');
    if (windDirectionEl) {
        console.log('Wind direction raw data:', JSON.stringify(latest.windDirection));
        const arrow = getWindDirectionArrow(latest.windDirection);
        console.log('Arrow to display:', arrow);
        // Show arrow if available, otherwise show direction text or nothing
        if (arrow) {
            windDirectionEl.textContent = arrow;
        } else if (latest.windDirection) {
            windDirectionEl.textContent = latest.windDirection; // Show raw value for debugging
        } else {
            windDirectionEl.textContent = ''; // No data
        }
    }
    
    document.getElementById('gust').textContent = latest.peakGust;
    document.getElementById('humidity').textContent = latest.humidity;
    document.getElementById('dewpoint').textContent = latest.dewpoint;
    document.getElementById('pressure').textContent = latest.pressure;
    document.getElementById('rain').textContent = latest.rainfall;

    // Filter last 288 for charts (24 hours)
    // If fewer points exist, show all
    const recentHistory = history.slice(-288); 
    
    // Extract labels (time only)
    const labels = recentHistory.map(d => {
        // Handle various timestamp formats if needed, usually "1/26/26 3:15p"
        const parts = d.timestamp.split(' ');
        return parts.length > 1 ? parts[1] : d.timestamp;
    });

    // Chart Optimization:
    // With 288 points, pointRadius should be 0 (smooth line) unless hovering
    const pointRadius = recentHistory.length > 50 ? 0 : 2;

    // Temp Chart
    tempChart.data.labels = labels;
    tempChart.data.datasets[0].data = recentHistory.map(d => parseFloat(d.temperature));
    tempChart.data.datasets[0].pointRadius = pointRadius;
    tempChart.data.datasets[1].data = recentHistory.map(d => parseFloat(d.dewpoint));
    tempChart.data.datasets[1].pointRadius = pointRadius;
    tempChart.update();

    // Wind Chart
    windChart.data.labels = labels;
    windChart.data.datasets[0].data = recentHistory.map(d => parseFloat(d.windSpeed));
    windChart.data.datasets[0].pointRadius = pointRadius;
    windChart.data.datasets[1].data = recentHistory.map(d => parseFloat(d.peakGust));
    windChart.data.datasets[1].pointRadius = pointRadius;
    
    // Store wind direction data globally for the plugin to access
    currentWindDirectionData = recentHistory.map(d => d.windDirection);
    
    windChart.update();
};

// --- External Data Loading ---
window.loadFromFile = async (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data) && data.length > 0) {
                console.log(`📂 Loaded ${data.length} entries from file`);
                historyMode = true; // Stop auto-updates
                updateUI(data[data.length - 1], data);
                alert(`Loaded ${data.length} historical entries. Live updates paused.`);
            } else {
                alert("Invalid file format. Expected an array of weather data.");
            }
        } catch (err) {
            alert("Error parsing JSON file");
        }
    };
    reader.readAsText(file);
};

window.loadFromUrl = async (url) => {
    try {
        const response = await fetch(url); // May fail due to CORS on web
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            historyMode = true;
            updateUI(data[data.length - 1], data);
            alert("Loaded data from URL. Live updates paused.");
        }
    } catch (err) {
        alert("Failed to load URL. If using web browser, this may be due to CORS security.");
        console.error(err);
    }
};

window.resetToLive = () => {
    historyMode = false;
    updateData();
    alert("Returned to live data.");
};

// --- Chart Gradient Helper ---
const getTempGradient = (context) => {
    const chart = context.chart;
    const { ctx, chartArea, scales } = chart;
    if (!chartArea) return null;
    
    const yAxis = scales.y;
    if (!yAxis) return null;

    const pixel32 = yAxis.getPixelForValue(32);
    const pixelTop = chartArea.top;
    const pixelBottom = chartArea.bottom;
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, pixelBottom, 0, pixelTop);
    
    // Calculate stop position (0 to 1)
    // Canvas coordinates: 0 is top, height is bottom.
    // Chart coordinates: top is max val, bottom is min val.
    // We want 32F position.
    
    let stop = (pixel32 - pixelBottom) / (pixelTop - pixelBottom);
    
    // Clamp stop to 0-1 range to handle case where 32 is off-chart
    stop = Math.max(0, Math.min(1, stop));
    
    // Cold color (Blue/Cyan) below 32
    gradient.addColorStop(0, 'rgba(34, 211, 238, 0.5)'); // Cyan
    gradient.addColorStop(stop, 'rgba(34, 211, 238, 0.1)'); // Cyan fade
    
    // Freezing line
    gradient.addColorStop(stop, 'rgba(255, 255, 255, 0.5)'); 
    
    // Warm color (Orange/Red) above 32
    gradient.addColorStop(stop, 'rgba(251, 146, 60, 0.1)'); // Orange fade
    gradient.addColorStop(1, 'rgba(251, 146, 60, 0.5)'); // Orange
    
    return gradient;
};

// --- Chart Initialization ---
const initCharts = () => {
    try {
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'top' } },
            scales: {
                y: { grid: { color: '#f3f4f6' } },
                x: { 
                    display: true, // Show X axis
                    ticks: {
                        maxTicksLimit: 8, // Limit labels to avoid clutter
                        maxRotation: 0
                    },
                    grid: { display: false }
                }
            },
            elements: {
                point: {
                    radius: 0, // Default to no dots for smooth look
                    hitRadius: 10,
                    hoverRadius: 4
                }
            }
        };

        const ctxTemp = document.getElementById('tempChart').getContext('2d');
        tempChart = new Chart(ctxTemp, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Temp (°F)',
                    data: [],
                    borderColor: '#eab308', // Keep border orange/gold
                    backgroundColor: getTempGradient, // Dynamic gradient
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Dewpoint',
                    data: [],
                    borderColor: '#22c55e',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.3
                }]
            },
            options: commonOptions
        });

        const ctxWind = document.getElementById('windChart').getContext('2d');
        windChart = new Chart(ctxWind, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Wind (mph)',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Gust',
                    data: [],
                    borderColor: '#a855f7',
                    borderWidth: 2,
                    borderDash: [2, 2],
                    tension: 0.3
                }]
            },
            options: commonOptions
        });
    } catch (e) {
        console.error("Chart init error:", e);
    }
};

// --- App Initialization ---
console.log("Adding event listener for DOMContentLoaded");
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Skywatch initializing...');
    
    // Debug
    const debugEl = document.getElementById('last-updated');
    if(debugEl) debugEl.textContent = "Initialized, starting...";
    
    try {
        initCharts();
        updateData();
    } catch (e) {
        console.error("Init failed:", e);
        if(debugEl) debugEl.textContent = "Init Failed: " + e.message;
    }
    
    // Auto-refresh every 5 mins
    setInterval(updateData, 5 * 60 * 1000);

    // --- UI Event Listeners ---

    // Toggle Data Menu
    const toggleBtn = document.getElementById('data-toggle-btn');
    const dataMenu = document.getElementById('data-menu');
    if (toggleBtn && dataMenu) {
        toggleBtn.addEventListener('click', () => {
            dataMenu.classList.toggle('open');
            // Fetch history dates when opening menu
            if (dataMenu.classList.contains('open') && !Capacitor.isNativePlatform()) {
                fetchHistoryDates();
            }
        });
    }

    // Density Control Buttons
    const densityQuarterBtn = document.getElementById('density-quarter');
    const densityHalfBtn = document.getElementById('density-half');
    const densityFullBtn = document.getElementById('density-full');
    
    if (densityQuarterBtn) {
        densityQuarterBtn.addEventListener('click', () => {
            setDensitySetting('quarter');
        });
    }
    
    if (densityHalfBtn) {
        densityHalfBtn.addEventListener('click', () => {
            setDensitySetting('half');
        });
    }
    
    if (densityFullBtn) {
        densityFullBtn.addEventListener('click', () => {
            setDensitySetting('full');
        });
    }

    // Set default density button state
    setDensitySetting('quarter');

    // Load History Button
    const loadHistoryBtn = document.getElementById('load-history-btn');
    const historySelect = document.getElementById('history-select');
    if (loadHistoryBtn && historySelect) {
        loadHistoryBtn.addEventListener('click', async () => {
            const date = historySelect.value;
            if (!date) return;
            
            try {
                const response = await fetch(`/api/history/${date}`);
                if (!response.ok) throw new Error("Failed to load history");
                const data = await response.json();
                
                historyMode = true;
                updateUI(data[data.length - 1], data);
                alert(`Loaded history for ${date}`);
            } catch (err) {
                alert("Error loading history: " + err.message);
            }
        });
    }

    // File Import
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                window.loadFromFile(e.target.files[0]);
            }
        });
    }

    // URL Load
    const urlInput = document.getElementById('url-input');
    const loadUrlBtn = document.getElementById('load-url-btn');
    if (loadUrlBtn && urlInput) {
        loadUrlBtn.addEventListener('click', () => {
            if (urlInput.value) {
                window.loadFromUrl(urlInput.value);
            }
        });
    }

    // Reset to Live
    const resetBtn = document.getElementById('reset-live-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            window.resetToLive();
            if (dataMenu) dataMenu.classList.remove('open');
        });
    }

    // Manual Refresh
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            if (historyMode) {
                window.resetToLive();
                return;
            }
            
            const originalText = refreshBtn.innerHTML;
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = `Updating...`;
            
            try {
                // If backend API path is empty string, we are in proxy mode or same-origin
                // If it is 'http://localhost:3000', we are in CORS mode
                // Since we removed BACKEND_API, we use relative path
                if (!Capacitor.isNativePlatform()) {
                    await fetch('/api/refresh', { method: 'POST' });
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                await updateData();
            } catch (e) {
                console.error("Refresh failed:", e);
                await updateData();
            }
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = originalText;
        });
    }
});

// Helper to fetch available history dates
async function fetchHistoryDates() {
    try {
        const response = await fetch('/api/history');
        if (!response.ok) return;
        const dates = await response.json();
        
        const select = document.getElementById('history-select');
        select.innerHTML = '<option value="">Select a date...</option>';
        
        dates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            option.textContent = date;
            select.appendChild(option);
        });
    } catch (err) {
        console.warn("Could not fetch history list (backend might be offline)");
    }
}