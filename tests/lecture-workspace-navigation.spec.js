import {test, expect} from '@playwright/test';

test.use({serviceWorkers: 'block'});

const derm = 'internal-medicine-ii-dermatology-introduction';

async function openDermatology(page, mobile=false) {
  if (mobile) await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#courseSelector')).toBeVisible();
  await page.locator('#courseSelector').selectOption('internal-medicine-ii');
  await expect(page.locator('#subjectSelector')).toHaveValue('dermatology');
  await expect(page.locator('#lecture-'+derm)).toBeVisible({timeout:20000});
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy','false',{timeout:20000});
}

test('source guide has separate keyboard-accessible Explanation, MCQ and original-figure shortcuts', async ({page}) => {
  await openDermatology(page);
  const nav = page.getByRole('navigation',{name:'Lecture sections'});
  const shortcuts = [
    {name:'Explanation', id:derm+'-guide-explanation'},
    {name:'MCQ practice', id:derm+'-guide-mcqs'},
    {name:'Original lecture figures', id:derm+'-guide-original-figures'}
  ];
  for(const shortcut of shortcuts) {
    const button=nav.getByRole('button',{name:shortcut.name,exact:true});
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('aria-controls',shortcut.id);
    await button.click();
    const details=page.locator('#'+shortcut.id);
    await expect(details).toHaveAttribute('open','');
    await expect(details.locator('summary')).toBeFocused();
  }
  await expect(nav.getByRole('button',{name:'Infographic',exact:true})).toHaveCount(0);
  await expect(page.locator('#'+derm+'-guide-mcqs input[type="radio"]').first()).toBeAttached();
  await expect(nav.getByRole('button',{name:/Explanation \/ MCQ \/ Original/})).toHaveCount(0);
});

test('one-lecture specialty has only authored reader destinations and fits narrow mobile', async ({page}) => {
  await openDermatology(page,true);
  const nav=page.getByRole('navigation',{name:'Lecture sections'});
  await expect(nav.getByRole('button',{name:'Explanation',exact:true})).toBeVisible();
  await expect(nav.getByRole('button',{name:'MCQ practice',exact:true})).toBeVisible();
  await expect(page.locator('.lecture-head').getByRole('button',{name:'All lectures',exact:true})).toHaveCount(0);
  await nav.getByRole('button',{name:'MCQ practice',exact:true}).click();
  await expect(page.locator('#'+derm+'-guide-mcqs')).toHaveAttribute('open','');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('legacy lecture omits unsupported explanation/MCQ shortcuts and returns to its overview', async ({page}) => {
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy','false',{timeout:20000});
  await page.locator('#lectureFilter').selectOption('urology-bladder-cancer');
  await expect(page.locator('#lecture-urology-bladder-cancer')).toBeVisible({timeout:20000});
  const nav=page.getByRole('navigation',{name:'Lecture sections'});
  await expect(nav.getByRole('button',{name:'Cases',exact:true})).toBeVisible();
  await expect(nav.getByRole('button',{name:'Explanation',exact:true})).toHaveCount(0);
  await expect(nav.getByRole('button',{name:'MCQ practice',exact:true})).toHaveCount(0);
  const back=page.locator('.lecture-head').getByRole('button',{name:'All lectures',exact:true});
  await expect(back).toBeVisible();
  await back.click();
  await expect(page.locator('#lectureFilter')).toHaveValue('all');
  await expect(page.getByRole('heading',{name:'Urology lectures'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Open lecture: Bladder Cancer'})).toBeVisible();
  await expect(page.locator('.lecture-overview-panel h2')).toBeFocused();
});
