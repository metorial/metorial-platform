import { describe, expect, it } from 'vitest';
import {
  isSkillIcon,
  renderSkillIconDataUrl,
  renderSkillIconSvg,
  SKILL_ICON_IDS
} from './index';

describe('skill icons', () => {
  it('renders a tile svg for a known icon', () => {
    let svg = renderSkillIconSvg({ icon: 'rocket-2-line', color: 'green', size: 64 });

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('fill="#e6f6ec"');
    expect(svg).toContain('fill="#1f8a4c"');
    expect(svg).not.toContain('Gradient');
  });

  it('throws for unknown icons', () => {
    expect(() => renderSkillIconSvg({ icon: 'not-an-icon', color: 'blue' })).toThrow();
  });

  it('validates icon and color combinations', () => {
    expect(isSkillIcon({ icon: SKILL_ICON_IDS[0]!, color: 'blue' })).toBe(true);
    expect(isSkillIcon({ icon: SKILL_ICON_IDS[0]!, color: 'pink' })).toBe(false);
    expect(isSkillIcon({ icon: 'nope', color: 'blue' })).toBe(false);
  });

  it('produces a base64 data url', () => {
    let url = renderSkillIconDataUrl({ icon: 'rocket-2-line', color: 'blue' });

    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);
  });
});
