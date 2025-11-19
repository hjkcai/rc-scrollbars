let scrollbarWidth: number | undefined = undefined;
let pxRatio: number = getPxRatio();

export default function getScrollbarWidth() {
  /**
   * Check zoom ratio. If it was changed, then it would update scrollbatWidth
   */
  const newPxRatio = getPxRatio();

  if (pxRatio !== newPxRatio) {
    scrollbarWidth = getScrollbarWidthFromDom();
    pxRatio = newPxRatio;
  }

  if (typeof scrollbarWidth === 'number') return scrollbarWidth;

  /* istanbul ignore else */
  if (typeof document !== 'undefined') {
    scrollbarWidth = getScrollbarWidthFromDom();
  } else {
    scrollbarWidth = 0;
  }

  return scrollbarWidth || 0;
}

function getScrollbarWidthFromDom() {
  const div = document.createElement('div');

  Object.assign(div.style, {
    width: '100px',
    height: '100px',
    position: 'absolute',
    top: '-9999',
    overflow: 'scroll',
  });

  document.body.appendChild(div);
  const result = div.offsetWidth - div.clientWidth;
  document.body.removeChild(div);

  return result;
}

function getPxRatio() {
  if (typeof window === 'undefined') return 1;
  return window.screen.availWidth / document.documentElement.clientWidth;
}
