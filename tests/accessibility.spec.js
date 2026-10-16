import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({serviceWorkers: 'block'});

async function openBank(page) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {
    name: 'Medical MEQ Review Bank'
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


test('skip link and Rapid Recall are keyboard operable', async ({page}) => {
  await openBank(page);

  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#mainContent')).toBeFocused();

  const rapid = page.locator('.rapid-item').first();
  await rapid.focus();
  await expect(rapid).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await expect(rapid).toHaveAttribute('aria-expanded', 'true');
  await expect(rapid.locator('.rapid-answer')).toBeVisible();
});

test('dark-mode restoration keeps the vector control and accessible label', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('medicalBankDarkV4', '1'));
  await openBank(page);

  const button = page.locator('#darkBtn');
  await expect(page.locator('body')).toHaveClass(/dark/);
  await expect(button.locator('svg')).toHaveCount(1);
  await expect(button.locator('[data-theme-label]')).toHaveText('Light mode');
  await expect(button).toHaveAttribute('aria-label', 'Switch to light mode');

  await button.click();
  await expect(page.locator('body')).not.toHaveClass(/dark/);
  await expect(button.locator('svg')).toHaveCount(1);
  await expect(button.locator('[data-theme-label]')).toHaveText('Dark mode');
});


test('study hierarchy and progress expose semantic orientation', async ({page}) => {
  await openBank(page);

  const breadcrumb = page.locator('#studyBreadcrumb');
  await expect(breadcrumb).toHaveAttribute('aria-label', 'Study location');
  await expect(breadcrumb.getByText('Course', {exact: true})).toBeVisible();
  await expect(breadcrumb.getByText('Specialty', {exact: true})).toBeVisible();
  await expect(breadcrumb.locator('[aria-current="page"] strong')).not.toBeEmpty();

  for (const id of ['coreProgressBar', 'overallProgressBar']) {
    const bar = page.locator('#' + id);
    await expect(bar).toHaveAttribute('role', 'progressbar');
    await expect(bar).toHaveAttribute('aria-valuemin', '0');
    await expect(bar).toHaveAttribute('aria-valuemax', '100');
    await expect(bar).toHaveAttribute('aria-valuenow', /^\d{1,3}$/);
  }
});
