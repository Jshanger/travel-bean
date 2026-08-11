import { Platform, Share } from 'react-native';

type ShareLinkInput = {
  url: string;
  title: string;
  text?: string;
};

export async function sharePublicLink({ url, title, text }: ShareLinkInput) {
  if (!url) return 'missing' as const;

  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.share) {
      await nav.share({ title, text, url });
      return 'shared' as const;
    }
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(url);
      return 'copied' as const;
    }
    return 'unsupported' as const;
  }

  await Share.share({
    title,
    url,
    message: text ? `${text}\n${url}` : url,
  });
  return 'shared' as const;
}
