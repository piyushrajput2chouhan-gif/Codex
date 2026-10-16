import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const integrity = JSON.parse(readFileSync(new URL('./source-integrity.json', import.meta.url), 'utf8')) as Record<string, string>;

for (const width of [360, 390, 768, 1024, 1440]) {
  test(`layout, scene media, gallery and footer at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page).toHaveTitle('Apex Auto Captures | Car and Café Photography and Videography');
    await expect(page.locator('.cars canvas')).toHaveAttribute('data-frame', '0');
    await expect(page.getByRole('heading', { name: 'Cars, shot like they mean it.' })).toBeVisible();
    // Scene stacking must hide the other scene's actual rendered text, not just its accessibility tree.
    expect(await page.locator('.cars').evaluate(el => getComputedStyle(el).isolation)).toBe('isolate');
    await page.locator('#work').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-board]')).toBeVisible();
    expect(await page.locator('[data-thumb]').count()).toBe(7);
    await page.locator('#work-tabs-cafes').click();
    await expect(page.locator('[data-thumb]')).toHaveCount(10);
    await page.locator('#services').scrollIntoViewIfNeeded();
    await expect(page.locator('.service-row')).toHaveCount(10);
    await page.locator('#book').scrollIntoViewIfNeeded();
    await expect(page.locator('#name')).toBeVisible();
    await page.locator('footer').scrollIntoViewIfNeeded();
    await expect(page.locator('footer .hwf-sr')).toHaveText('IBRAHIM');
    await expect.poll(async () => page.locator('footer canvas').evaluate((el: HTMLCanvasElement) => {
      const data = el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data;
      let bright = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] > 160) bright++;
      return bright;
    })).toBeGreaterThan(100);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('all original car frames, photos, and supplied components remain byte-identical', () => {
  for (const [file, hash] of Object.entries(integrity)) expect(createHash('sha256').update(readFileSync(resolve(file))).digest('hex'), file).toBe(hash);
});

test('car scrub, scene memory, keyboard switch, and source rendering', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.cars canvas')).toHaveAttribute('data-frame', '0');
  await page.evaluate(() => window.scrollTo({ top: (document.querySelector('.hero-region')!.clientHeight - innerHeight) * .5, behavior: 'instant' }));
  await expect(page.locator('.cars canvas')).toHaveAttribute('data-frame', '96');
  // Compare canvas pixels with the original rendering algorithm, including its contain fit.
  await expect.poll(() => page.locator('.cars canvas').evaluate(async (canvas: HTMLCanvasElement) => {
    const image = new Image(); image.src = '/frames/cars/frame_0097.webp'; await image.decode();
    const expected = document.createElement('canvas'); expected.width = canvas.width; expected.height = canvas.height;
    const ctx = expected.getContext('2d')!; ctx.fillStyle = '#080705'; ctx.fillRect(0, 0, expected.width, expected.height);
    const scale = Math.min(expected.width / image.width, expected.height / image.height);
    ctx.drawImage(image, (expected.width - image.width * scale) / 2, (expected.height - image.height * scale) / 2, image.width * scale, image.height * scale);
    return canvas.toDataURL() === expected.toDataURL();
  })).toBe(true);
  const y = await page.evaluate(() => scrollY);
  const progress = await page.locator('.cars canvas').getAttribute('data-progress');
  await page.getByRole('slider').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuetext', 'Cafés');
  expect(await page.evaluate(() => scrollY)).toBe(y);
  await expect(page.getByText('Café animation coming', { exact: true }).first()).toBeVisible();
  await page.evaluate(() => window.scrollBy({ top: 150, behavior: 'instant' }));
  expect(await page.locator('.cars canvas').getAttribute('data-progress')).toBe(progress);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuetext', 'Cars');
  await expect(page.locator('.cars canvas')).toHaveAttribute('data-progress', progress!);
});

test('mouse drag direction, vertical threshold, button taps, and tabs', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('.hero-switch');
  const slider = page.getByRole('slider');
  await page.mouse.move(1300, 650); await page.mouse.down(); await page.mouse.move(200, 650, { steps: 20 }); await page.mouse.up();
  await expect(slider).toHaveAttribute('aria-valuetext', 'Cafés');
  await page.mouse.move(150, 650); await page.mouse.down(); await page.mouse.move(1250, 650, { steps: 20 }); await page.mouse.up();
  await expect(slider).toHaveAttribute('aria-valuetext', 'Cars');
  await hero.dispatchEvent('pointerdown', { pointerId: 5, pointerType: 'touch', isPrimary: true, button: 0, clientX: 700, clientY: 650 });
  await hero.dispatchEvent('pointermove', { pointerId: 5, pointerType: 'touch', isPrimary: true, clientX: 704, clientY: 500 });
  await hero.dispatchEvent('pointerup', { pointerId: 5, pointerType: 'touch', isPrimary: true, clientX: 704, clientY: 500 });
  await expect(slider).toHaveAttribute('aria-valuetext', 'Cars');
  await page.locator('#hero-scenes-cafes').click();
  await expect(slider).toHaveAttribute('aria-valuetext', 'Cafés');
  await page.locator('#hero-scenes-cafes').press('ArrowLeft');
  await expect(page.locator('#hero-scenes-cars')).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('link', { name: 'Book a car shoot', exact: true }).click();
  await expect(page).toHaveURL(/#book$/);
  await expect(slider).toHaveAttribute('aria-valuetext', 'Cars');
});

test('real mobile touch gestures switch horizontally and scroll vertically', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/');
  const cdp = await context.newCDPSession(page);
  const swipe = async (x: number, y: number, dx: number, dy: number) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 12, y: y + dy * i / 12 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await swipe(350, 650, -310, 0);
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuetext', 'Cafés');
  await swipe(35, 650, 310, 0);
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuetext', 'Cars');
  await swipe(195, 650, 0, -260);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuetext', 'Cars');
  await context.close();
});

test('puzzle solves, advances, accepts keyboard moves and tile taps', async ({ page }) => {
  await page.goto('/');
  await page.locator('#work').scrollIntoViewIfNeeded();
  const gallery = page.locator('[data-slot=sliding-puzzle-gallery]');
  await expect(gallery).toHaveAttribute('data-phase', 'solved');
  const board = page.locator('[data-board]');
  const previousMoves = Number(await page.locator('[data-moves]').textContent());
  await board.focus(); await page.keyboard.press('ArrowRight');
  await expect(gallery).toHaveAttribute('data-phase', 'playing');
  await expect(page.locator('[data-moves]')).toHaveText(String(previousMoves + 1));
  await page.locator('[data-action=solve]').click();
  await expect(gallery).toHaveAttribute('data-phase', 'solved');
  // Moving the tile immediately left of the solved blank is always legal.
  await page.locator('[data-tile="14"]').click();
  await expect(gallery).toHaveAttribute('data-phase', 'playing');
  await page.locator('[data-action=solve]').click();
  await expect(gallery).toHaveAttribute('data-phase', 'solved');
  await expect(gallery).toHaveAttribute('data-photo', '1', { timeout: 15_000 });
  await expect(gallery).toHaveAttribute('data-phase', 'solved');
  await page.locator('[data-action=shuffle]').click();
  await expect(gallery).toHaveAttribute('data-phase', 'shuffling');
  await expect(gallery).toHaveAttribute('data-phase', 'solved');
});

test('booking validation and encoded WhatsApp message', async ({ page }) => {
  await page.goto('/'); await page.locator('#book').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: "Let's talk on WhatsApp" }).click();
  await expect(page.locator('#name-error')).toHaveText('Please enter your name.');
  await expect(page.locator('#about-error')).toBeVisible();
  await expect(page.locator('#name')).toBeFocused();
  await page.locator('#name').fill('Sam & Co');
  await page.locator('#type').selectOption('Café');
  await page.locator('#date').fill('2026-12-12');
  await page.locator('#about').fill('Coffee & cake, Main Road. Photos + reels.');
  await page.evaluate(() => { window.open = ((url: string | URL) => { (window as unknown as { lastOpened: string }).lastOpened = String(url); return null; }) as typeof window.open; });
  await page.getByRole('button', { name: "Let's talk on WhatsApp" }).click();
  const url = new URL(await page.evaluate(() => (window as unknown as { lastOpened: string }).lastOpened));
  expect(url.origin + url.pathname).toBe('https://wa.me/919701414074');
  expect(url.searchParams.get('text')).toContain('Name: Sam & Co\nShooting: Café\nPreferred date: 2026-12-12\nAbout the shoot: Coffee & cake, Main Road. Photos + reels.');
  await expect(page.getByRole('status')).toContainText('Your message is ready.');
  for (const link of await page.locator('.service-link').all()) expect(new URL((await link.getAttribute('href'))!).searchParams.get('text')).toContain('request a custom quotation');
});

test('reduced motion keeps the first car frame and instantly switches', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.cars canvas')).toHaveAttribute('data-frame', '0');
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'instant' }));
  await expect(page.locator('.cars canvas')).toHaveAttribute('data-frame', '0');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.locator('#hero-scenes-cafes').click();
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuetext', 'Cafés');
  expect(await page.locator('.scene-handle').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});

test('halftone wordmark reacts to the pointer and click', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.locator('footer').scrollIntoViewIfNeeded();
  const canvas = page.locator('footer canvas');
  await expect.poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.width)).toBe(1440);
  await page.waitForTimeout(200);
  const before = await canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL());
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 60, box.y + box.height - 60);
  await expect.poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL())).not.toBe(before);
  await page.mouse.click(box.x + 60, box.y + box.height - 60);
  const clicked = await canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL());
  await page.mouse.move(1, 1);
  await expect.poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL())).not.toBe(clicked);
});
