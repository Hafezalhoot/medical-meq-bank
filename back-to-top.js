(() => {
  if (document.getElementById('backToTopBtn')) return;

  const button = document.createElement('button');
  button.id = 'backToTopBtn';
  button.type = 'button';
  button.className = 'back-to-top';
  button.setAttribute('aria-label', 'Back to top');
  button.setAttribute('title', 'Back to top');
  button.tabIndex = -1;
  button.innerHTML = `
    <span class="back-to-top-surface" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M12 19V5"></path>
        <path d="m6 11 6-6 6 6"></path>
      </svg>
    </span>
    <span class="back-to-top-label" aria-hidden="true">Back to top</span>`;
  document.body.appendChild(button);

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let scheduled = false;

  const readScrollTop = () => window.scrollY || document.documentElement.scrollTop || 0;

  const update = () => {
    scheduled = false;
    const scrollTop = readScrollTop();
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.max(0, Math.min(1, scrollTop / maxScroll));
    const threshold = Math.max(320, Math.min(620, window.innerHeight * .55));
    const visible = scrollTop > threshold;

    button.style.setProperty('--scroll-progress', `${(progress * 360).toFixed(1)}deg`);
    button.classList.toggle('is-visible', visible);
    button.tabIndex = visible ? 0 : -1;
  };

  const scheduleUpdate = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  };

  button.addEventListener('click', event => {
    const keyboardActivation = event.detail === 0;
    window.scrollTo({top: 0, left: 0, behavior: reduceMotion?.matches ? 'auto' : 'smooth'});

    if (keyboardActivation) {
      const heading = document.querySelector('.hero h1, main h1, h1');
      if (heading) {
        const hadTabIndex = heading.hasAttribute('tabindex');
        if (!hadTabIndex) heading.setAttribute('tabindex', '-1');
        window.setTimeout(() => {
          try { heading.focus({preventScroll: true}); } catch (error) { heading.focus(); }
          if (!hadTabIndex) heading.addEventListener('blur', () => heading.removeAttribute('tabindex'), {once: true});
        }, reduceMotion?.matches ? 0 : 420);
      }
    }
  });

  window.addEventListener('scroll', scheduleUpdate, {passive: true});
  window.addEventListener('resize', scheduleUpdate, {passive: true});
  reduceMotion?.addEventListener?.('change', scheduleUpdate);

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(document.documentElement);
  }

  update();
})();
