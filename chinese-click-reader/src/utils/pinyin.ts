import { pinyin } from 'pinyin-pro';
export const getPinyin = (text: string) => pinyin(text, { toneType: 'symbol', type: 'string', nonZh: 'consecutive' });
