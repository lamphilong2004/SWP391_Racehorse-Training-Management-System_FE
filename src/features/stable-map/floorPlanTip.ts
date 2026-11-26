const TIP_GAP = 4;

/**
 * Keeps the hover card fully visible. The card has a CSS-pixel width while the plan scales with its container, so the
 * position is corrected from the rendered boxes: the card is shifted to stay inside both the plan and the viewport,
 * and its arrow moves back by the same amount so it still points at the stall.
 */
export function clampTip(tip: HTMLElement, wrap: HTMLElement) {
  tip.style.marginLeft = '0px';
  const card = tip.getBoundingClientRect(), area = wrap.getBoundingClientRect();
  const viewport = document.documentElement.clientWidth || window.innerWidth;
  const left = Math.max(area.left, 0) + TIP_GAP, right = Math.min(area.right, viewport) - TIP_GAP;
  const shift = card.width >= right - left ? left - card.left
    : card.left < left ? left - card.left : card.right > right ? right - card.right : 0;
  tip.style.marginLeft = `${shift}px`;
  tip.style.setProperty('--arrow-x', `${Math.min(Math.max(card.width / 2 - shift, 14), Math.max(card.width - 14, 14))}px`);
}
