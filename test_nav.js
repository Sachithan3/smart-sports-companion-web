const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text(), msg.location ? msg.location().url : ''));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('requestfailed', req => console.log('FAILED URL:', req.url()));
  
  await page.goto('http://localhost:8080/');
  
  await browser.close();
})();
