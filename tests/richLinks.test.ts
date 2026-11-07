import { describe, expect, it } from 'vitest';
import { isAddressText } from '../src/editor/linkPreviews';
import { faviconStyle } from '../src/nodes/richLinks';

describe('links in rich text', () => {
  it('treats a link written as its own address as an address', () => {
    expect(isAddressText('https://www.github.com/', 'https://github.com')).toBe(true);
    expect(isAddressText('github.com', 'https://github.com/')).toBe(true);
    expect(isAddressText('my profile', 'https://github.com/me')).toBe(false);
  });

  it('only shows icons Mubu saved itself', () => {
    expect(faviconStyle('content/assets/ab12.png')).toContain('content/assets/ab12.png');
    expect(faviconStyle('https://evil.example/x.png')).toBeUndefined();
    expect(faviconStyle('content/assets/x.png") ; background: red')).toBeUndefined();
  });
});
