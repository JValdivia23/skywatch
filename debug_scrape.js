import axios from 'axios';
import * as cheerio from 'cheerio';

const TARGET_URL = 'https://sundowner.colorado.edu/weather/atoc8/';

const checkSource = async () => {
    try {
        const url = `${TARGET_URL}?t=${Date.now()}`;
        console.log(`Fetching ${url}...`);
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const timestamp = $('table tr:nth-child(1) th:nth-child(1)').text().trim();
        console.log(`Timestamp on website: "${timestamp}"`);
    } catch (err) {
        console.error("Error:", err.message);
    }
};

checkSource();