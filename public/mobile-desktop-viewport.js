// Keep the desktop layout on touch mobile devices. This file must load before
// React and CSS so the viewport media queries see the desktop width immediately.
// It is external because the production Content-Security-Policy blocks inline JS.
if (/Android|iPad|iPhone|iPod|Windows Phone|Opera Mini/i.test(navigator.userAgent)
    || navigator.userAgentData?.mobile
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
  document.documentElement.dataset.phoneDesktop = 'true';

  const viewport = document.querySelector('meta[name="viewport"]');
  let fittedScreenWidth = 0;

  const fitDesktopToScreen = () => {
    const screenWidth = Math.max(1, screen.width);
    if (screenWidth === fittedScreenWidth) return;
    fittedScreenWidth = screenWidth;
    viewport.content = `width=1280, initial-scale=${screenWidth / 1280}`;
    document.documentElement.style.setProperty(
      '--phone-banner-factor', String(1280 / screenWidth));
  };

  fitDesktopToScreen();
  window.addEventListener('resize', fitDesktopToScreen);
}
