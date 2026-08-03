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

test('mobile filter controls remain inside the viewport and do not overlap', async ({page}) => {
  await openBank(page, {width: 390, height: 844});
  await page.locator('#mobileFiltersToggle').click();

  const rectangles = await page.evaluate(() => {
    const controls = [...document.querySelectorAll(
      '#studyToolbar input:not([hidden]), #studyToolbar select:not([hidden]), #studyToolbar button:not([hidden])'
    )].filter(element => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    return controls.map(element => {
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
  });

  for (const rectangle of rectangles) {
    expect(rectangle.left, rectangle.id).toBeGreaterThanOrEqual(-1);
    expect(rectangle.right, rectangle.id).toBeLessThanOrEqual(391);
    expect(rectangle.width, rectangle.id).toBeGreaterThan(20);
    expect(rectangle.height, rectangle.id).toBeGreaterThanOrEqual(34);
  }

  for (let first = 0; first < rectangles.length; first += 1) {
    for (let second = first + 1; second < rectangles.length; second += 1) {
      const a = rectangles[first];
      const b = rectangles[second];
      const overlapWidth = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const overlapHeight = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const meaningfulOverlap = overlapWidth > 2 && overlapHeight > 2;
      expect(meaningfulOverlap, `${a.id} overlaps ${b.id}`).toBe(false);
    }
  }
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
