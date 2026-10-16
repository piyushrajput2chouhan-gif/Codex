import { chromium, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

const url = process.env.APEX_SITE_URL || 'https://piyushrajput2chouhan-gif.github.io/Codex/';
const executablePath = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium'].find(existsSync);
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width === 390, hasTouch: width === 390 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), 'Public page must return HTTP 200').toBe(200);
    await expect(page).toHaveTitle('Apex Auto Captures | Car and Café Photography and Videography');
    await expect.poll(() => page.locator('.site').evaluate(el => getComputedStyle(el).getPropertyValue('--site-accent').trim()), 'Published site must load the Emerald Editorial theme').toBe('#dfc69a');
    await expect(page.locator('.cars h1')).toHaveCSS('font-family', /Georgia/);
    await expect(page.locator('.cars canvas')).toHaveAttribute('data-frame', '0', { timeout: 30_000 });
    await page.evaluate(() => window.scrollTo({ top: (document.querySelector('.hero-region').clientHeight - innerHeight) * .5, behavior: 'instant' }));
    await expect(page.locator('.cars canvas')).toHaveAttribute('data-frame', '96');
    const position = await page.evaluate(() => scrollY);
    const selectScene = async id => {
      if (width !== 390) { await page.locator(id).click(); return; }
      // Use a real touch at the visible tab. Locator click's automatic scrolling
      // can move mobile pages even when a sticky tab is already on screen.
      const box = await page.locator(id).boundingBox();
      expect(box).not.toBeNull();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    };
    await selectScene('#hero-scenes-cafes');
    await expect(page.getByRole('slider')).toHaveAttribute('aria-valuetext', 'Cafés');
    expect(await page.evaluate(() => scrollY)).toBe(position);
    await selectScene('#hero-scenes-cars');
    await expect(page.getByRole('slider')).toHaveAttribute('aria-valuetext', 'Cars');
    await page.locator('#work').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-board]')).toBeVisible();
    await expect(page.locator('[data-thumb]')).toHaveCount(7);
    await page.locator('#work-tabs-cafes').click();
    await expect(page.locator('[data-thumb]')).toHaveCount(10);
    await page.locator('#book').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: "Let's talk on WhatsApp" }).click();
    await expect(page.locator('#name-error')).toBeVisible();
    await page.locator('footer').scrollIntoViewIfNeeded();
    await expect(page.locator('footer .hwf-sr')).toHaveText('IBRAHIM');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow').toBe(true);
    // Wait for the current image requests so missing assets cannot be hidden by an early assertion.
    await page.waitForLoadState('networkidle', { timeout: 60_000 });
    expect(errors, 'Public website must have no runtime errors or failed asset responses').toEqual([]);
    console.log(`${width}px: public HTTP 200, car scrubbing, scene switch, galleries, form, footer, asset loading and overflow checks passed.`);
    await context.close();
  }
} finally {
  await browser.close();
}
