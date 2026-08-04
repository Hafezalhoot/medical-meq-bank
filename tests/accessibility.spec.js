import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({serviceWorkers: 'block'});

async function openBank(page) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {
    name: 'Medical MEQ & Short Question Review Bank'
  })).toBeVisible();
  await expect(page.locator('#reviewFilter')).toBeAttached();
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false', {timeout: 15_000});
  await expect(page.locator('.study-item').first()).toBeAttached();
}

async function auditPage(page) {
  return new AxeBuilder({page})
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
}

function summarize(violations) {
  return violations.map(violation => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.map(node => node.target)
  }));
}

test('desktop study bank has no automated WCAG A/AA violations', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await openBank(page);

  const results = await auditPage(page);
  expect(summarize(results.violations)).toEqual([]);
});

test('mobile filters have no automated WCAG A/AA violations', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await openBank(page);

  await page.locator('#mobileFiltersToggle').click();
  await expect(page.locator('#topicFilter')).toBeVisible();
  await page.locator('#search').fill('testicular');
  await expect(page.locator('#activeFilterChips')).toBeVisible();

  const results = await auditPage(page);
  expect(summarize(results.violations)).toEqual([]);
});
