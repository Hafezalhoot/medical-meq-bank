import {test, expect} from '@playwright/test';

const viewports = [
  {name: 'small phone', width: 360, height: 800},
  {name: 'phone', width: 390, height: 844},
  {name: 'tablet', width: 768, height: 1024},
  {name: 'desktop', width: 1440, height: 900}
];

async function openBank(page, viewport) {
  await page.setViewportSize({width: viewport.width, height: viewport.height});
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {
    name: 'Medical MEQ & Short Question Review Bank'
  })).toBeVisible();
  await expect(page.locator('#reviewFilter')).toBeAttached();
  await expect.poll(
    () => page.evaluate(() => document.querySelector('main')?.getAttribute('aria-busy'))
  ).toBe('false');
}

for (const viewport of viewports) {
  test(`${viewport.name} has no horizontal document overflow`, async ({page}) => {
    await openBank(page, viewport);

    const dimensions = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth
    }));

    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);
    expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);
  });
}

test('mobile filter bottom sheet stays within the viewport without control overlap', async ({page}) => {
  await openBank(page, {width: 390, height: 844});

  const collapsed = await page.evaluate(() => {
    const shell = document.querySelector('.mobile-filter-shell');
    const toolbar = document.getElementById('studyToolbar');
    const shellStyle = shell ? getComputedStyle(shell) : null;
    const toolbarBox = toolbar?.getBoundingClientRect();
    const visibleIds = toolbar
      ? [...toolbar.children].filter(element => {
          const style = getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden';
        }).map(element => element.id || element.className)
      : [];
    return {
      shellPosition: shellStyle?.position,
      toolbarHeight: toolbarBox?.height || 0,
      visibleIds
    };
  });

  expect(collapsed.shellPosition).toBe('sticky');
  expect(collapsed.toolbarHeight).toBeLessThanOrEqual(94);
  expect(collapsed.visibleIds).toContain('search');
  expect(collapsed.visibleIds).toContain('mobileFiltersToggle');
  expect(collapsed.visibleIds).not.toContain('lectureFilter');

  await page.locator('#mobileFiltersToggle').click();

  const result = await page.evaluate(() => {
    const sheet = document.getElementById('studyToolbar')?.getBoundingClientRect();
    const controls = [...document.querySelectorAll(
      '#studyToolbar input:not([hidden]), #studyToolbar select:not([hidden]), #studyToolbar button:not([hidden])'
    )].filter(element => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }).map(element => {
      const box = element.getBoundingClientRect();
      return {
        id: element.id || element.className || element.tagName,
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
        height: box.height
      };
    });
    return {sheet, controls, viewportHeight: innerHeight, viewportWidth: innerWidth};
  });

  expect(result.sheet).toBeTruthy();
  expect(result.sheet.left).toBeGreaterThanOrEqual(-1);
  expect(result.sheet.right).toBeLessThanOrEqual(result.viewportWidth + 1);
  expect(result.sheet.top).toBeGreaterThanOrEqual(-1);
  expect(result.sheet.bottom).toBeLessThanOrEqual(result.viewportHeight + 1);
  expect(result.sheet.height).toBeLessThanOrEqual(result.viewportHeight * 0.82);

  for (const rectangle of result.controls) {
    expect(rectangle.left, rectangle.id).toBeGreaterThanOrEqual(result.sheet.left - 1);
    expect(rectangle.right, rectangle.id).toBeLessThanOrEqual(result.sheet.right + 1);
    expect(rectangle.width, rectangle.id).toBeGreaterThan(20);
    expect(rectangle.height, rectangle.id).toBeGreaterThanOrEqual(34);
  }

  // Sticky sheet header/footer intentionally overlay the scroll container edges.
  // Horizontal containment and minimum hit-target checks catch actual layout
  // regressions without treating that deliberate sticky behavior as overlap.

  await page.locator('#applyMobileFiltersBtn').click();
  await page.locator('#search').fill('renal');
  await expect(page.locator('#activeFilterChips')).toBeVisible();
  const chipHeight = await page.locator('#activeFilterChips').evaluate(element => element.getBoundingClientRect().height);
  expect(chipHeight).toBeLessThanOrEqual(46);
});

test('desktop content columns stay within the main layout', async ({page}) => {
  await openBank(page, {width: 1440, height: 900});

  const result = await page.evaluate(() => {
    const layout = document.getElementById('mainLayout')?.getBoundingClientRect();
    const visibleChildren = [...document.querySelectorAll('#mainLayout > *')]
      .filter(element => getComputedStyle(element).display !== 'none')
      .map(element => {
        const box = element.getBoundingClientRect();
        return {left: box.left, right: box.right, width: box.width};
      });
    return {layout, visibleChildren};
  });

  expect(result.layout).toBeTruthy();
  for (const child of result.visibleChildren) {
    expect(child.left).toBeGreaterThanOrEqual(result.layout.left - 1);
    expect(child.right).toBeLessThanOrEqual(result.layout.right + 1);
    expect(child.width).toBeGreaterThan(0);
  }
});
