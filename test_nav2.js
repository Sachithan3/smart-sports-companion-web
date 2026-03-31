const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-web-security'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  page.on('requestfailed', request => {
    console.log('FAILED:', request.url(), request.failure().errorText);
  });
  
  await page.goto('http://localhost:8080/');
  console.log("Page loaded. Clicking Sports nav link...");
  
  await page.click('a[href="#sports"]');
  await new Promise(r => setTimeout(r, 500));
  
  console.log("Clicking badminton card...");
  await page.click('div[data-sport="badminton"]');
  await new Promise(r => setTimeout(r, 500));

  console.log("Clicking Start Game...");
  // check if start button is disabled
  const disabled = await page.$eval('#startButton', el => el.disabled);
  console.log("Start Button Disabled?", disabled);
  if (!disabled) {
      await page.click('#startButton');
  }
  
  await new Promise(r => setTimeout(r, 500));
  console.log("Done checking.");
  await browser.close();
})();
