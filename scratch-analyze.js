const fs = require('fs');
const readline = require('readline');
const path = require('path');

const logFile = path.join(__dirname, 'logs', 'access.log');

const urlCounts = {};
const ipUrlCounts = {};
const statusCounts = {};

const rl = readline.createInterface({
  input: fs.createReadStream(logFile),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const log = JSON.parse(line);
    const url = log.url || '';
    const status = log.status;
    const ip = log.ip || 'unknown';

    urlCounts[url] = (urlCounts[url] || 0) + 1;
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    const ipKey = `${ip} -> ${url}`;
    ipUrlCounts[ipKey] = (ipUrlCounts[ipKey] || 0) + 1;
  } catch (e) {
    // Ignore parse errors
  }
});

rl.on('close', () => {
  console.log('--- Top 20 URLs ---');
  const sortedUrls = Object.entries(urlCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
  sortedUrls.forEach(([url, count]) => {
    console.log(`${count}: ${url}`);
  });

  console.log('\n--- Status Code Distribution ---');
  console.log(statusCounts);

  console.log('\n--- Top 20 IP + URL combos ---');
  const sortedIpUrls = Object.entries(ipUrlCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
  sortedIpUrls.forEach(([ipUrl, count]) => {
    console.log(`${count}: ${ipUrl}`);
  });
});
