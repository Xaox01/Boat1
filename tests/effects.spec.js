// Testy wizualne efektów ImpactFX — Playwright screenshot regression
// Uruchomienie: npx playwright test
// Aktualizacja baseline: npx playwright test --update-snapshots
//
// Wymaga działającego serwera: npm run dev

import { test, expect } from '@playwright/test';

const GAME_URL = '/';
const CANVAS_SEL = 'canvas';

// Pomocnik: czeka aż window.__gameTest.ready() === true
async function waitForGame(page) {
  await page.waitForFunction(() => window.__gameTest?.ready?.() === true, {
    timeout: 12_000,
  });
}

// Pomocnik: wykonuje komendę DevConsole i czeka chwilę
async function devCmd(page, cmd, waitMs = 400) {
  await page.evaluate((c) => window.__gameTest.exec(c), cmd);
  await page.waitForTimeout(waitMs);
}

// ── Setup wspólny ─────────────────────────────────────────────────────────────
test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
  await waitForGame(page);

  // God mode + sub blisko powierzchni żeby efekty były widoczne
  await devCmd(page, 'god');
  await devCmd(page, 'depth 15', 300);
  // Pauza AI — czyste tło
  await devCmd(page, 'speed 0.05', 200);
});

// ── Test 1: Wybuch przy tafli (surface mode) ──────────────────────────────────
test('fx: wybuch surface przy tafli wody', async ({ page }) => {
  // Triggerujemy 1 wybuch w centrum kamery
  await devCmd(page, 'boom 1 0 surf', 100);

  // Screenshoty w 3 klatkach — peak animacji (≈0.3s / 0.65s / 1.1s po wybuchu)
  for (const [label, ms] of [['frame_300ms', 300], ['frame_650ms', 650], ['frame_1100ms', 1100]]) {
    await page.waitForTimeout(ms === 300 ? 300 : ms - 300);
    const canvas = page.locator(CANVAS_SEL);
    await expect(canvas).toHaveScreenshot(`surface-explosion-${label}.png`, {
      maxDiffPixelRatio: 0.05,
    });
  }
});

// ── Test 2: Wybuch podwodny (underwater mode) ─────────────────────────────────
test('fx: wybuch underwater — fala ciśnienia i bąble', async ({ page }) => {
  await devCmd(page, 'depth 15', 300);   // blisko tafli — widać i wybuch i bąble
  await devCmd(page, 'boom 1 0 deep', 100);

  for (const [label, ms] of [['frame_400ms', 400], ['frame_900ms', 900], ['frame_1800ms', 1800]]) {
    await page.waitForTimeout(ms === 400 ? 400 : ms - 400);
    const canvas = page.locator(CANVAS_SEL);
    await expect(canvas).toHaveScreenshot(`underwater-explosion-${label}.png`, {
      maxDiffPixelRatio: 0.06,
    });
  }
});

// ── Test 3: Wybuch przy dnie (sediment + bąble) ───────────────────────────────
test('fx: wybuch przy dnie — osad denny i bąble', async ({ page }) => {
  await devCmd(page, 'depth 200', 400);  // idź głębiej żeby zobaczyć dno
  await devCmd(page, 'boom 1 0 floor', 100);

  for (const [label, ms] of [['frame_300ms', 300], ['frame_1000ms', 1000], ['frame_2500ms', 2500]]) {
    await page.waitForTimeout(ms === 300 ? 300 : ms - 300);
    const canvas = page.locator(CANVAS_SEL);
    await expect(canvas).toHaveScreenshot(`floor-explosion-${label}.png`, {
      maxDiffPixelRatio: 0.06,
    });
  }
});

// ── Test 4: Pożar okrętu ──────────────────────────────────────────────────────
test('fx: pożar okrętu (inferno hull=8%)', async ({ page }) => {
  await devCmd(page, 'depth 2', 300);
  await devCmd(page, 'speed 1', 100);
  await devCmd(page, 'firetest 1', 800);   // spawnuj palący się okręt

  // Daj 1s na rozgrzanie cząsteczek ognia
  await page.waitForTimeout(1000);

  const canvas = page.locator(CANVAS_SEL);
  await expect(canvas).toHaveScreenshot('ship-fire-inferno.png', {
    maxDiffPixelRatio: 0.08,   // ogień jest losowy — większy margines
  });

  // Zrzut po kolejnych 2s (ogień powinien być stabilny)
  await page.waitForTimeout(2000);
  await expect(canvas).toHaveScreenshot('ship-fire-inferno-2s.png', {
    maxDiffPixelRatio: 0.08,
  });
});

// ── Test 5: Salwa 3 wybuchów ──────────────────────────────────────────────────
test('fx: salwa 3 wybuchów przy tafli', async ({ page }) => {
  await devCmd(page, 'boom 3 200 surf', 100);
  await page.waitForTimeout(600);  // peak animacji

  const canvas = page.locator(CANVAS_SEL);
  await expect(canvas).toHaveScreenshot('salvo-3-surface.png', {
    maxDiffPixelRatio: 0.06,
  });
});

// ── Test 6: Brak błędów JS w konsoli ─────────────────────────────────────────
test('fx: brak błędów JS podczas testfx', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await devCmd(page, 'speed 3', 100);   // przyspiesz żeby sekwencja szybciej minęła
  await devCmd(page, 'testfx', 200);
  await page.waitForTimeout(8000);      // czekaj na całą sekwencję (≈8s przy speed×3)

  // Filtruj błędy niekrytyczne (Phaser logi, Vite HMR)
  const critical = errors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('[vite]') &&
    !e.includes('WebSocket')
  );

  expect(critical, `Błędy JS:\n${critical.join('\n')}`).toHaveLength(0);
});
