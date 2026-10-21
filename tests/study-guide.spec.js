import {test, expect} from '@playwright/test';

test.use({serviceWorkers: 'block'});

const payload = {
  explanation: [{
    heading: 'Source-linked example',
    paragraphs: [
      'Literal content <script>must stay text</script> and is not executable.',
      'Dermatology هو تخصص طبي يدرس الجلد.',
      'الجلد له وظائف عديدة، ومنها حماية الجسم — Skin and Hair.'
    ],
    sourcePage: 'Slide 3',
    understandingAids: ['This is an aid, not a separate exam claim.']
  }],
  mcqs: [{
    id: 'demo-mcq-a', question: 'Which fixture option was selected?',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    answerIndex: 1, rationale: 'الإجابة في مصدر المحاضرة — see the referenced slide.',
    sourcePage: 'Slide 4'
  }],
  infographic: {
    image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==',
    alt: 'Fixture infographic preview', caption: 'Sample caption',
    sourcePage: 'Slide 5'
  }
};

async function openWithOptionalGuide(page) {
  await page.route('**/lectures/data/urology-congenital-anomalies.json', async route => {
    const result=await route.fetch();
    const data=await result.json();
    data.studyGuide=payload;
    await route.fulfill({response:result,json:data});
  });
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#lectureFilter')).toBeAttached();
  await page.locator('#lectureFilter').selectOption('urology-congenital-anomalies');
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy','false',{timeout:15000});
  await expect(page.locator('.learning-companion')).toBeVisible();
}

test('optional source-linked study guide exposes all three modes without altering existing MEQ bank', async ({page}) => {
  await openWithOptionalGuide(page);
  await expect(page.locator('.study-guide-jump')).toBeVisible();
  await expect(page.locator('.study-item').first()).toBeAttached();
  await expect(page.locator('.learning-companion .study-guide-part')).toHaveCount(3);
  await page.locator('.study-guide-jump').click();
  const guide=page.locator('.learning-companion');
  await expect(guide.getByRole('heading',{name:'Source-linked example'})).toBeVisible();
  await expect(guide.getByText('Understanding Aid — Not an additional exam fact')).toBeVisible();
  await expect(guide.locator('script')).toHaveCount(0);
  await expect(guide.getByText('<script>must stay text</script>',{exact:false})).toBeVisible();

  await guide.getByText('MCQ practice (1)').click();
  const options=guide.locator('.study-guide-choices input[type="radio"]');
  await expect(options).toHaveCount(4);
  await options.nth(1).check();
  await guide.getByRole('button',{name:'Reveal explanation'}).click();
  await expect(guide.locator('.study-guide-answer')).toContainText('Your answer is correct.');
  await expect(guide.locator('.study-guide-answer')).toContainText('Option B');
  await expect(guide.getByText('Lecture source: Slide 4')).toBeVisible();

  await guide.getByText('Infographic',{exact:true}).click();
  await expect(guide.getByRole('img',{name:'Fixture infographic preview'})).toBeVisible();
  await expect(guide.getByText('Lecture source: Slide 5')).toBeVisible();
});

test('legacy lectures show no empty study guide section and preserve original content', async ({page}) => {
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await page.locator('#lectureFilter').selectOption('urology-congenital-anomalies');
  await expect(page.locator('#mainContent')).toHaveAttribute('aria-busy','false',{timeout:15000});
  await expect(page.locator('.learning-companion')).toHaveCount(0);
  await expect(page.locator('.study-guide-jump')).toHaveCount(0);
  await expect(page.locator('.study-item').first()).toBeAttached();
});

test('mixed Arabic and English source text follows natural direction without overflow', async ({page}) => {
  await openWithOptionalGuide(page);
  await page.setViewportSize({width:320,height:700});
  await page.locator('.learning-companion .study-guide-part').first().locator('summary').click();
  const paragraphs=page.locator('.study-guide-explanation p');
  await expect(paragraphs).toHaveCount(3);
  for (const paragraph of await paragraphs.all()) {
    await expect(paragraph).toHaveAttribute('dir','auto');
  }
  const directions=await paragraphs.evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).direction));
  expect(directions).toEqual(['ltr','ltr','rtl']);
  const fits=await paragraphs.evaluateAll(nodes=>nodes.every(el=>el.scrollWidth<=el.clientWidth+1));
  expect(fits).toBe(true);
  const heading=page.locator('.study-guide-explanation h3').first();
  await expect(heading).toHaveAttribute('dir','auto');

  await page.locator('.learning-companion .study-guide-part').nth(1).locator('summary').click();
  const question=page.locator('.study-guide-mcq').first();
  await question.locator('input[type="radio"]').nth(1).check();
  await question.getByRole('button',{name:'Reveal explanation'}).click();
  await expect(question.locator('.study-guide-answer')).toContainText('Option B');
  const rationale=question.locator('.study-guide-answer span[dir="auto"]');
  await expect(rationale).toHaveText('الإجابة في مصدر المحاضرة — see the referenced slide.');
  expect(await rationale.evaluate(el=>getComputedStyle(el).direction)).toBe('rtl');
  await expect(question.locator('.study-guide-answer bdi')).toHaveText('Option B');
});
