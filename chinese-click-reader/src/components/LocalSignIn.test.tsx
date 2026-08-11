import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LocalProfileMenu, LocalSignIn, type LocalProfileSummary } from './LocalSignIn';

const profiles: LocalProfileSummary[] = [
  {
    id: 'profile-joshua',
    displayName: 'Joshua',
    lessonCount: 4,
    wordCount: 28,
    lastUsedLabel: 'Used today',
  },
  {
    id: 'profile-li',
    displayName: '李月',
    lessonCount: 1,
    wordCount: 8,
  },
];

describe('local profile UI', () => {
  it('renders a distinct returning-user sign-in form with honest local-only copy', () => {
    const html = renderToStaticMarkup(
      <LocalSignIn
        profiles={profiles}
        onSignIn={() => undefined}
        onCreateProfile={() => undefined}
      />,
    );

    expect(html).toContain('Sign in to your reader');
    expect(html).toContain('Welcome back');
    expect(html).toContain('Enter the email used');
    expect(html).toContain('type="email"');
    expect(html).toContain('Sign in');
    expect(html).toContain('not an online account');
    expect(html).toContain('do not sync automatically');
    expect(html).toContain('not an online account');
  });

  it('starts with an accessible creation form when there are no profiles', () => {
    const html = renderToStaticMarkup(
      <LocalSignIn
        profiles={[]}
        onSignIn={() => undefined}
        onCreateProfile={() => undefined}
      />,
    );

    expect(html).toContain('Create your local account');
    expect(html).toContain('Profile name');
    expect(html).toContain('Email');
    expect(html).toContain('type="email"');
    expect(html).toContain('required=""');
    expect(html).toContain('maxLength="40"');
    expect(html).toContain('No password is stored');
  });

  it('renders a compact signed-in profile menu without implying cloud sync', () => {
    const html = renderToStaticMarkup(
      <LocalProfileMenu
        profile={profiles[0]}
        onSwitchProfile={() => undefined}
        onLeaveProfile={() => undefined}
      />,
    );

    expect(html).toContain('Local profile menu for Joshua');
    expect(html).toContain('Switch profile');
    expect(html).toContain('Sign out');
    expect(html).toContain('do not sync automatically');
  });
});
