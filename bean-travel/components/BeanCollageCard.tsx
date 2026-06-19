import { Image, type ImageContentPosition } from 'expo-image';
import React from 'react';
import { ImageStyle, Platform, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import CreateBeanMascot from '@/components/CreateBeanMascot';
import type { QuotePlacement } from '@/utils/quoteLibrary';
import { BeanLayout, BeanMood, formatDate } from '@/utils/travelBeanMvp';

const INK = '#2A1714';
const MUTED = '#7B6258';
const BORDER = '#F1D7C5';
const ORANGE = '#F26A2E';
const NO_WORD_BREAK = { wordBreak: 'keep-all', overflowWrap: 'normal' } as unknown as TextStyle;
const GRAYSCALE_IMAGE_STYLE = Platform.OS === 'web' ? ({ filter: 'grayscale(1)' } as unknown as ImageStyle) : undefined;
const FILM_DIRECTOR_BEAN = require('../assets/images/template-beans/film-director-bean.png');
const BOARDING_PASS_BEAN = require('../assets/images/template-beans/boarding-pass-bean.png');
const AIRMAIL_BEAN = require('../assets/images/template-beans/airmail-bean.png');
const STUDIOUS_QUOTE_BEAN = require('../assets/images/template-beans/studious-quote-bean.png');
const FOOD_TRIP_BEAN = require('../assets/images/template-beans/food-trip-bean.png');
const PREMIUM_TEXT_POSTCARDS = new Set([
  'This Is Postcard',
  'Wish You Were Here',
  'Snapshots Postcard',
  'City Cover',
  'Black City Postcard',
  'Any City Mosaic',
  'Seek Travel',
  'Mountain Postcard',
  'Temple Heritage',
  'Break Postcard',
  'Destination Sidebar',
  'Greetings Grid',
  'Masthead Postcard',
  'Pinned Snapshot',
]);

const TEXTURE_DOTS = [
  { left: '8%', top: '12%', size: 3 },
  { left: '18%', top: '72%', size: 2 },
  { left: '31%', top: '24%', size: 2 },
  { left: '43%', top: '84%', size: 3 },
  { left: '57%', top: '16%', size: 2 },
  { left: '69%', top: '62%', size: 3 },
  { left: '82%', top: '28%', size: 2 },
  { left: '92%', top: '78%', size: 2 },
  { left: '14%', top: '42%', size: 2 },
  { left: '76%', top: '9%', size: 3 },
] as const;

interface Props {
  place: string;
  country: string;
  date: string;
  mood?: BeanMood | string;
  story: string;
  photo: string;
  photos?: string[];
  title?: string;
  layout?: BeanLayout | string;
  compact?: boolean;
  hasWatermark?: boolean;
  exportQuality?: 'standard' | 'hd';
  selectedQuoteText?: string | null;
  selectedQuoteAuthor?: string | null;
  quotePlacement?: QuotePlacement;
}

type CollageMeta = {
  place: string;
  country: string;
  date: string;
  title: string;
  story: string;
  selectedQuoteText?: string | null;
  selectedQuoteAuthor?: string | null;
  quotePlacement?: QuotePlacement;
};

function TemplatePhoto({
  uri,
  style,
  imageStyle,
  contentPosition = 'top center',
  contentFit = 'cover',
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  contentPosition?: ImageContentPosition;
  contentFit?: 'cover' | 'contain';
}) {
  if (!uri) return <View style={[styles.templatePhotoFrame, style]} />;

  return (
    <View style={[styles.templatePhotoFrame, style]}>
      <Image
        source={{ uri }}
        style={[styles.templatePhotoBackdrop, imageStyle]}
        contentFit="cover"
        contentPosition={contentPosition}
      />
      <Image
        source={{ uri }}
        style={[styles.templatePhotoImage, imageStyle]}
        contentFit={contentFit}
        contentPosition={contentPosition}
      />
    </View>
  );
}

export default function BeanCollageCard({ place, country, date, mood, story, photo, photos = [], title, layout = 'Scrapbook Story', compact = false, hasWatermark = false, exportQuality = 'hd', selectedQuoteText = null, selectedQuoteAuthor = null, quotePlacement = 'none' }: Props) {
  const allPhotos = [photo, ...photos.filter(uri => uri !== photo)];
  const storyText = (story ?? '').trim();
  const hasStoryText = storyText.length > 0;
  const quoteText = selectedQuoteText?.trim() ?? '';
  const quoteAuthor = selectedQuoteAuthor?.trim() ?? '';
  const hasSelectedQuote = quoteText.length > 0 && quotePlacement !== 'none';
  const titleLimit = compact ? 44 : 70;
  const rawTitle = displayTitleFallback(title, place);
  const displayTitle = rawTitle.length > titleLimit ? `${place?.trim() || 'Travel'} moments` : rawTitle;
  const displayLayout = normalizeLayout(layout);
  const shellStyle = layoutShellStyle(displayLayout);
  const textPostcard = isPremiumTextPostcardLayout(displayLayout);

  return (
    <View style={[styles.generated, textPostcard && styles.generatedPostcardOnly, shellStyle, compact && styles.generatedCompact]}>
      {!compact && !textPostcard && (
        <>
          <View style={styles.paperGlow} />
        </>
      )}
      {!textPostcard && (
        <>
          <View style={styles.generatedTop}>
            <View style={{ flex: 1 }}>
              <FittedText style={[styles.generatedPlace, compact && styles.generatedPlaceCompact]} minimumFontScale={0.38}>{place || 'Somewhere'}, {country || 'Earth'}</FittedText>
              <Text style={[styles.generatedDate, compact && styles.generatedDateCompact]}>{formatDate(date)}</Text>
            </View>
          </View>
          <FittedText style={[styles.scriptTitle, compact && styles.scriptTitleCompact]} numberOfLines={2} minimumFontScale={0.36}>{displayTitle}</FittedText>
        </>
      )}
      <View style={styles.collageStage}>
        <CollageImage
          layout={displayLayout}
          photos={allPhotos}
          compact={compact}
          meta={{
            place: place || 'Travel',
            country: country || 'Earth',
            date,
            title: displayTitle,
            story: storyText,
            selectedQuoteText: null,
            selectedQuoteAuthor: null,
            quotePlacement: 'none',
          }}
        />
        {hasWatermark && <TravelStampWatermark layout={displayLayout} compact={compact} inCollage />}
      </View>
      {hasSelectedQuote && (
        <QuoteCaptionBand text={quoteText} author={quoteAuthor} compact={compact} />
      )}
      {!textPostcard && hasStoryText && (
        <View style={[styles.memoryCaption, compact && styles.memoryCaptionCompact]}>
          <Text style={styles.memoryLabel}>Memory</Text>
          <Text style={[styles.generatedStory, compact && styles.generatedStoryCompact]} numberOfLines={compact ? 2 : 4}>{storyText}</Text>
        </View>
      )}
    </View>
  );
}

function displayTitleFallback(title: string | undefined, place: string) {
  const cleanTitle = title?.replace(/\s+/g, ' ').trim();
  if (cleanTitle) return cleanTitle;

  const cleanPlace = place.replace(/\s+/g, ' ').trim();
  return `${cleanPlace || 'Travel'} memories`;
}

function templateMascotSource(layout: BeanLayout | string) {
  switch (normalizeLayout(layout)) {
    case 'Food Trip':
      return FOOD_TRIP_BEAN;
    case 'Film Strip':
      return FILM_DIRECTOR_BEAN;
    case 'Boarding Pass':
      return BOARDING_PASS_BEAN;
    case 'Airmail Border':
      return AIRMAIL_BEAN;
    default:
      return null;
  }
}

export function TemplateBeanMascotMark({ layout, size = 76 }: { layout: BeanLayout | string; size?: number }) {
  const source = templateMascotSource(layout);
  if (!source) return <CreateBeanMascot size={size} frameless bubble="heart" />;

  return (
    <View style={[styles.templateMascotMarkCircle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image source={source} style={styles.templateMascotMarkImage} contentFit="contain" />
    </View>
  );
}

function TravelStampWatermark({ layout, compact, inCollage }: { layout: BeanLayout | string; compact?: boolean; inCollage?: boolean }) {
  const small = compact;
  const customSource = templateMascotSource(layout);

  if (customSource) {
    return (
      <View pointerEvents="none" style={[styles.mascotWatermark, small && styles.mascotWatermarkSmall, compact && styles.watermarkCompact, inCollage && styles.watermarkInCollage, styles.templateMascotWatermark, small && styles.templateMascotWatermarkSmall]}>
        <TemplateBeanMascotMark layout={layout} size={small ? 56 : 76} />
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={[styles.mascotWatermark, small && styles.mascotWatermarkSmall, compact && styles.watermarkCompact, inCollage && styles.watermarkInCollage]}>
      <CreateBeanMascot size={small ? 56 : 76} frameless bubble="heart" />
      <View style={[styles.mascotWatermarkLabel, small && styles.mascotWatermarkLabelSmall]}>
        <Text style={[styles.mascotWatermarkText, small && styles.mascotWatermarkTextSmall]}>Travel Bean</Text>
      </View>
    </View>
  );
}

function StampBeanSeal({ small }: { small?: boolean }) {
  const size = small ? 16 : 22;
  const ink = 'rgba(125,75,48,0.9)';
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M28 13C22 7 15 7 10 12C15 18 22 19 28 15Z" fill={ink} opacity={0.66} />
      <Path d="M30 13C36 6 45 6 53 12C46 19 37 20 30 15Z" fill={ink} opacity={0.66} />
      <Ellipse cx="32" cy="38" rx="22" ry="21" fill="rgba(242,106,46,0.16)" stroke={ink} strokeWidth="4" />
      <Circle cx="24" cy="35" r="3.5" fill={ink} />
      <Circle cx="40" cy="35" r="3.5" fill={ink} />
      <Path d="M26 44C30 48 36 48 40 44" stroke={ink} strokeWidth="3.3" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function QuoteCaptionBand({ text, author, compact }: { text: string; author?: string; compact?: boolean }) {
  return (
    <View style={[styles.quoteCaptionBand, compact && styles.quoteCaptionBandCompact]}>
      <View style={[styles.quoteCaptionIcon, compact && styles.quoteCaptionIconCompact]}>
        <StudiousBeanBadge compact={compact} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.quoteCaptionText, compact && styles.quoteCaptionTextCompact]} numberOfLines={compact ? 2 : 3}>
          {text}
        </Text>
        {author ? (
          <Text style={[styles.quoteCaptionAuthor, compact && styles.quoteCaptionAuthorCompact]} numberOfLines={1}>
            {author}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function StudiousBeanBadge({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.studiousBeanBadge, compact && styles.studiousBeanBadgeCompact]}>
      <Image source={STUDIOUS_QUOTE_BEAN} style={styles.studiousBeanImage} contentFit="contain" />
    </View>
  );
}

function CollageImage({
  layout,
  photos,
  compact,
  meta,
}: {
  layout: BeanLayout | string;
  photos: string[];
  compact?: boolean;
  meta: CollageMeta;
}) {
  const photo = photos[0];
  const p1 = photos[1] ?? photo;
  const p2 = photos[2] ?? p1;
  const p3 = photos[3] ?? p2;
  const visiblePhotos = photos.filter(Boolean).slice(0, 8);

  if (isPremiumTextPostcardLayout(layout)) {
    return <PremiumPostcardTemplate layout={layout} photos={visiblePhotos} compact={compact} meta={meta} />;
  }

  if (
    layout === 'Postcard Stack' ||
    layout === 'Classic Postcard' ||
    layout === 'Scrapbook Story' ||
    layout === 'Postcard Mosaic' ||
    layout === 'Editorial Grid' ||
    layout === 'Film Strip' ||
    layout === 'Wander Journal' ||
    layout === 'Airmail Border' ||
    layout === 'Vintage Stamp Card' ||
    layout === 'Large Letter Travel' ||
    layout === 'Boarding Pass' ||
    layout === 'Gallery Postcard' ||
    layout === 'Sunset Postcard' ||
    layout === 'Food Trip'
  ) {
    return <DesignedTemplate layout={layout} photos={visiblePhotos} compact={compact} meta={meta} />;
  }

  if (layout === 'Sunset Poster') {
    return (
      <View style={[styles.sunsetWrap, compact && styles.mediaWrapCompact]}>
        <View style={styles.sunsetOrb} />
        <View style={styles.sunsetGlowBand} />
        <View style={styles.sunsetHeaderBlock}>
          <View style={styles.sunsetLabelLine} />
          <View style={styles.sunsetLabelShort} />
        </View>
        <TemplatePhoto uri={photo} style={styles.sunsetHero} />
        <TemplatePhoto uri={p1} style={styles.sunsetInset} />
        <View style={styles.sunsetFooter}>
          <View style={styles.sunsetDot} />
          <View style={styles.sunsetRule} />
        </View>
      </View>
    );
  }

  if (layout === 'Passport Board') {
    return (
      <View style={[styles.passportWrap, compact && styles.mediaWrapCompact]}>
        <View style={styles.passportGrid} />
        <View style={styles.passportMapShapeA} />
        <View style={styles.passportMapShapeB} />
        <View style={styles.passportSeal}>
          <Text style={styles.passportSealText}>VISITED</Text>
        </View>
        <TemplatePhoto uri={photo} style={styles.passportPhotoMain} />
        <TemplatePhoto uri={p1} style={styles.passportPhotoSmall} />
        <View style={styles.passportTicket}>
          <View style={styles.passportTicketLine} />
          <View style={[styles.passportTicketLine, styles.passportTicketLineShort]} />
        </View>
        <View style={styles.passportStampBox}>
          <View style={styles.passportStampInner} />
        </View>
      </View>
    );
  }

  if (layout === 'Color Pop Tiles') {
    return (
      <View style={[styles.colorPopWrap, compact && styles.mediaWrapCompact]}>
        <View style={styles.colorPopOrange} />
        <View style={styles.colorPopMint} />
        <View style={styles.colorPopBlue} />
        <TemplatePhoto uri={photo} style={styles.colorPopHero} />
        <TemplatePhoto uri={p1} style={styles.colorPopTileLeft} />
        <TemplatePhoto uri={p2} style={styles.colorPopTileRight} />
        <View style={styles.colorPopCaption}>
          <View style={styles.colorPopCaptionLine} />
          <View style={[styles.colorPopCaptionLine, styles.colorPopCaptionLineShort]} />
          <View style={styles.colorPopCaptionDotRow}>
            <View style={styles.colorPopCaptionDot} />
            <View style={[styles.colorPopCaptionDot, { backgroundColor: '#54B77B' }]} />
            <View style={[styles.colorPopCaptionDot, { backgroundColor: '#F8C14A' }]} />
          </View>
        </View>
      </View>
    );
  }

  if (layout === 'Dream Glow') {
    return (
      <View style={[styles.dreamWrap, compact && styles.mediaWrapCompact]}>
        <View style={styles.dreamMoon} />
        <View style={styles.dreamCloud} />
        <View style={styles.dreamStarA} />
        <View style={styles.dreamStarB} />
        <TemplatePhoto uri={p2} style={styles.dreamBackPhoto} />
        <TemplatePhoto uri={photo} style={styles.dreamMainPhoto} />
        <TemplatePhoto uri={p1} style={styles.dreamSmallPhoto} />
        <View style={styles.dreamNote}>
          <View style={styles.dreamNoteLine} />
          <View style={[styles.dreamNoteLine, styles.dreamNoteLineShort]} />
          <View style={styles.dreamNoteCircle} />
        </View>
      </View>
    );
  }

  if (layout === 'Scrapbook Story') {
    return (
      <View style={[styles.scrapbookWrap, compact && styles.mediaWrapCompact]}>
        <View style={styles.scrapbookWarmWash} />
        <View style={styles.scrapbookDeckleA} />
        <View style={styles.scrapbookDeckleB} />
        <View style={styles.scrapbookPressedFlower}>
          <View style={styles.scrapFlowerStem} />
          <View style={[styles.scrapLeaf, styles.scrapLeafA]} />
          <View style={[styles.scrapLeaf, styles.scrapLeafB]} />
          <View style={styles.scrapFlowerBud} />
        </View>
        <View style={styles.scrapNoteCard}>
          <View style={styles.scrapNoteTitleLine} />
          <View style={styles.scrapNoteLine} />
          <View style={[styles.scrapNoteLine, styles.scrapNoteLineShort]} />
          <View style={styles.scrapNoteHeart} />
        </View>
        <TemplatePhoto uri={p1} style={styles.scrapBackgroundPhoto} />
        <View style={styles.scrapHeroFrame}>
          <TemplatePhoto uri={photo} style={styles.scrapHeroPhoto} />
        </View>
        <TemplatePhoto uri={p2} style={styles.scrapSmallPhotoLeft} />
        <TemplatePhoto uri={p3} style={styles.scrapSmallPhotoRight} />
        <View style={styles.scrapTapeTop} />
        <View style={styles.scrapTapeSmall} />
      </View>
    );
  }

  if (layout === 'Postcard Mosaic') {
    return (
      <View style={[styles.mosaicWrap, compact && styles.mediaWrapCompact]}>
        <View style={styles.mosaicPaperGlow} />
        <View style={styles.mosaicPostcardLines}>
          {Array.from({ length: 4 }).map((_, index) => <View key={index} style={styles.mosaicAddressLine} />)}
        </View>
        <View style={styles.mosaicStamp}>
          <View style={styles.mosaicStampCircle} />
          <View style={styles.mosaicStampLine} />
        </View>
        <TemplatePhoto uri={photo} style={[styles.mosaicPhoto, styles.mosaicA]} />
        <TemplatePhoto uri={p1} style={[styles.mosaicPhoto, styles.mosaicB]} />
        <TemplatePhoto uri={p2} style={[styles.mosaicPhoto, styles.mosaicC]} />
        <TemplatePhoto uri={p3} style={[styles.mosaicPhoto, styles.mosaicD]} />
        <View style={styles.mosaicTicket}>
          <View style={styles.mosaicTicketLine} />
          <View style={[styles.mosaicTicketLine, styles.mosaicTicketLineShort]} />
          <View style={styles.mosaicTicketHeart} />
        </View>
        <View style={styles.mosaicPerforation}>
          {Array.from({ length: 8 }).map((_, index) => <View key={index} style={styles.mosaicPerforationDot} />)}
        </View>
      </View>
    );
  }

  if (layout === 'Editorial Grid') {
    return (
      <View style={[styles.editorialWrap, compact && styles.mediaWrapCompact]}>
        <View style={styles.editorialTextPanel}>
          <View style={styles.editorialLineHero} />
          <View style={styles.editorialLine} />
          <View style={styles.editorialLineShort} />
          <View style={styles.editorialLeaf} />
        </View>
        <View style={styles.editorialAccentBlock} />
        <TemplatePhoto uri={photo} style={styles.editorialHeroPhoto} />
        <View style={styles.editorialBottomRow}>
          <TemplatePhoto uri={p1} style={styles.editorialSmallPhoto} />
          <TemplatePhoto uri={p2} style={styles.editorialSmallPhoto} />
          <TemplatePhoto uri={p3} style={styles.editorialSmallPhoto} />
        </View>
      </View>
    );
  }

  if (layout === 'Film Strip') {
    return (
      <View style={[styles.filmWrap, compact && styles.mediaWrapCompact]}>
        <View style={styles.filmGlow} />
        <View style={styles.filmTopLabel}>
          <View style={styles.filmTopLabelLine} />
          <View style={styles.filmTopDot} />
        </View>
        <View style={styles.filmHoleRow}>
          {Array.from({ length: 12 }).map((_, index) => <View key={index} style={styles.filmHole} />)}
        </View>
        <View style={styles.filmFrames}>
          {[photo, p1, p2].map((uri, index) => (
            <View key={`${uri}-${index}`} style={styles.filmFrameMount}>
              <TemplatePhoto uri={uri} style={styles.filmFrame} />
            </View>
          ))}
        </View>
        <View style={styles.filmHoleRowBottom}>
          {Array.from({ length: 12 }).map((_, index) => <View key={index} style={styles.filmHole} />)}
        </View>
        <View style={styles.filmNote}>
          <View style={styles.filmNoteLine} />
          <View style={[styles.filmNoteLine, styles.filmNoteLineShort]} />
          <View style={styles.filmSprig} />
        </View>
        <View style={styles.filmTape} />
      </View>
    );
  }

  if (layout === 'Wander Journal') {
    return (
      <View style={[styles.journalWrap, compact && styles.mediaWrapCompact]}>
        <View style={styles.journalShadowPage} />
        <View style={styles.journalPageLeft}>
          <View style={styles.journalPageTag}>
            <View style={styles.journalPageTagLine} />
          </View>
          <TemplatePhoto uri={p1} style={styles.journalLeftPhoto} />
          <View style={styles.journalLeftNote}>
            <View style={styles.journalTitleLine} />
            {Array.from({ length: 4 }).map((_, index) => <View key={index} style={[styles.journalRuleLine, index === 3 && styles.journalRuleLineShort]} />)}
          </View>
          <View style={styles.journalDoodle} />
        </View>
        <View style={styles.journalSpiral}>
          {Array.from({ length: 8 }).map((_, index) => <View key={index} style={styles.journalRing} />)}
        </View>
        <View style={styles.journalPageRight}>
          <View style={styles.journalTape} />
          <TemplatePhoto uri={photo} style={styles.journalPhotoLarge} />
          <TemplatePhoto uri={p1} style={styles.journalPhotoSmall} />
          <TemplatePhoto uri={p2} style={styles.journalPhotoWide} />
          <View style={styles.journalBotanical} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.postcardStackWrap, compact && styles.mediaWrapCompact]}>
      <View style={styles.postcardBackdrop} />
      <View style={styles.postcardSunCircle} />
      <TemplatePhoto uri={p1} style={[styles.postcardLoosePhoto, styles.postcardLooseLeft]} />
      <TemplatePhoto uri={p2} style={[styles.postcardLoosePhoto, styles.postcardLooseRight]} />
      <View style={[styles.postcardMain, compact && styles.postcardMainCompact]}>
        <TemplatePhoto uri={photo} style={styles.postcardMainImage} />
        <View style={styles.postcardCaptionStrip}>
          <View style={[styles.postcardCaptionLine, styles.postcardCaptionShort]} />
          <View style={styles.postcardCaptionLine} />
          <View style={styles.postcardCaptionHeart} />
        </View>
      </View>
      <View style={styles.tapeLeft} />
      <View style={styles.tapeRight} />
      <View style={styles.postcardStackShadow} />
      <View style={styles.postcardStamp}>
        <View style={styles.postcardStampCircle} />
        <View style={styles.postcardStampLine} />
        <View style={[styles.postcardStampLine, { width: 18 }]} />
      </View>
    </View>
  );
}

function isPremiumTextPostcardLayout(layout?: BeanLayout | string) {
  return PREMIUM_TEXT_POSTCARDS.has(String(layout));
}

function cityPostcardSubtitle(place: string, fallback: string) {
  const normalized = place.trim().toLowerCase();
  if (normalized === 'shanghai') return '上海市';
  if (normalized === 'kyoto') return '京都市';
  if (normalized === 'tokyo') return '東京都';

  const text = fallback.trim() || 'CITY TRAVEL';
  return text.toUpperCase().split('').join(' ');
}

function spacedPostcardTitle(value: string) {
  const words = value.trim().split(/\s+/).slice(0, 3).join(' ');
  return words.length > 20 ? words.toUpperCase() : words.toUpperCase().split('').join(' ');
}

function FittedText({
  children,
  style,
  minimumFontScale = 0.36,
  numberOfLines = 1,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  minimumFontScale?: number;
  numberOfLines?: number;
}) {
  return (
    <Text
      adjustsFontSizeToFit
      minimumFontScale={minimumFontScale}
      numberOfLines={numberOfLines}
      ellipsizeMode="clip"
      style={[NO_WORD_BREAK, style]}
    >
      {children}
    </Text>
  );
}

function PremiumPostcardTemplate({
  layout,
  photos,
  compact,
  meta,
}: {
  layout: BeanLayout | string;
  photos: string[];
  compact?: boolean;
  meta: CollageMeta;
}) {
  const p0 = photos[0] ?? '';
  const p1 = photos[1] ?? p0;
  const p2 = photos[2] ?? p1;
  const p3 = photos[3] ?? p2;
  const p4 = photos[4] ?? p3;
  const p5 = photos[5] ?? p4;
  const p6 = photos[6] ?? p4;
  const p7 = photos[7] ?? p5;
  const place = cleanPlace(meta.place);
  const placeUpper = place.toUpperCase();
  const country = cleanPlace(meta.country);
  const year = postcardYear(meta.date);
  const snapshotDestination = (country || place).toUpperCase();
  const blackCitySubtitle = cityPostcardSubtitle(place, country || year);
  const giantSize = destinationFontSize(placeUpper, compact, 'poster');
  const mastheadSize = destinationFontSize(placeUpper, compact, 'masthead');
  const templeTitleSize = compact
    ? placeUpper.length > 13 ? 6.8 : placeUpper.length >= 8 ? 7.5 : 10.4
    : placeUpper.length > 13 ? 13 : placeUpper.length >= 8 ? 14.5 : 20;
  const sidebarTitleSize = compact
    ? placeUpper.length > 13 ? 9 : placeUpper.length > 9 ? 10 : 12
    : placeUpper.length > 13 ? 13 : placeUpper.length > 9 ? 16 : 20;
  const sidebarStoryText = postcardPanelText(meta.story, compact ? 52 : 86);
  const hasSidebarStory = sidebarStoryText.length > 0;

  if (layout === 'City Cover') {
    return (
      <View style={[styles.premiumPostcard, styles.cityCoverPostcard, compact && styles.mediaWrapCompact]}>
        <TemplatePhoto uri={p0} style={styles.cityCoverImage} />
        <View style={styles.cityCoverTint} />
        <PaperTexture dark />
        <View style={styles.cityCoverFrame} />
        <FittedText style={styles.cityCoverMeta} minimumFontScale={0.32}>{country} · {year}</FittedText>
        <FittedText
          numberOfLines={2}
          minimumFontScale={0.16}
          style={[styles.cityCoverPlace, compact && styles.cityCoverPlaceCompact]}
        >
          {placeUpper}
        </FittedText>
        <View style={styles.cityCoverRule} />
        {hasQuote(meta) && <QuotePlacementView text={meta.selectedQuoteText ?? ''} author={meta.selectedQuoteAuthor} placement={meta.quotePlacement ?? 'elegant_overlay'} compact={compact} />}
      </View>
    );
  }

  if (layout === 'Black City Postcard') {
    return (
      <View style={[styles.premiumPostcard, styles.blackCityPostcard, compact && styles.mediaWrapCompact]}>
        <TemplatePhoto uri={p0} style={styles.blackCityImage} imageStyle={GRAYSCALE_IMAGE_STYLE} />
        <View style={styles.blackCityMist} />
        <View style={styles.blackCityShade} />
        <View style={[styles.blackCityContent, compact && styles.blackCityContentCompact]}>
          <Svg width={compact ? 13 : 20} height={compact ? 18 : 26} viewBox="0 0 20 26">
            <Path d="M10 24C10 24 18 14.9 18 8.9C18 4.5 14.4 1 10 1C5.6 1 2 4.5 2 8.9C2 14.9 10 24 10 24Z" stroke="#FFFDF8" strokeWidth="2.2" fill="none" />
            <Circle cx="10" cy="8.8" r="2.6" fill="#FFFDF8" />
          </Svg>
          <FittedText
            numberOfLines={1}
            minimumFontScale={0.25}
            style={[styles.blackCityTitle, compact && styles.blackCityTitleCompact]}
          >
            {place || 'Shanghai'}
          </FittedText>
          <FittedText style={[styles.blackCitySubtitle, compact && styles.blackCitySubtitleCompact]} minimumFontScale={0.32}>{blackCitySubtitle}</FittedText>
        </View>
        {hasQuote(meta) && <QuotePlacementView text={meta.selectedQuoteText ?? ''} author={meta.selectedQuoteAuthor} placement={meta.quotePlacement ?? 'elegant_overlay'} compact={compact} />}
      </View>
    );
  }

  if (layout === 'Any City Mosaic') {
    return (
      <View style={[styles.premiumPostcard, styles.anyCityMosaic, compact && styles.mediaWrapCompact]}>
        <View style={[styles.anyCityGrid, compact && styles.anyCityGridCompact]}>
          <TemplatePhoto uri={p0} style={[styles.anyCityTile, styles.anyCityTopLeft]} imageStyle={GRAYSCALE_IMAGE_STYLE} />
          <TemplatePhoto uri={p1} style={[styles.anyCityTile, styles.anyCityTopRight]} imageStyle={GRAYSCALE_IMAGE_STYLE} />
          <TemplatePhoto uri={p2} style={[styles.anyCityTile, styles.anyCityBottomLeft]} imageStyle={GRAYSCALE_IMAGE_STYLE} />
          <TemplatePhoto uri={p3} style={[styles.anyCityTile, styles.anyCityCenter]} imageStyle={GRAYSCALE_IMAGE_STYLE} />
          <TemplatePhoto uri={p4} style={[styles.anyCityTile, styles.anyCityBottomRight]} imageStyle={GRAYSCALE_IMAGE_STYLE} />
          <View style={styles.anyCityWash} />
          <FittedText
            numberOfLines={1}
            minimumFontScale={0.24}
            style={[styles.anyCityTitle, compact && styles.anyCityTitleCompact]}
          >
            {placeUpper || 'ANY CITY'}
          </FittedText>
          <FittedText style={[styles.anyCityDate, compact && styles.anyCityDateCompact]} minimumFontScale={0.30}>{meta.date.replaceAll('-', '.')}</FittedText>
        </View>
        {hasQuote(meta) && <QuotePlacementView text={meta.selectedQuoteText ?? ''} author={meta.selectedQuoteAuthor} placement={meta.quotePlacement ?? 'elegant_overlay'} compact={compact} />}
      </View>
    );
  }

  if (layout === 'Seek Travel') {
    const seekCopy = hasQuote(meta)
      ? meta.selectedQuoteText?.trim() ?? ''
      : postcardPanelText(meta.story, compact ? 82 : 150);
    const seekPanelText = seekCopy || 'Add a quote or travel note for this card.';
    const seekAuthor = hasQuote(meta) ? meta.selectedQuoteAuthor?.trim() : '';

    return (
      <View style={[styles.premiumPostcard, styles.seekTravel, compact && styles.mediaWrapCompact]}>
        <TemplatePhoto uri={p0} style={styles.seekBackground} imageStyle={GRAYSCALE_IMAGE_STYLE} />
        <View style={styles.seekShade} />
        <View style={[styles.seekRule, compact && styles.seekRuleCompact]} />
        <FittedText style={[styles.seekTitle, compact && styles.seekTitleCompact]} numberOfLines={2} minimumFontScale={0.24}>
          SEEK{'\n'}TO TRAVEL
        </FittedText>
        <FittedText style={[styles.seekCopy, compact && styles.seekCopyCompact]} numberOfLines={compact ? 5 : 6} minimumFontScale={0.5}>{seekPanelText}</FittedText>
        {seekAuthor ? <FittedText style={[styles.seekAuthor, compact && styles.seekAuthorCompact]} minimumFontScale={0.30}>{seekAuthor}</FittedText> : null}
        <View style={[styles.seekPhotoFrame, compact && styles.seekPhotoFrameCompact]}>
          <TemplatePhoto uri={p1} style={styles.seekPhoto} />
        </View>
      </View>
    );
  }

  if (layout === 'Mountain Postcard') {
    return (
      <View style={[styles.premiumPostcard, styles.mountainPostcard, compact && styles.mediaWrapCompact]}>
        <View style={[styles.mountainCard, compact && styles.mountainCardCompact]}>
          <TemplatePhoto uri={p0} style={styles.mountainPhoto} />
          <View style={[styles.mountainBand, compact && styles.mountainBandCompact]}>
            <FittedText
              minimumFontScale={0.25}
              style={[styles.mountainTitle, compact && styles.mountainTitleCompact]}
            >
              {spacedPostcardTitle(place || country || 'Himalaya Mountain')}
            </FittedText>
          </View>
        </View>
        {hasQuote(meta) && <QuotePlacementView text={meta.selectedQuoteText ?? ''} author={meta.selectedQuoteAuthor} placement={meta.quotePlacement ?? 'elegant_overlay'} compact={compact} />}
      </View>
    );
  }

  if (layout === 'Temple Heritage') {
    const templeQuote = hasQuote(meta)
      ? meta.selectedQuoteText?.trim() ?? ''
      : postcardPanelText(meta.story, compact ? 82 : 150);
    const templePanelText = templeQuote || 'A moment worth remembering';
    const templeAuthor = hasQuote(meta) ? meta.selectedQuoteAuthor?.trim() : '';
    const templeDate = formatDate(meta.date).replace(',', '').toUpperCase();

    return (
      <View style={[styles.premiumPostcard, styles.templeHeritage, compact && styles.mediaWrapCompact]}>
        <View style={[styles.templeCard, compact && styles.templeCardCompact]}>
          <View style={styles.templeTitlePanel}>
            <FittedText
              numberOfLines={2}
              minimumFontScale={0.16}
              style={[
                styles.templeTitle,
                compact && styles.templeTitleCompact,
                { fontSize: templeTitleSize, lineHeight: compact ? templeTitleSize + 2 : templeTitleSize + 4 },
              ]}
            >
              {placeUpper || 'BOROBUDUR TEMPLE'}
            </FittedText>
            <FittedText style={[styles.templeQuote, compact && styles.templeQuoteCompact]} numberOfLines={5} minimumFontScale={0.16}>"{templePanelText}"</FittedText>
            {templeAuthor ? <FittedText style={[styles.templeQuoteAuthor, compact && styles.templeQuoteAuthorCompact]} minimumFontScale={0.30}>{templeAuthor}</FittedText> : null}
            <View style={[styles.templeQuoteRule, compact && styles.templeQuoteRuleCompact]} />
            <FittedText style={[styles.templeDate, compact && styles.templeDateCompact]} minimumFontScale={0.30}>{templeDate}</FittedText>
          </View>
          <TemplatePhoto uri={p0} style={styles.templeHero} />
          <TemplatePhoto uri={p1} style={styles.templeStrip} />
          <FittedText style={[styles.templeCountry, compact && styles.templeCountryCompact]} minimumFontScale={0.30}>{country || 'Indonesia'}</FittedText>
          <FittedText style={[styles.templePostcard, compact && styles.templePostcardCompact]} minimumFontScale={0.30}>Travel Postcard</FittedText>
        </View>
      </View>
    );
  }

  if (layout === 'Break Postcard') {
    const breakHeadline = postcardPanelText(meta.selectedQuoteText?.trim() || meta.story, compact ? 44 : 76)
      || 'Give yourself a break';

    return (
      <View style={[styles.premiumPostcard, styles.breakPostcard, compact && styles.mediaWrapCompact]}>
        <View style={styles.breakPaperGlow} />
        <View style={[styles.breakPhotoCard, compact && styles.breakPhotoCardCompact]}>
          <TemplatePhoto uri={p0} style={styles.breakImage} />
          <View style={styles.breakTint} />
          <View style={styles.breakWarmWash} />
          <FittedText
            numberOfLines={1}
            minimumFontScale={0.5}
            style={[styles.breakHeadline, compact && styles.breakHeadlineCompact]}
          >
            {breakHeadline}
          </FittedText>
        </View>
        <FittedText style={styles.breakPlace} minimumFontScale={0.30}>{country || place}</FittedText>
        {hasQuote(meta) && <QuotePlacementView text={meta.selectedQuoteText ?? ''} author={meta.selectedQuoteAuthor} placement={meta.quotePlacement ?? 'elegant_overlay'} compact={compact} />}
      </View>
    );
  }

  if (layout === 'This Is Postcard') {
    return (
      <View style={[styles.premiumPostcard, styles.thisIsPostcard, compact && styles.mediaWrapCompact]}>
        <TemplatePhoto uri={p0} style={styles.thisIsImage} />
        <View style={styles.thisIsTint} />
        <PaperTexture />
        <View style={styles.thisIsInnerFrame} />
        <View style={styles.thisIsTape} />
        <FittedText style={styles.thisIsMeta} minimumFontScale={0.34}>{place}, {year}</FittedText>
        <Text style={styles.thisIsWordLeft}>THIS</Text>
        <Text style={styles.thisIsWordRight}>IS</Text>
        <FittedText
          numberOfLines={1}
          minimumFontScale={0.28}
          style={[
          styles.thisIsPlace,
          {
            fontSize: giantSize,
            lineHeight: compact ? giantSize + 3 : giantSize + 7,
            top: compact ? 92 : 126,
          },
        ]}
        >
          {placeUpper}
        </FittedText>
        <FittedText style={styles.thisIsFooter} minimumFontScale={0.34}>{country} · {year}</FittedText>
        {hasQuote(meta) && <QuotePlacementView text={meta.selectedQuoteText ?? ''} author={meta.selectedQuoteAuthor} placement={meta.quotePlacement ?? 'elegant_overlay'} compact={compact} />}
      </View>
    );
  }

  if (layout === 'Wish You Were Here') {
    const wishTileStyles = [
      styles.wishTileA,
      styles.wishTileB,
      styles.wishTileC,
      styles.wishTileD,
      styles.wishTileE,
      styles.wishTileF,
      styles.wishTileG,
      styles.wishTileH,
    ];

    return (
      <View style={[styles.premiumPostcard, styles.wishPostcard, compact && styles.mediaWrapCompact]}>
        <PaperTexture dark />
        <FittedText style={styles.wishMetaBottom} minimumFontScale={0.30}>{place} · {year}</FittedText>
        {[p0, p1, p2, p3, p4, p5, p1, p2].map((uri, index) => (
          <TemplatePhoto key={`${uri}-${index}`} uri={uri} style={[styles.wishPhotoTile, wishTileStyles[index]]} />
        ))}
        <View style={styles.wishCenter}>
          <Text style={styles.wishText}>WISH{'\n'}YOU{'\n'}WERE{'\n'}HERE</Text>
        </View>
        {hasQuote(meta) && <QuotePlacementView text={meta.selectedQuoteText ?? ''} author={meta.selectedQuoteAuthor} placement={meta.quotePlacement ?? 'elegant_overlay'} compact={compact} />}
      </View>
    );
  }

  if (layout === 'Snapshots Postcard') {
    const noteText = hasQuote(meta)
      ? meta.selectedQuoteText?.trim() ?? ''
      : postcardPanelText(meta.story, compact ? 54 : 96) || 'Wishing you were here with me!';
    const noteAuthor = hasQuote(meta) ? meta.selectedQuoteAuthor?.trim() : '';

    return (
      <View style={[styles.premiumPostcard, styles.snapshotsPostcard, compact && styles.mediaWrapCompact]}>
        <View style={styles.snapshotsInner}>
          <View style={styles.snapshotsPhotoGrid}>
            {[p0, p1, p2, p3, p4, p5, p6, p7].map((uri, index) => (
              <TemplatePhoto key={`${uri}-${index}`} uri={uri} style={styles.snapshotsPhoto} />
            ))}
          </View>
          <View style={styles.snapshotsTextPanel}>
            <FittedText style={[styles.snapshotsEyebrow, compact && styles.snapshotsEyebrowCompact]} minimumFontScale={0.16}>Hello from {place}</FittedText>
            <FittedText style={[styles.snapshotsHeadline, compact && styles.snapshotsHeadlineCompact]} numberOfLines={1} minimumFontScale={0.2}>SNAPSHOTS</FittedText>
            <FittedText style={[styles.snapshotsFrom, compact && styles.snapshotsFromCompact]} numberOfLines={1} minimumFontScale={0.25}>FROM</FittedText>
            <FittedText style={[styles.snapshotsDestination, compact && styles.snapshotsDestinationCompact]} minimumFontScale={0.22}>{snapshotDestination}</FittedText>
            <FittedText style={[styles.snapshotsNote, compact && styles.snapshotsNoteCompact]} numberOfLines={2} minimumFontScale={0.32}>{noteText}</FittedText>
            {noteAuthor ? <FittedText style={[styles.snapshotsAuthor, compact && styles.snapshotsAuthorCompact]} minimumFontScale={0.64}>{noteAuthor}</FittedText> : null}
          </View>
        </View>
      </View>
    );
  }

  if (layout === 'Destination Sidebar') {
    return (
      <View style={[styles.premiumPostcard, styles.sidebarPostcard, compact && styles.mediaWrapCompact]}>
        <TemplatePhoto uri={p0} style={styles.sidebarBackgroundImage} />
        <PaperTexture />
        <View style={styles.sidebarPhotoVignette} />
        <View style={styles.sidebarPanel}>
          <View style={styles.sidebarPanelTexture} />
          <TemplatePhoto uri={p1} style={styles.sidebarInsetImage} />
          <View style={styles.sidebarTape} />
          <FittedText style={[styles.sidebarPlace, { fontSize: sidebarTitleSize, lineHeight: sidebarTitleSize + 4 }]} minimumFontScale={0.16}>{placeUpper}</FittedText>
          {hasSidebarStory && <Text style={styles.sidebarStory} numberOfLines={compact ? 3 : 5}>{sidebarStoryText}</Text>}
          {hasSidebarStory && <View style={styles.sidebarRule} />}
          <FittedText style={styles.sidebarHandle} minimumFontScale={0.32}>{country}</FittedText>
        </View>
        {hasQuote(meta) && <QuotePlacementView text={meta.selectedQuoteText ?? ''} author={meta.selectedQuoteAuthor} placement={meta.quotePlacement ?? 'elegant_overlay'} compact={compact} />}
      </View>
    );
  }

  if (layout === 'Greetings Grid') {
    return (
      <View style={[styles.premiumPostcard, styles.greetingsPostcard, compact && styles.mediaWrapCompact]}>
        <View style={styles.greetingsGrid}>
          {[p0, p1, p2, p3, p4, p5, p6, p7].map((uri, index) => <TemplatePhoto key={`${uri}-${index}`} uri={uri} style={styles.greetingsPhoto} />)}
        </View>
        <PaperTexture />
        <View style={styles.greetingsBand}>
          <Text style={styles.greetingsSmall}>Greetings from</Text>
          <FittedText style={[styles.greetingsPlace, { fontSize: compact ? 24 : placeUpper.length > 12 ? 30 : 36 }]} minimumFontScale={0.16}>{place}</FittedText>
        </View>
        {hasQuote(meta) && <QuotePlacementView text={meta.selectedQuoteText ?? ''} author={meta.selectedQuoteAuthor} placement={meta.quotePlacement ?? 'elegant_overlay'} compact={compact} />}
      </View>
    );
  }

  if (layout === 'Masthead Postcard') {
    return (
      <View style={[styles.premiumPostcard, styles.mastheadPostcard, compact && styles.mediaWrapCompact]}>
        <PaperTexture />
        <View style={styles.mastheadTop}>
          <Text style={styles.mastheadMeta} numberOfLines={1}>{formatDate(meta.date)}</Text>
          <Text style={styles.mastheadMeta} numberOfLines={1}>Travel postcard</Text>
        </View>
        <FittedText
          numberOfLines={1}
          minimumFontScale={0.3}
          style={[styles.mastheadPlace, { fontSize: mastheadSize, lineHeight: compact ? mastheadSize + 4 : mastheadSize + 7 }]}
        >
          {placeUpper}
        </FittedText>
        <View style={styles.mastheadRule} />
        <TemplatePhoto uri={p0} style={styles.mastheadImage} contentPosition="center" />
        <View style={styles.mastheadImageBorder} />
        {hasQuote(meta) && <QuotePlacementView text={meta.selectedQuoteText ?? ''} author={meta.selectedQuoteAuthor} placement={meta.quotePlacement ?? 'elegant_overlay'} compact={compact} />}
      </View>
    );
  }

  return (
    <View style={[styles.premiumPostcard, styles.pinnedPostcard, compact && styles.mediaWrapCompact]}>
      <TemplatePhoto uri={p0} style={styles.pinnedBackground} contentPosition="center" />
      <PaperTexture />
      <View style={styles.pinnedBackdropTint} />
      <View style={styles.pinnedFrame}>
        <View style={styles.pinnedPin} />
        <View style={styles.pinnedTape} />
        <TemplatePhoto uri={p1} style={styles.pinnedPhoto} />
        <FittedText style={styles.pinnedText} numberOfLines={2} minimumFontScale={0.16}>Hello from {place}</FittedText>
      </View>
      {hasQuote(meta) && <QuotePlacementView text={meta.selectedQuoteText ?? ''} author={meta.selectedQuoteAuthor} placement={meta.quotePlacement ?? 'elegant_overlay'} compact={compact} />}
    </View>
  );
}

function PaperTexture({ dark = false }: { dark?: boolean }) {
  return (
    <View style={styles.textureLayer}>
      {TEXTURE_DOTS.map((dot, index) => (
        <View
          key={index}
          style={[
            styles.textureDot,
            dark && styles.textureDotDark,
            { left: dot.left, top: dot.top, width: dot.size, height: dot.size, borderRadius: dot.size / 2 },
          ]}
        />
      ))}
      <View style={[styles.textureLine, dark && styles.textureLineDark, styles.textureLineA]} />
      <View style={[styles.textureLine, dark && styles.textureLineDark, styles.textureLineB]} />
      <View style={[styles.textureLine, dark && styles.textureLineDark, styles.textureLineC]} />
    </View>
  );
}

function cleanPlace(value: string) {
  return value.trim() || 'Travel';
}

function postcardPanelText(value: string, limit: number) {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= limit) return clean;

  const firstSentence = clean.match(/^.{20,90}?[.!?](?:\s|$)/)?.[0]?.trim();
  if (firstSentence && firstSentence.length <= limit) return firstSentence.replace(/[.!?]$/, '.');

  const clipped = clean.slice(0, limit).replace(/\s+\S*$/, '').trim();
  return clipped ? `${clipped.replace(/[.!?]$/, '')}.` : clean;
}

function postcardYear(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (!Number.isNaN(parsed.getTime())) return String(parsed.getFullYear());
  return date.slice(0, 4) || '2026';
}

function destinationFontSize(value: string, compact?: boolean, style: 'poster' | 'masthead' = 'poster') {
  const length = value.replace(/\s+/g, '').length;
  if (compact) {
    if (length > 24) return 14;
    if (length > 20) return 16;
    if (length > 18) return 18;
    if (length > 14) return 20;
    if (length > 10) return 22;
    if (length > 8) return 24;
    return style === 'masthead' ? 28 : 30;
  }
  if (length > 28) return style === 'masthead' ? 18 : 17;
  if (length > 24) return style === 'masthead' ? 21 : 20;
  if (length > 20) return style === 'masthead' ? 23 : 22;
  if (length > 18) return style === 'masthead' ? 25 : 24;
  if (length > 14) return style === 'masthead' ? 29 : 28;
  if (length > 10) return style === 'masthead' ? 35 : 34;
  if (length > 8) return style === 'masthead' ? 42 : 40;
  return style === 'masthead' ? 54 : 52;
}

function DesignedTemplate({ layout, photos, compact, meta }: { layout: BeanLayout | string; photos: string[]; compact?: boolean; meta: CollageMeta }) {
  if (layout === 'Food Trip') {
    return <FoodTripTemplate photos={photos} compact={compact} meta={meta} />;
  }

  const place = cleanPlace(meta.place).toUpperCase();
  const country = cleanPlace(meta.country).toUpperCase();
  const year = postcardYear(meta.date);
  const isFilm = layout === 'Film Strip';
  const isPostcard = layout === 'Postcard Mosaic';
  const isScrapbook = layout === 'Scrapbook Story';
  const isJournal = layout === 'Wander Journal';
  const isEditorial = layout === 'Editorial Grid';
  const isClassic = layout === 'Classic Postcard';
  const isAirmail = layout === 'Airmail Border';
  const isVintage = layout === 'Vintage Stamp Card';
  const isLetter = layout === 'Large Letter Travel';
  const isBoarding = layout === 'Boarding Pass';
  const isGallery = layout === 'Gallery Postcard';
  const isSunset = layout === 'Sunset Postcard';
  const variant =
    layout === 'Postcard Stack' ? 'polaroid' :
    layout === 'Classic Postcard' ? 'classic' :
    layout === 'Scrapbook Story' ? 'scrapbook' :
    layout === 'Postcard Mosaic' ? 'postcard' :
    layout === 'Film Strip' ? 'film' :
    layout === 'Wander Journal' ? 'journal' :
    layout === 'Airmail Border' ? 'airmail' :
    layout === 'Vintage Stamp Card' ? 'vintage' :
    layout === 'Large Letter Travel' ? 'letter' :
    layout === 'Boarding Pass' ? 'boarding' :
    layout === 'Gallery Postcard' ? 'gallery' :
    layout === 'Sunset Postcard' ? 'sunsetPostcard' :
    'editorial';

  return (
    <View style={[
      styles.designedTemplate,
      isFilm && styles.filmTemplate,
      isPostcard && styles.postcardTemplate,
      isScrapbook && styles.scrapbookTemplate,
      isJournal && styles.journalTemplate,
      isEditorial && styles.editorialTemplate,
      isClassic && styles.classicTemplate,
      isAirmail && styles.airmailTemplate,
      isVintage && styles.vintageTemplate,
      isLetter && styles.letterTemplate,
      isBoarding && styles.boardingTemplate,
      isGallery && styles.galleryTemplate,
      isSunset && styles.sunsetPostcardTemplate,
      compact && styles.mediaWrapCompact,
    ]}>
      {(isAirmail || isVintage || isLetter || isBoarding || isGallery || isSunset) && <PaperTexture dark={isGallery} />}
      {isFilm && <FilmHoles position="top" />}
      {isFilm && <FilmHoles position="bottom" />}
      {isAirmail && (
        <>
          <View style={[styles.airmailStripe, styles.airmailStripeTop]} />
          <View style={[styles.airmailStripe, styles.airmailStripeBottom]} />
          <View style={styles.airmailPostmark}>
            <Text style={styles.airmailPostmarkText}>Air Mail</Text>
          </View>
          <View style={styles.airmailRouteCard}>
            <View style={styles.airmailRouteLine} />
            <View style={[styles.airmailRouteLine, styles.airmailRouteLineShort]} />
          </View>
        </>
      )}
      {isPostcard && (
        <View style={styles.postcardTemplateStamp}>
          <View style={styles.postcardStampInnerCircle} />
        </View>
      )}
      {isVintage && (
        <>
          <View style={styles.vintagePaperWash} />
          <View style={styles.vintageStamp}>
            <View style={styles.vintageStampRing} />
          </View>
          <Text style={styles.vintageTemplateLabel}>Vintage Postcard</Text>
        </>
      )}
      {isScrapbook && (
        <>
          <View style={styles.scrapbookTemplateTape} />
          <View style={styles.scrapbookTemplateTicket}>
            <Text style={styles.scrapbookTemplateTicketText}>MEMORY</Text>
          </View>
        </>
      )}
      {isJournal && <View style={styles.journalTemplateSpine} />}
      {isLetter && (
        <>
          <View style={styles.letterEnvelopePanel} />
          <Text style={styles.letterTemplateLabel}>Destination Letter</Text>
          <View style={styles.letterPostageBox}>
            <View style={styles.letterPostageMark} />
          </View>
        </>
      )}
      {isBoarding && (
        <>
          <View style={styles.boardingTemplateRail} />
          <View style={styles.boardingPerforation}>
            {Array.from({ length: 9 }).map((_, index) => <View key={index} style={styles.boardingPerforationDot} />)}
          </View>
          <View style={styles.boardingTopBar}>
            <Text style={styles.boardingTopText}>Boarding Pass</Text>
            <Text style={styles.boardingTopCode}>NO. 06</Text>
          </View>
          <View style={styles.boardingBarcode}>
            {Array.from({ length: 7 }).map((_, index) => <View key={index} style={[styles.boardingBarcodeLine, index % 2 === 0 && styles.boardingBarcodeLineTall]} />)}
          </View>
        </>
      )}
      {isGallery && (
        <>
          <View style={styles.gallerySpotlight} />
          <Text style={styles.galleryTemplateLabel}>Travel Gallery</Text>
          <View style={styles.gallerySideTag}>
            <Text style={styles.gallerySideTagText}>{year}</Text>
          </View>
          <FittedText style={styles.galleryDestination} minimumFontScale={0.24}>{place}</FittedText>
          <FittedText style={styles.galleryMeta} minimumFontScale={0.32}>{country}</FittedText>
        </>
      )}
      {isSunset && (
        <>
          <View style={styles.sunsetPostcardTopTint} />
          <View style={styles.sunsetPostcardFrameLine} />
          <View style={styles.sunsetSunBadge} />
          <Text style={styles.sunsetPostcardLabel}>Golden Hour</Text>
          <FittedText style={styles.sunsetDestination} minimumFontScale={0.24}>{place}</FittedText>
          <FittedText style={styles.sunsetMeta} minimumFontScale={0.32}>{country} · {year}</FittedText>
          <View style={styles.sunsetPostcardBottomRule} />
        </>
      )}
      <AdaptivePhotoSet photos={photos} variant={variant} />
      {hasQuote(meta) && (
        <QuotePlacementView
          text={meta.selectedQuoteText ?? ''}
          author={meta.selectedQuoteAuthor ?? ''}
          placement={meta.quotePlacement ?? 'elegant_overlay'}
          compact={compact}
        />
      )}
    </View>
  );
}

function FoodTripTemplate({ photos, compact, meta }: { photos: string[]; compact?: boolean; meta: CollageMeta }) {
  const p0 = photos[0] ?? '';
  const p1 = photos[1] ?? p0;
  const p2 = photos[2] ?? p1;
  const place = cleanPlace(meta.place);
  const country = cleanPlace(meta.country);
  const subtitle = country || place || 'everywhere';
  const footer = hasQuote(meta)
    ? meta.selectedQuoteText?.trim() ?? ''
    : postcardPanelText(meta.story, compact ? 44 : 72) || 'Collect moments, savor everywhere.';

  return (
    <View style={[styles.foodTripTemplate, compact && styles.mediaWrapCompact]}>
      <View style={styles.foodTripMapCornerA} />
      <View style={styles.foodTripMapCornerB} />
      <Svg width="100%" height="100%" viewBox="0 0 360 250" style={styles.foodTripRouteLayer}>
        <Path d="M13 57C45 31 76 31 106 55" stroke="#063A63" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="6 7" fill="none" />
        <Path d="M259 176C300 172 326 190 352 228" stroke="#063A63" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="6 7" fill="none" />
        <Path d="M104 209C117 194 130 203 129 216C127 230 107 225 105 211Z" stroke="#063A63" strokeWidth="2.2" fill="none" />
        <Path d="M72 44L110 20L101 61Z" fill="#063A63" />
        <Path d="M324 45L350 32L340 62Z" fill="#279D9A" opacity={0.82} />
      </Svg>
      <Text style={styles.foodTripRibbon}>Good food. Great adventures.</Text>
      <View style={styles.foodTripTitleSticker}>
        <Text style={[styles.foodTripFoodWord, styles.foodTripFoodRed]}>F</Text>
        <Text style={[styles.foodTripFoodWord, styles.foodTripFoodGold]}>O</Text>
        <Text style={[styles.foodTripFoodWord, styles.foodTripFoodTeal]}>O</Text>
        <Text style={[styles.foodTripFoodWord, styles.foodTripFoodPink]}>D</Text>
        <Text style={styles.foodTripTripWord}>TRIP</Text>
      </View>
      <View style={[styles.foodTripPrint, styles.foodTripPrintLeft]}>
        <View style={styles.foodTripTapePink} />
        <TemplatePhoto uri={p0} style={styles.foodTripPhoto} />
        <Text style={styles.foodTripPrintCaption} numberOfLines={2}>New tastes</Text>
      </View>
      <View style={[styles.foodTripPrint, styles.foodTripPrintRight]}>
        <View style={styles.foodTripTapeYellow} />
        <TemplatePhoto uri={p1} style={styles.foodTripPhoto} />
        <Text style={styles.foodTripPrintCaption} numberOfLines={2}>Tasty views</Text>
      </View>
      <View style={[styles.foodTripPrint, styles.foodTripPrintCenter]}>
        <View style={styles.foodTripTapeBlue} />
        <TemplatePhoto uri={p2} style={styles.foodTripPhoto} />
        <Text style={styles.foodTripPrintCaption} numberOfLines={2}>Food finds</Text>
      </View>
      <View style={[styles.foodTripCaption, styles.foodTripCaptionLeft]}>
        <Text style={styles.foodTripCaptionText}>Eat &{'\n'}Explore</Text>
      </View>
      <View style={[styles.foodTripCaption, styles.foodTripCaptionRight]}>
        <Text style={styles.foodTripCaptionText}>Bite{'\n'}by Bite</Text>
      </View>
      <FittedText style={styles.foodTripPlace} minimumFontScale={0.30}>Food adventures in {subtitle}</FittedText>
      <FittedText style={styles.foodTripFooter} minimumFontScale={0.30} numberOfLines={1}>{footer}</FittedText>
    </View>
  );
}

function FoodSpark({ style, small }: { style?: StyleProp<ViewStyle>; small?: boolean }) {
  const size = small ? 34 : 48;
  return (
    <View style={[style, { width: size, height: size }]}>
      {Array.from({ length: 8 }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.foodSparkRay,
            {
              left: size / 2 - 2,
              top: size / 2 - (small ? 15 : 21),
              height: small ? 30 : 42,
              transform: [{ rotate: `${index * 45}deg` }],
            },
          ]}
        />
      ))}
      <View style={[styles.foodSparkCenter, { left: size / 2 - 5, top: size / 2 - 5 }]} />
    </View>
  );
}

function hasQuote(meta: CollageMeta) {
  return Boolean(meta.selectedQuoteText?.trim() && meta.quotePlacement && meta.quotePlacement !== 'none');
}

function QuotePlacementView({
  text,
  author,
  placement,
  compact,
}: {
  text: string;
  author?: string | null;
  placement: QuotePlacement;
  compact?: boolean;
}) {
  const placementStyle =
    placement === 'scrapbook_note' ? styles.quoteScrapbook :
    placement === 'postcard_quote' ? styles.quotePostcard :
    placement === 'film_subtitle' ? styles.quoteFilm :
    styles.quoteElegant;
  const quoteLines = placement === 'film_subtitle' ? 2 : compact ? 2 : 3;

  return (
    <View pointerEvents="none" style={[styles.quoteBase, placementStyle, compact && styles.quoteCompact]}>
      <Text style={[styles.quoteText, placement === 'film_subtitle' && styles.quoteTextFilm, compact && styles.quoteTextCompact]} numberOfLines={quoteLines}>
        {text}
      </Text>
      {author ? (
        <Text style={[styles.quoteAuthor, placement === 'film_subtitle' && styles.quoteAuthorFilm, compact && styles.quoteAuthorCompact]} numberOfLines={1}>
          {author}
        </Text>
      ) : null}
    </View>
  );
}

function FilmHoles({ position }: { position: 'top' | 'bottom' }) {
  return (
    <View style={[styles.filmTemplateHoles, position === 'top' ? styles.filmTemplateHolesTop : styles.filmTemplateHolesBottom]}>
      {Array.from({ length: 12 }).map((_, index) => <View key={index} style={styles.filmTemplateHole} />)}
    </View>
  );
}

function AdaptivePhotoSet({ photos, variant }: { photos: string[]; variant: string }) {
  const uris = photos.length ? photos : [''];
  const count = Math.min(uris.length, 8);
  const frameStyle = [
    styles.adaptivePhotoFrame,
    variant === 'film' && styles.adaptivePhotoFrameFilm,
    variant === 'polaroid' && styles.adaptivePhotoFramePolaroid,
    variant === 'scrapbook' && styles.adaptivePhotoFrameScrapbook,
    variant === 'postcard' && styles.adaptivePhotoFramePostcard,
    variant === 'journal' && styles.adaptivePhotoFrameJournal,
    variant === 'editorial' && styles.adaptivePhotoFrameEditorial,
    variant === 'classic' && styles.adaptivePhotoFrameClassic,
    variant === 'airmail' && styles.adaptivePhotoFrameAirmail,
    variant === 'vintage' && styles.adaptivePhotoFrameVintage,
    variant === 'letter' && styles.adaptivePhotoFrameLetter,
    variant === 'boarding' && styles.adaptivePhotoFrameBoarding,
    variant === 'gallery' && styles.adaptivePhotoFrameGallery,
    variant === 'sunsetPostcard' && styles.adaptivePhotoFrameSunsetPostcard,
  ];
  const imageStyle = variant === 'postcard' ? styles.adaptiveImagePostcard : undefined;

  if (count === 1) {
    return (
      <View style={styles.adaptiveSet}>
        <PhotoCell uri={uris[0]} style={styles.adaptiveFill} frameStyle={frameStyle} imageStyle={imageStyle} />
      </View>
    );
  }

  if (count === 2) {
    return (
      <View style={[styles.adaptiveSet, styles.adaptiveRow]}>
        {uris.slice(0, 2).map((uri, index) => (
          <PhotoCell key={`${uri}-${index}`} uri={uri} style={styles.adaptiveFlexCell} frameStyle={frameStyle} imageStyle={imageStyle} />
        ))}
      </View>
    );
  }

  if (count === 3) {
    return (
      <View style={styles.adaptiveSet}>
        <PhotoCell uri={uris[0]} style={styles.adaptiveHeroTop} frameStyle={frameStyle} imageStyle={imageStyle} />
        <View style={styles.adaptiveBottomRow}>
          {uris.slice(1, 3).map((uri, index) => (
            <PhotoCell key={`${uri}-${index}`} uri={uri} style={styles.adaptiveFlexCell} frameStyle={frameStyle} imageStyle={imageStyle} />
          ))}
        </View>
      </View>
    );
  }

  if (count === 4) {
    return (
      <View style={styles.adaptiveSet}>
        <View style={styles.adaptiveGridRow}>
          {uris.slice(0, 2).map((uri, index) => (
            <PhotoCell key={`${uri}-${index}`} uri={uri} style={styles.adaptiveFlexCell} frameStyle={frameStyle} imageStyle={imageStyle} />
          ))}
        </View>
        <View style={styles.adaptiveGridRow}>
          {uris.slice(2, 4).map((uri, index) => (
            <PhotoCell key={`${uri}-${index}`} uri={uri} style={styles.adaptiveFlexCell} frameStyle={frameStyle} imageStyle={imageStyle} />
          ))}
        </View>
      </View>
    );
  }

  if (count === 5) {
    return (
      <View style={[styles.adaptiveSet, styles.adaptiveRow]}>
        <PhotoCell uri={uris[0]} style={styles.adaptiveHeroSide} frameStyle={frameStyle} imageStyle={imageStyle} />
        <View style={styles.adaptiveSideGrid}>
          <View style={styles.adaptiveGridRow}>
            {uris.slice(1, 3).map((uri, index) => (
              <PhotoCell key={`${uri}-${index}`} uri={uri} style={styles.adaptiveFlexCell} frameStyle={frameStyle} imageStyle={imageStyle} />
            ))}
          </View>
          <View style={styles.adaptiveGridRow}>
            {uris.slice(3, 5).map((uri, index) => (
              <PhotoCell key={`${uri}-${index}`} uri={uri} style={styles.adaptiveFlexCell} frameStyle={frameStyle} imageStyle={imageStyle} />
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (count > 6) {
    return (
      <View style={styles.adaptiveSet}>
        <View style={styles.adaptiveGridRow}>
          {uris.slice(0, 4).map((uri, index) => (
            <PhotoCell key={`${uri}-${index}`} uri={uri} style={styles.adaptiveFlexCell} frameStyle={frameStyle} imageStyle={imageStyle} />
          ))}
        </View>
        <View style={styles.adaptiveGridRow}>
          {uris.slice(4, 8).map((uri, index) => (
            <PhotoCell key={`${uri}-${index}`} uri={uri} style={styles.adaptiveFlexCell} frameStyle={frameStyle} imageStyle={imageStyle} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.adaptiveSet}>
      <View style={styles.adaptiveGridRow}>
        {uris.slice(0, 3).map((uri, index) => (
          <PhotoCell key={`${uri}-${index}`} uri={uri} style={styles.adaptiveFlexCell} frameStyle={frameStyle} imageStyle={imageStyle} />
        ))}
      </View>
      <View style={styles.adaptiveGridRow}>
        {uris.slice(3, 6).map((uri, index) => (
          <PhotoCell key={`${uri}-${index}`} uri={uri} style={styles.adaptiveFlexCell} frameStyle={frameStyle} imageStyle={imageStyle} />
        ))}
      </View>
    </View>
  );
}

function PhotoCell({
  uri,
  style,
  frameStyle,
  imageStyle,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  frameStyle?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}) {
  return (
    <View style={[frameStyle, style]}>
      <TemplatePhoto uri={uri} style={styles.adaptiveImage} imageStyle={imageStyle} contentPosition={contentPositionForVariant(variantFromFrameStyle(frameStyle))} />
    </View>
  );
}

function variantFromFrameStyle(frameStyle?: StyleProp<ViewStyle>) {
  const flattened = StyleSheet.flatten(frameStyle) ?? {};
  if (flattened.borderRadius === 10 && flattened.borderWidth === 3) return 'gallery';
  return 'subject';
}

function contentPositionForVariant(variant: string): ImageContentPosition {
  return variant === 'gallery' ? 'center' : 'top center';
}

function normalizeLayout(layout?: BeanLayout | string): BeanLayout | string {
  if (layout === 'Full Photo') return 'Boarding Pass';
  if (layout === 'Split Collage') return 'Editorial Grid';
  if (layout === 'Polaroid Stack') return 'Postcard Stack';
  return layout ?? 'Boarding Pass';
}

function layoutShellStyle(layout?: BeanLayout | string) {
  switch (layout) {
    case 'Sunset Poster':
      return { backgroundColor: '#FFF0E4', borderColor: '#F4B38C' };
    case 'Passport Board':
      return { backgroundColor: '#EFF9FA', borderColor: '#B9DCE4' };
    case 'Color Pop Tiles':
      return { backgroundColor: '#FFF7DB', borderColor: '#F4C658' };
    case 'Dream Glow':
      return { backgroundColor: '#F7F2FF', borderColor: '#D8C9F4' };
    default:
      return undefined;
  }
}

const styles = StyleSheet.create({
  generated: {
    width: '100%',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFF9EF',
    padding: 18,
    overflow: 'hidden',
    shadowColor: '#7D4F2F',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 5,
  },
  generatedCompact: { borderRadius: 15, padding: 9 },
  generatedPostcardOnly: { padding: 0, backgroundColor: '#FFFDF8' },
  collageStage: { position: 'relative', width: '100%' },
  templatePhotoFrame: { overflow: 'hidden', backgroundColor: '#EAD2C2' },
  templatePhotoBackdrop: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.22,
    transform: [{ scale: 1.08 }],
  },
  templatePhotoImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  paperGlow: { position: 'absolute', right: -80, top: -90, width: 220, height: 220, borderRadius: 110, backgroundColor: '#FFE5C9', opacity: 0.42 },
  generatedTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  generatedPlace: { width: '100%', color: INK, fontSize: 14, fontFamily: 'Inter_700Bold' },
  generatedPlaceCompact: { fontSize: 11 },
  stamp: { color: ORANGE, borderWidth: 1, borderColor: '#E0B89A', borderRadius: 18, paddingHorizontal: 10, paddingVertical: 5, fontFamily: 'Inter_700Bold', fontSize: 11, overflow: 'hidden' },
  scriptTitle: { width: '100%', color: INK, fontSize: 30, lineHeight: 35, fontFamily: 'Inter_700Bold', marginBottom: 14 },
  scriptTitleCompact: { fontSize: 15, lineHeight: 18, marginBottom: 8 },
  mediaWrapCompact: { height: 150, borderRadius: 10, marginBottom: 8 },
  premiumPostcard: { height: 340, borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFFDF8' },
  foodTripTemplate: { height: 360, borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFF7EA', borderWidth: 1, borderColor: '#EAD7B8' },
  foodTripMapCornerA: { position: 'absolute', left: -40, top: -28, width: 118, height: 82, backgroundColor: '#E7C99D', transform: [{ rotate: '-10deg' }], opacity: 0.24, borderRadius: 8 },
  foodTripMapCornerB: { position: 'absolute', right: -36, bottom: -28, width: 124, height: 88, backgroundColor: '#E7C99D', transform: [{ rotate: '-12deg' }], opacity: 0.22, borderRadius: 8 },
  foodTripRouteLayer: { ...StyleSheet.absoluteFillObject, zIndex: 1, opacity: 0.42 },
  foodTripExploreStamp: { position: 'absolute', left: 18, top: 15, width: 56, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#E04E24', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-12deg' }], zIndex: 4 },
  foodTripExploreText: { color: '#E04E24', fontSize: 9, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  foodTripAdventureStamp: { position: 'absolute', right: 20, top: 14, width: 82, height: 54, borderRadius: 10, borderWidth: 2, borderColor: '#178D88', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '5deg' }], zIndex: 4 },
  foodTripAdventureText: { color: '#178D88', fontSize: 10, lineHeight: 13, fontFamily: 'Inter_700Bold', textAlign: 'center', textTransform: 'uppercase' },
  foodTripRibbon: { position: 'absolute', left: '37%', right: '37%', top: 16, color: '#FFFDF8', backgroundColor: '#18958E', borderRadius: 12, paddingVertical: 4, paddingHorizontal: 5, fontSize: 6.8, lineHeight: 8.5, fontFamily: 'Inter_700Bold', textAlign: 'center', textTransform: 'uppercase', zIndex: 9, overflow: 'hidden' },
  foodTripTitleSticker: { position: 'absolute', left: '33%', top: 53, width: '34%', height: 88, borderRadius: 22, backgroundColor: 'rgba(255,253,248,0.9)', alignItems: 'center', justifyContent: 'center', shadowColor: '#6B4124', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 5, zIndex: 8 },
  foodTripFoodWord: { position: 'absolute', top: 13, fontSize: 28, lineHeight: 32, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  foodTripFoodRed: { left: 16, color: '#E94118', transform: [{ rotate: '-5deg' }] },
  foodTripFoodGold: { left: 45, color: '#EEA600', transform: [{ rotate: '4deg' }] },
  foodTripFoodTeal: { left: 73, color: '#149A93', transform: [{ rotate: '-4deg' }] },
  foodTripFoodPink: { left: 102, color: '#E85164', transform: [{ rotate: '5deg' }] },
  foodTripTripWord: { position: 'absolute', left: 16, right: 16, bottom: 9, color: '#073B68', fontSize: 27, lineHeight: 31, fontFamily: 'Inter_700Bold', textAlign: 'center', textTransform: 'uppercase' },
  foodTripPrint: { position: 'absolute', backgroundColor: '#FFFDF8', padding: 6, paddingBottom: 30, shadowColor: '#5E4A32', shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.18, shadowRadius: 13, elevation: 5, zIndex: 5 },
  foodTripPrintLeft: { left: 19, top: 103, width: '30%', height: '38%', transform: [{ rotate: '-5deg' }] },
  foodTripPrintRight: { right: 19, top: 103, width: '30%', height: '38%', transform: [{ rotate: '5deg' }] },
  foodTripPrintCenter: { left: '34%', bottom: 50, width: '32%', height: '38%', padding: 6, paddingBottom: 30, transform: [{ rotate: '-1deg' }], zIndex: 6 },
  foodTripPhoto: { width: '100%', height: '100%', backgroundColor: '#FFF8EF' },
  foodTripPrintCaption: { position: 'absolute', left: 8, right: 8, bottom: 8, color: '#063A63', fontSize: 8.5, lineHeight: 11, fontFamily: Platform.OS === 'web' ? 'Comic Sans MS, Bradley Hand, cursive' : 'Inter_600SemiBold', textAlign: 'center' },
  foodTripTapePink: { position: 'absolute', left: '25%', top: -7, width: '54%', height: 12, borderRadius: 2, backgroundColor: '#F08090', opacity: 0.9, zIndex: 8, transform: [{ rotate: '2deg' }] },
  foodTripTapeYellow: { position: 'absolute', right: 10, top: -8, width: 45, height: 12, borderRadius: 2, backgroundColor: '#E8B936', opacity: 0.9, zIndex: 8, transform: [{ rotate: '-8deg' }] },
  foodTripTapeBlue: { position: 'absolute', left: '28%', top: -8, width: '48%', height: 13, borderRadius: 2, backgroundColor: '#69AFC1', opacity: 0.9, zIndex: 8, transform: [{ rotate: '3deg' }] },
  foodTripCaption: { position: 'absolute', minHeight: 58, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1.5, borderColor: 'rgba(255,253,248,0.66)', zIndex: 7 },
  foodTripCaptionLeft: { left: '8%', bottom: 58, width: '23%', backgroundColor: 'rgba(75,158,150,0.84)' },
  foodTripCaptionRight: { right: '8%', bottom: 58, width: '23%', backgroundColor: 'rgba(228,91,88,0.82)' },
  foodTripCaptionText: { width: '100%', color: '#FFFDF8', fontSize: 13, lineHeight: 17, fontFamily: 'Inter_700Bold', textAlign: 'center', textTransform: 'uppercase' },
  foodTripSparkA: { position: 'absolute', left: 113, top: 58, zIndex: 9 },
  foodTripSparkB: { position: 'absolute', right: 41, top: 31, zIndex: 5 },
  foodSparkRay: { position: 'absolute', width: 4, borderRadius: 2, backgroundColor: '#FFD12D' },
  foodSparkCenter: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFD12D' },
  foodTripCameraIcon: { position: 'absolute', left: 17, bottom: 30, width: 34, height: 28, zIndex: 8, opacity: 0.86 },
  foodTripForkBadge: { position: 'absolute', right: '18%', bottom: 102, width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFDF8', borderWidth: 2, borderColor: '#E45B58', alignItems: 'center', justifyContent: 'center', zIndex: 8 },
  foodTripForkText: { color: '#1D1D1D', fontSize: 6, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  foodTripTruck: { position: 'absolute', right: 58, bottom: 27, width: 55, height: 32, zIndex: 7 },
  foodTripTruckBody: { position: 'absolute', left: 0, top: 9, width: 40, height: 17, borderRadius: 3, backgroundColor: '#FFCC2F', borderWidth: 2, borderColor: '#073B68' },
  foodTripTruckCab: { position: 'absolute', right: 0, top: 12, width: 19, height: 14, borderRadius: 3, backgroundColor: '#F26A2E', borderWidth: 2, borderColor: '#073B68' },
  foodTripTruckWindow: { position: 'absolute', top: 14, width: 7, height: 6, borderRadius: 2, backgroundColor: '#8BD6F4', borderWidth: 1, borderColor: '#073B68' },
  foodTripTruckWindowA: { left: 6 },
  foodTripTruckWindowB: { left: 17 },
  foodTripTruckAwning: { position: 'absolute', left: 4, top: 4, width: 29, height: 7, borderRadius: 2, backgroundColor: '#E83D4F', borderWidth: 1, borderColor: '#073B68' },
  foodTripTruckWheel: { position: 'absolute', bottom: 0, width: 9, height: 9, borderRadius: 5, backgroundColor: '#073B68', borderWidth: 2, borderColor: '#FFF8E8' },
  foodTripPlace: { position: 'absolute', left: 64, right: 92, bottom: 28, color: '#063A63', fontSize: 9.5, lineHeight: 12, fontFamily: 'Inter_700Bold', textAlign: 'center', textTransform: 'uppercase', zIndex: 7 },
  foodTripFooter: { position: 'absolute', left: 74, right: 96, bottom: 10, color: '#063A63', fontSize: 10.2, lineHeight: 13, fontFamily: Platform.OS === 'web' ? 'Comic Sans MS, Bradley Hand, cursive' : 'Inter_600SemiBold', textAlign: 'center', zIndex: 7 },
  cityCoverPostcard: { backgroundColor: '#1D1D1B' },
  cityCoverImage: { ...StyleSheet.absoluteFillObject, backgroundColor: '#EAD2C2' },
  cityCoverTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(19,18,16,0.42)' },
  cityCoverFrame: { position: 'absolute', left: 18, right: 18, top: 18, bottom: 18, borderWidth: 1, borderColor: 'rgba(255,253,248,0.58)' },
  cityCoverMeta: { position: 'absolute', left: 28, right: 28, top: 28, color: '#FFFDF8', fontSize: 11, lineHeight: 14, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  cityCoverPlace: { position: 'absolute', left: 28, right: 28, bottom: 62, color: '#FFFDF8', fontSize: 54, lineHeight: 58, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', textShadowColor: 'rgba(0,0,0,0.22)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 8 },
  cityCoverPlaceCompact: { bottom: 28, fontSize: 24, lineHeight: 27 },
  cityCoverRule: { position: 'absolute', left: 28, bottom: 46, width: 82, height: 3, borderRadius: 2, backgroundColor: '#FFE46B' },
  cityCoverFooter: { position: 'absolute', right: 28, bottom: 28, color: '#FFFDF8', fontSize: 10, lineHeight: 13, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  blackCityPostcard: { backgroundColor: '#1A1A1A', borderRadius: 23, borderColor: '#9A9A9A', padding: 0 },
  blackCityImage: { ...StyleSheet.absoluteFillObject, backgroundColor: '#787878' },
  blackCityMist: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.22)' },
  blackCityShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.22)' },
  blackCityContent: { position: 'absolute', left: 28, right: 28, top: '32%', alignItems: 'center', justifyContent: 'center' },
  blackCityContentCompact: { left: 12, right: 12, top: '30%' },
  blackCityTitle: { width: '100%', color: '#FFFDF8', fontSize: 42, lineHeight: 50, fontFamily: Platform.OS === 'web' ? 'Brush Script MT, Segoe Script, cursive' : 'Inter_700Bold', fontStyle: 'italic', fontWeight: '700', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.32)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 7 },
  blackCityTitleCompact: { fontSize: 19, lineHeight: 23, textShadowRadius: 4 },
  blackCitySubtitle: { width: '100%', color: '#FFFDF8', fontSize: 18, lineHeight: 24, fontFamily: 'Inter_500Medium', textAlign: 'center', marginTop: 0, textShadowColor: 'rgba(0,0,0,0.26)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  blackCitySubtitleCompact: { fontSize: 8, lineHeight: 11 },
  anyCityMosaic: { backgroundColor: '#E8E6DD', alignItems: 'center', justifyContent: 'center', borderColor: '#D2D0C7' },
  anyCityGrid: { width: '94%', height: '82%', backgroundColor: '#FFFDF8', borderWidth: 6, borderColor: '#FFFDF8', shadowColor: '#363024', shadowOffset: { width: 0, height: 13 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 8 },
  anyCityGridCompact: { width: '96%', height: '86%', borderWidth: 3 },
  anyCityTile: { position: 'absolute', backgroundColor: '#BDBAB1' },
  anyCityTopLeft: { left: 0, top: 0, width: '64%', height: '31%' },
  anyCityTopRight: { right: 0, top: 0, width: '31%', height: '64%' },
  anyCityBottomLeft: { left: 0, bottom: 0, width: '34%', height: '63%' },
  anyCityCenter: { left: '36.5%', top: '34%', width: '26%', height: '29%' },
  anyCityBottomRight: { right: 0, bottom: 0, width: '63.5%', height: '31%' },
  anyCityWash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.08)' },
  anyCityTitle: { position: 'absolute', left: 18, right: 18, top: '29%', color: '#F26A2E', fontSize: 38, lineHeight: 44, fontFamily: 'Inter_700Bold', textAlign: 'center', textTransform: 'uppercase' },
  anyCityTitleCompact: { left: 8, right: 8, fontSize: 18, lineHeight: 22 },
  anyCityDate: { position: 'absolute', left: '32%', right: '32%', top: '61%', color: 'rgba(255,253,248,0.94)', fontSize: 11, lineHeight: 14, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  anyCityDateCompact: { fontSize: 6, lineHeight: 8 },
  seekTravel: { backgroundColor: '#2B2D29', borderColor: '#50524A', borderRadius: 20, padding: 0 },
  seekBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: '#6D6E66' },
  seekShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,22,19,0.68)' },
  seekRule: { position: 'absolute', left: 34, top: 50, width: 72, height: 7, backgroundColor: '#FFFDF8' },
  seekRuleCompact: { left: 14, top: 20, width: 34, height: 3 },
  seekTitle: { position: 'absolute', left: 34, top: 81, width: '42%', color: '#FFFDF8', fontSize: 30, lineHeight: 37, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  seekTitleCompact: { left: 14, top: 36, width: '42%', fontSize: 13, lineHeight: 16 },
  seekCopy: { position: 'absolute', left: 36, top: 181, width: '40%', color: 'rgba(255,253,248,0.9)', fontSize: 12, lineHeight: 16, fontFamily: 'Inter_600SemiBold' },
  seekCopyCompact: { left: 14, top: 80, width: '41%', fontSize: 5.4, lineHeight: 7 },
  seekAuthor: { position: 'absolute', left: 36, top: 286, width: '40%', color: '#FFFDF8', fontSize: 9, lineHeight: 12, fontFamily: 'Inter_700Bold' },
  seekAuthorCompact: { left: 14, top: 124, width: '41%', fontSize: 4.2, lineHeight: 5.4 },
  seekPhotoFrame: { position: 'absolute', right: 36, top: 52, width: '38.5%', height: '58%', borderWidth: 10, borderColor: '#FFFDF8', backgroundColor: '#FFFDF8', shadowColor: '#0F0F0D', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.28, shadowRadius: 16, elevation: 8 },
  seekPhotoFrameCompact: { right: 15, top: 20, width: '39%', height: '60%', borderWidth: 5 },
  seekPhoto: { width: '100%', height: '100%', backgroundColor: '#BDBAB1' },
  mountainPostcard: { backgroundColor: '#EFEEE7', alignItems: 'center', justifyContent: 'center', borderColor: '#D9D7CE' },
  mountainCard: { width: '86%', height: '74%', backgroundColor: '#FFFDF8', shadowColor: '#3D3931', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.22, shadowRadius: 18, elevation: 8 },
  mountainCardCompact: { width: '90%', height: '76%' },
  mountainPhoto: { width: '100%', height: '78%', backgroundColor: '#A8D5EA' },
  mountainBand: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFDF8', paddingHorizontal: 28 },
  mountainBandCompact: { paddingHorizontal: 12 },
  mountainTitle: { width: '100%', color: '#5C94A7', fontSize: 18, lineHeight: 24, fontFamily: 'Inter_600SemiBold', textAlign: 'center', textTransform: 'uppercase' },
  mountainTitleCompact: { fontSize: 8, lineHeight: 11 },
  templeHeritage: { backgroundColor: '#EEEDE5', alignItems: 'center', justifyContent: 'center', borderColor: '#D7D4CA' },
  templeCard: { width: '84%', height: '68%', backgroundColor: '#FFFDF8', shadowColor: '#3B342B', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.22, shadowRadius: 18, elevation: 8 },
  templeCardCompact: { width: '90%', height: '72%' },
  templeTitlePanel: { position: 'absolute', left: 0, top: 0, width: '41%', height: '74%', paddingLeft: 12, paddingRight: 14, paddingTop: 18, zIndex: 3 },
  templeTitle: { width: '100%', color: '#5D534B', fontSize: 26, lineHeight: 29, fontFamily: Platform.OS === 'web' ? 'Georgia' : 'Inter_700Bold', fontWeight: '700', textTransform: 'uppercase' },
  templeTitleCompact: { fontSize: 13, lineHeight: 15, paddingTop: 0 },
  templeQuote: { position: 'absolute', left: 12, right: 14, top: '38%', color: '#6A625A', fontSize: 6.7, lineHeight: 8.8, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  templeQuoteCompact: { left: 6, right: 7, top: '38%', fontSize: 3.6, lineHeight: 4.7 },
  templeQuoteAuthor: { position: 'absolute', left: 12, right: 14, top: '58%', color: '#8A8178', fontSize: 6.2, lineHeight: 8, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  templeQuoteAuthorCompact: { left: 6, right: 7, top: '58%', fontSize: 3.3, lineHeight: 4.3 },
  templeQuoteRule: { position: 'absolute', left: 12, right: 14, top: '67%', height: 1.5, backgroundColor: '#90877D' },
  templeQuoteRuleCompact: { left: 6, right: 7, height: 1 },
  templeDate: { position: 'absolute', left: 12, right: 14, bottom: 14, color: '#8A8178', fontSize: 10, lineHeight: 13, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  templeDateCompact: { left: 6, bottom: 6, fontSize: 5.5, lineHeight: 7 },
  templeHero: { position: 'absolute', right: 0, top: 0, width: '58%', height: '69%', backgroundColor: '#D8B28C' },
  templeStrip: { position: 'absolute', left: 0, bottom: 0, width: '66%', height: '25%', backgroundColor: '#D8B28C' },
  templeCountry: { position: 'absolute', right: 16, bottom: 45, width: '30%', color: '#5D534B', fontSize: 16, lineHeight: 20, fontFamily: Platform.OS === 'web' ? 'Georgia' : 'Inter_700Bold', fontWeight: '700', textAlign: 'right', textTransform: 'uppercase' },
  templeCountryCompact: { right: 7, bottom: 20, width: '34%', fontSize: 8, lineHeight: 10 },
  templePostcard: { position: 'absolute', right: 17, bottom: 14, color: '#8A8178', fontSize: 9, lineHeight: 12, fontFamily: 'Inter_700Bold', textAlign: 'right', textTransform: 'uppercase' },
  templePostcardCompact: { right: 7, bottom: 6, fontSize: 4.5, lineHeight: 6 },
  breakPostcard: { backgroundColor: '#EEEDE5', alignItems: 'center', justifyContent: 'center', borderColor: '#DAD8CD' },
  breakPaperGlow: { position: 'absolute', left: 20, right: 20, top: 20, bottom: 20, borderRadius: 18, backgroundColor: 'rgba(255,253,248,0.28)' },
  breakPhotoCard: { width: '88%', height: '72%', backgroundColor: '#D4D0C2', shadowColor: '#3A3326', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.26, shadowRadius: 18, elevation: 8 },
  breakPhotoCardCompact: { width: '90%', height: '74%' },
  breakImage: { width: '100%', height: '100%', backgroundColor: '#B7B49C' },
  breakTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,38,28,0.12)' },
  breakWarmWash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,246,220,0.08)' },
  breakHeadline: { position: 'absolute', left: 24, right: 24, top: '43%', color: '#FFFDF8', fontSize: 32, lineHeight: 38, fontFamily: Platform.OS === 'web' ? 'Brush Script MT, Segoe Script, cursive' : 'Inter_700Bold', fontStyle: 'italic', fontWeight: '700', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.28)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  breakHeadlineCompact: { left: 11, right: 11, fontSize: 15, lineHeight: 18, textShadowRadius: 3 },
  breakPlace: { position: 'absolute', left: 22, right: 22, bottom: 16, color: '#7C7A70', fontSize: 9, lineHeight: 12, fontFamily: 'Inter_700Bold', textAlign: 'center', textTransform: 'uppercase' },
  textureLayer: { ...StyleSheet.absoluteFillObject },
  textureDot: { position: 'absolute', backgroundColor: 'rgba(255,253,248,0.46)' },
  textureDotDark: { backgroundColor: 'rgba(255,253,248,0.2)' },
  textureLine: { position: 'absolute', height: 1, borderRadius: 1, backgroundColor: 'rgba(255,253,248,0.24)' },
  textureLineDark: { backgroundColor: 'rgba(255,253,248,0.12)' },
  textureLineA: { left: '9%', right: '12%', top: '18%', transform: [{ rotate: '-2deg' }] },
  textureLineB: { left: '18%', right: '19%', top: '54%', transform: [{ rotate: '1deg' }] },
  textureLineC: { left: '11%', right: '14%', top: '82%', transform: [{ rotate: '-1deg' }] },
  thisIsPostcard: { borderWidth: 18, borderColor: '#FFE46B', backgroundColor: '#FFE46B' },
  thisIsImage: { ...StyleSheet.absoluteFillObject, backgroundColor: '#EAD2C2' },
  thisIsTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(42,23,20,0.15)' },
  thisIsInnerFrame: { position: 'absolute', left: 12, right: 12, top: 12, bottom: 12, borderWidth: 1, borderColor: 'rgba(255,253,248,0.52)' },
  thisIsTape: { position: 'absolute', left: '42%', top: 0, width: 74, height: 18, borderRadius: 4, backgroundColor: 'rgba(255,253,248,0.45)', transform: [{ rotate: '-2deg' }] },
  thisIsMeta: { position: 'absolute', left: 12, right: 12, top: 10, color: '#35504A', fontSize: 10, lineHeight: 13, fontFamily: 'Inter_700Bold', textAlign: 'right', textTransform: 'uppercase', zIndex: 7 },
  thisIsWordLeft: { position: 'absolute', left: 54, top: 106, color: '#FFFDF8', fontSize: 20, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  thisIsWordRight: { position: 'absolute', right: 66, top: 106, color: '#FFFDF8', fontSize: 20, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  thisIsPlace: { position: 'absolute', left: 52, right: 52, top: 126, color: '#FFFDF8', lineHeight: 58, fontFamily: 'Inter_700Bold', textAlign: 'center', textTransform: 'uppercase', textShadowColor: 'rgba(42,23,20,0.22)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 8 },
  thisIsFooter: { position: 'absolute', left: 12, bottom: 10, color: '#35504A', fontSize: 10, lineHeight: 13, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', zIndex: 7 },
  wishPostcard: { backgroundColor: '#1D1D1B', borderRadius: 18 },
  wishMetaTop: { position: 'absolute', left: 16, top: 12, color: '#D7B47A', fontSize: 9, lineHeight: 12, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', zIndex: 7 },
  wishMetaBottom: { position: 'absolute', left: 16, right: 16, bottom: 10, color: '#D7B47A', fontSize: 9, lineHeight: 12, fontFamily: 'Inter_700Bold', textAlign: 'right', textTransform: 'uppercase', zIndex: 7 },
  wishPhotoTile: { position: 'absolute', borderRadius: 3, backgroundColor: '#EAD2C2' },
  wishTileA: { left: 14, top: 14, width: '28.5%', height: '26%' },
  wishTileB: { left: '35.8%', top: 14, width: '28.5%', height: '26%' },
  wishTileC: { right: 14, top: 14, width: '28.5%', height: '26%' },
  wishTileD: { left: 14, top: '39%', width: '28.5%', height: '24%' },
  wishTileE: { right: 14, top: '39%', width: '28.5%', height: '24%' },
  wishTileF: { left: 14, bottom: 14, width: '28.5%', height: '25%' },
  wishTileG: { left: '35.8%', bottom: 14, width: '28.5%', height: '25%' },
  wishTileH: { right: 14, bottom: 14, width: '28.5%', height: '25%' },
  wishCenter: { position: 'absolute', left: '35.6%', right: '35.6%', top: '34%', bottom: '29%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D1D1B', borderWidth: 1, borderColor: 'rgba(255,253,248,0.16)' },
  wishText: { color: '#FFFDF8', fontSize: 20, lineHeight: 29, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  snapshotsPostcard: { backgroundColor: '#E8F5F8', borderWidth: 1, borderColor: '#B7CFDC', padding: 16 },
  snapshotsInner: { flex: 1, flexDirection: 'row', gap: 28, alignItems: 'center' },
  snapshotsPhotoGrid: { width: '48%', height: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  snapshotsPhoto: { width: '47.4%', height: '22.7%', backgroundColor: '#D7E7EC' },
  snapshotsTextPanel: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  snapshotsEyebrow: { width: '100%', color: '#3C77A3', fontSize: 13, lineHeight: 18, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  snapshotsEyebrowCompact: { fontSize: 6.5, lineHeight: 9 },
  snapshotsHeadline: { width: '100%', color: '#3F7CAE', fontSize: 35, lineHeight: 42, fontFamily: 'Inter_700Bold', textAlign: 'center', letterSpacing: 0 },
  snapshotsHeadlineCompact: { fontSize: 15, lineHeight: 18 },
  snapshotsFrom: { width: '100%', color: '#3F7CAE', fontSize: 31, lineHeight: 38, fontFamily: 'Inter_700Bold', textAlign: 'center', letterSpacing: 0 },
  snapshotsFromCompact: { fontSize: 13, lineHeight: 16 },
  snapshotsDestination: { width: '100%', color: '#3F7CAE', fontSize: 31, lineHeight: 38, fontFamily: 'Inter_700Bold', textAlign: 'center', textTransform: 'uppercase' },
  snapshotsDestinationCompact: { fontSize: 13, lineHeight: 16 },
  snapshotsNote: { width: '100%', color: '#3C77A3', fontSize: 15, lineHeight: 22, fontFamily: 'Inter_700Bold', textAlign: 'center', marginTop: 14 },
  snapshotsNoteCompact: { fontSize: 7, lineHeight: 10, marginTop: 5 },
  snapshotsAuthor: { width: '100%', color: '#5988A8', fontSize: 10, lineHeight: 13, fontFamily: 'Inter_700Bold', textAlign: 'center', marginTop: 5 },
  snapshotsAuthorCompact: { fontSize: 5, lineHeight: 7, marginTop: 2 },
  sidebarPostcard: { backgroundColor: '#D8C4A2', borderWidth: 12, borderColor: '#E9DFCF' },
  sidebarBackgroundImage: { ...StyleSheet.absoluteFillObject, backgroundColor: '#EAD2C2' },
  sidebarPhotoVignette: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(25,50,38,0.08)' },
  sidebarPanel: { position: 'absolute', left: 18, top: 22, bottom: 22, width: '36%', backgroundColor: '#FFFDF8', padding: 12, alignItems: 'center', justifyContent: 'center' },
  sidebarPanelTexture: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(244,231,207,0.28)' },
  sidebarInsetImage: { width: '100%', height: '24%', borderRadius: 2, backgroundColor: '#EAD2C2', marginBottom: 10 },
  sidebarTape: { position: 'absolute', top: 7, left: '27%', width: 54, height: 13, borderRadius: 4, backgroundColor: 'rgba(222,173,105,0.42)', transform: [{ rotate: '-2deg' }], zIndex: 3 },
  sidebarPlace: { width: '100%', color: '#193226', fontFamily: 'Inter_700Bold', textAlign: 'center', textTransform: 'uppercase' },
  sidebarStory: { width: '100%', color: '#193226', fontSize: 9, lineHeight: 12, fontFamily: 'Inter_600SemiBold', textAlign: 'center', marginTop: 7 },
  sidebarRule: { width: '100%', height: 2, borderRadius: 1, backgroundColor: '#193226', marginTop: 7, marginBottom: 7 },
  sidebarHandle: { color: '#193226', fontSize: 9, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  greetingsPostcard: { backgroundColor: '#FFFDF8', borderWidth: 8, borderColor: '#EFECE4' },
  greetingsGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 3, backgroundColor: '#FFFDF8' },
  greetingsPhoto: { width: '24.35%', height: '49.3%', backgroundColor: '#EAD2C2' },
  greetingsBand: { position: 'absolute', left: 0, right: 0, top: '37%', minHeight: 76, backgroundColor: 'rgba(255,253,248,0.97)', alignItems: 'center', justifyContent: 'center', gap: 1, paddingHorizontal: 18, paddingVertical: 8 },
  greetingsSmall: { color: '#2C2522', fontSize: 12, lineHeight: 15, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  greetingsPlace: { width: '100%', color: '#2C2522', lineHeight: 39, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  mastheadPostcard: { backgroundColor: '#FFFDF8', padding: 12, borderWidth: 1, borderColor: '#DAD4C9' },
  mastheadTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  mastheadMeta: { color: '#6D6961', fontSize: 9, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  mastheadPlace: { width: '100%', color: '#5B5750', lineHeight: 58, fontFamily: 'Inter_700Bold', textAlign: 'center', textTransform: 'uppercase' },
  mastheadRule: { height: 1, backgroundColor: '#DAD4C9', marginBottom: 8 },
  mastheadImage: { flex: 1, width: '100%', borderRadius: 2, backgroundColor: '#EAD2C2' },
  mastheadImageBorder: { position: 'absolute', left: 12, right: 12, top: 112, bottom: 12, borderWidth: 1, borderColor: 'rgba(255,253,248,0.64)' },
  pinnedPostcard: { backgroundColor: '#E5E2D8', alignItems: 'center', justifyContent: 'center' },
  pinnedBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: '#EAD2C2' },
  pinnedBackdropTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,253,248,0.22)' },
  pinnedFrame: { width: '70%', height: '76%', backgroundColor: '#FFFDF8', padding: 10, paddingBottom: 40, shadowColor: '#2A1714', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 7 },
  pinnedPin: { position: 'absolute', top: -9, left: '50%', width: 20, height: 20, marginLeft: -10, borderRadius: 10, backgroundColor: '#C8C2AB', borderWidth: 2, borderColor: '#8F8670', zIndex: 5 },
  pinnedTape: { position: 'absolute', top: -12, left: '34%', width: 80, height: 22, borderRadius: 5, backgroundColor: 'rgba(222,173,105,0.42)', transform: [{ rotate: '1deg' }], zIndex: 4 },
  pinnedPhoto: { flex: 1, width: '100%', backgroundColor: '#EAD2C2' },
  pinnedText: { position: 'absolute', left: 12, right: 12, bottom: 8, color: '#4C3328', fontSize: 16, lineHeight: 19, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  designedTemplate: {
    height: 340,
    borderRadius: 20,
    marginBottom: 14,
    overflow: 'hidden',
    padding: 12,
    backgroundColor: '#FFF6E9',
    borderWidth: 1,
    borderColor: '#EFD6C4',
  },
  scrapbookTemplate: { backgroundColor: '#F0D9B8', borderColor: '#DDBF95', paddingTop: 18 },
  postcardTemplate: { backgroundColor: '#F8EBDD', borderColor: '#E7C9AD', padding: 14 },
  editorialTemplate: { backgroundColor: '#FFFDF8', borderColor: '#EFD6C4', paddingTop: 28 },
  journalTemplate: { backgroundColor: '#D8A566', borderColor: '#C98D50', padding: 14, paddingLeft: 18 },
  filmTemplate: { backgroundColor: '#221915', borderColor: '#3E2C22', paddingTop: 36, paddingBottom: 36 },
  classicTemplate: { backgroundColor: '#FFFDF8', borderColor: '#EFD6C4', padding: 12 },
  airmailTemplate: { backgroundColor: '#F6FBFD', borderColor: '#A7CAD8', padding: 17, paddingTop: 30, paddingBottom: 22 },
  vintageTemplate: { backgroundColor: '#E8D0A8', borderColor: '#A97858', padding: 18, paddingTop: 42 },
  letterTemplate: { backgroundColor: '#FFF0CA', borderColor: '#E2B557', padding: 18, paddingTop: 42 },
  boardingTemplate: { backgroundColor: '#EEF9F6', borderColor: '#8FC3BF', padding: 18, paddingLeft: 42, paddingTop: 44 },
  galleryTemplate: { backgroundColor: '#191B1D', borderColor: '#3B3028', padding: 14, paddingTop: 44, paddingBottom: 18 },
  sunsetPostcardTemplate: { backgroundColor: '#FFE7CF', borderColor: '#F1B287', padding: 18, paddingTop: 44, paddingBottom: 22 },
  airmailStripe: { position: 'absolute', left: 0, right: 0, height: 7, zIndex: 5 },
  airmailStripeTop: { top: 0, backgroundColor: '#D95E50' },
  airmailStripeBottom: { bottom: 0, backgroundColor: '#4A9CB8' },
  airmailPostmark: {
    position: 'absolute',
    right: 18,
    top: 16,
    width: 72,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: 'rgba(44,110,130,0.44)',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
    zIndex: 5,
  },
  airmailPostmarkText: { color: '#2C6E82', fontSize: 10, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  airmailRouteCard: {
    position: 'absolute',
    left: 20,
    top: 15,
    width: 98,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,253,248,0.72)',
    padding: 7,
    gap: 5,
    zIndex: 4,
  },
  airmailRouteLine: { width: '78%', height: 3, borderRadius: 2, backgroundColor: 'rgba(217,94,80,0.52)' },
  airmailRouteLineShort: { width: '48%', backgroundColor: 'rgba(74,156,184,0.58)' },
  vintagePaperWash: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    bottom: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,248,225,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(142,97,61,0.18)',
    zIndex: 0,
  },
  vintageStamp: {
    position: 'absolute',
    right: 18,
    top: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#8E613D',
    backgroundColor: 'rgba(255,245,224,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  vintageStampRing: { width: 23, height: 23, borderRadius: 12, borderWidth: 2, borderColor: '#8E613D' },
  vintageTemplateLabel: {
    position: 'absolute',
    left: 20,
    top: 16,
    color: '#6E452C',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0,
    textTransform: 'uppercase',
    zIndex: 5,
  },
  letterEnvelopePanel: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 18,
    bottom: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(255,253,248,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(136,91,34,0.18)',
    zIndex: 0,
  },
  letterTemplateLabel: {
    position: 'absolute',
    left: 20,
    top: 15,
    color: '#63301D',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0,
    textTransform: 'uppercase',
    zIndex: 4,
  },
  letterPostageBox: {
    position: 'absolute',
    right: 18,
    top: 15,
    width: 42,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(99,48,29,0.38)',
    backgroundColor: 'rgba(255,253,248,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  letterPostageMark: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#B5783D' },
  boardingTemplateRail: { position: 'absolute', left: 14, top: 16, bottom: 16, width: 16, borderRadius: 8, backgroundColor: '#235D61', zIndex: 4 },
  boardingPerforation: { position: 'absolute', left: 22, top: 26, bottom: 26, justifyContent: 'space-between', zIndex: 5 },
  boardingPerforationDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,253,248,0.84)' },
  boardingTopBar: {
    position: 'absolute',
    left: 42,
    right: 18,
    top: 14,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,253,248,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    zIndex: 4,
  },
  boardingTopText: { color: '#235D61', fontSize: 10, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  boardingTopCode: { color: '#D9663A', fontSize: 10, fontFamily: 'Inter_700Bold' },
  boardingBarcode: { position: 'absolute', right: 22, bottom: 19, height: 30, flexDirection: 'row', alignItems: 'flex-end', gap: 3, zIndex: 5 },
  boardingBarcodeLine: { width: 3, height: 17, borderRadius: 2, backgroundColor: 'rgba(35,93,97,0.56)' },
  boardingBarcodeLineTall: { height: 28 },
  templateMascotMarkCircle: {
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,253,248,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(35,93,97,0.16)',
    shadowColor: '#173A45',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  templateMascotMarkImage: { width: '100%', height: '100%' },
  gallerySpotlight: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 16,
    bottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(248,231,208,0.18)',
    backgroundColor: 'rgba(248,231,208,0.04)',
    zIndex: 0,
  },
  galleryTemplateLabel: {
    position: 'absolute',
    left: 16,
    top: 14,
    color: '#F8E7D0',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0,
    textTransform: 'uppercase',
    zIndex: 4,
  },
  gallerySideTag: { position: 'absolute', right: 16, top: 13, width: 58, height: 22, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(248,231,208,0.36)', backgroundColor: 'rgba(248,231,208,0.12)', alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  gallerySideTagText: { color: '#F8E7D0', fontSize: 9, fontFamily: 'Inter_700Bold' },
  galleryDestination: { position: 'absolute', left: 16, right: 88, top: 27, color: '#FFF3D6', fontSize: 18, lineHeight: 22, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', zIndex: 6 },
  galleryMeta: { position: 'absolute', left: 17, right: 17, bottom: 16, color: '#D0A56E', fontSize: 10, lineHeight: 13, fontFamily: 'Inter_700Bold', textAlign: 'right', textTransform: 'uppercase', zIndex: 6 },
  sunsetPostcardTopTint: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 14,
    height: 38,
    borderRadius: 18,
    backgroundColor: 'rgba(255,253,248,0.48)',
    zIndex: 0,
  },
  sunsetPostcardFrameLine: {
    position: 'absolute',
    left: 17,
    right: 17,
    top: 17,
    bottom: 17,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(180,91,45,0.18)',
    zIndex: 0,
  },
  sunsetPostcardLabel: {
    position: 'absolute',
    left: 24,
    top: 19,
    color: '#9E4A26',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0,
    textTransform: 'uppercase',
    zIndex: 5,
  },
  sunsetSunBadge: { position: 'absolute', right: 22, top: 16, width: 34, height: 34, borderRadius: 17, backgroundColor: '#F9B55C', borderWidth: 4, borderColor: 'rgba(255,253,248,0.72)', zIndex: 6 },
  sunsetDestination: { position: 'absolute', left: 24, right: 68, top: 34, color: '#9E4A26', fontSize: 18, lineHeight: 22, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', zIndex: 6 },
  sunsetMeta: { position: 'absolute', left: 24, right: 24, bottom: 17, color: '#9E4A26', fontSize: 9, lineHeight: 12, fontFamily: 'Inter_700Bold', textAlign: 'right', textTransform: 'uppercase', zIndex: 6 },
  sunsetPostcardBottomRule: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 12,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(242,106,46,0.28)',
    zIndex: 5,
  },
  postcardTemplateStamp: {
    position: 'absolute',
    right: 18,
    top: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#A97858',
    backgroundColor: 'rgba(255,253,248,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  postcardStampInnerCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#A97858' },
  scrapbookTemplateTape: {
    position: 'absolute',
    top: 10,
    left: '38%',
    width: 92,
    height: 22,
    borderRadius: 5,
    backgroundColor: 'rgba(210,145,74,0.42)',
    transform: [{ rotate: '-2deg' }],
    zIndex: 5,
  },
  scrapbookTemplateTicket: {
    position: 'absolute',
    left: 14,
    top: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255,253,248,0.86)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 4,
  },
  scrapbookTemplateTicketText: { color: '#7D5B43', fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0 },
  journalTemplateSpine: {
    position: 'absolute',
    left: '50%',
    top: 12,
    bottom: 12,
    width: 8,
    borderRadius: 4,
    backgroundColor: '#B77843',
    zIndex: 3,
  },
  filmTemplateHoles: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  filmTemplateHolesTop: { top: 14 },
  filmTemplateHolesBottom: { bottom: 14 },
  filmTemplateHole: { width: 10, height: 8, borderRadius: 2, backgroundColor: '#F8E8C9' },
  filmClapboard: { position: 'absolute', left: 18, bottom: 38, width: 62, height: 38, borderRadius: 5, backgroundColor: '#F8E8C9', borderWidth: 2, borderColor: '#D0A56E', overflow: 'hidden', zIndex: 6, transform: [{ rotate: '-3deg' }] },
  filmClapTop: { height: 12, backgroundColor: '#221915', borderBottomWidth: 2, borderColor: '#D0A56E' },
  filmClapText: { color: '#5B3828', fontSize: 10, lineHeight: 14, fontFamily: 'Inter_700Bold', textAlign: 'center', marginTop: 4 },
  adaptiveSet: { flex: 1, gap: 8, zIndex: 2 },
  adaptiveRow: { flexDirection: 'row' },
  adaptiveBottomRow: { flex: 0.82, flexDirection: 'row', gap: 8 },
  adaptiveGridRow: { flex: 1, flexDirection: 'row', gap: 8 },
  adaptiveSideGrid: { flex: 1, gap: 8 },
  adaptiveHeroSide: { flex: 1.16 },
  adaptiveHeroTop: { flex: 1.35 },
  adaptiveFill: { flex: 1 },
  adaptiveFlexCell: { flex: 1 },
  adaptivePhotoFrame: { overflow: 'hidden', borderRadius: 14, backgroundColor: '#EAD2C2' },
  adaptivePhotoFrameEditorial: { borderRadius: 10 },
  adaptivePhotoFramePolaroid: {
    borderWidth: 8,
    borderBottomWidth: 22,
    borderColor: '#FFFDF8',
    borderRadius: 8,
    shadowColor: '#5E321F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  adaptivePhotoFrameScrapbook: {
    borderWidth: 7,
    borderColor: '#FFFDF8',
    borderRadius: 9,
    shadowColor: '#7D4F2F',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 5,
  },
  adaptivePhotoFramePostcard: { borderWidth: 5, borderColor: '#FFFDF8', borderRadius: 7 },
  adaptivePhotoFrameFilm: { borderWidth: 3, borderColor: '#D0A56E', borderRadius: 8 },
  adaptivePhotoFrameJournal: { borderWidth: 6, borderColor: '#FFFDF8', borderRadius: 8 },
  adaptivePhotoFrameClassic: { borderWidth: 6, borderColor: '#FFFDF8', borderRadius: 10 },
  adaptivePhotoFrameAirmail: { borderWidth: 5, borderColor: '#FFFDF8', borderRadius: 10, shadowColor: '#315D6D', shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 },
  adaptivePhotoFrameVintage: { borderWidth: 7, borderColor: '#FFF3D6', borderRadius: 9, shadowColor: '#6E452C', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 4 },
  adaptivePhotoFrameLetter: { borderWidth: 5, borderColor: '#FFFDF8', borderRadius: 10, shadowColor: '#9D6B29', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 },
  adaptivePhotoFrameBoarding: { borderWidth: 5, borderColor: '#FFFDF8', borderRadius: 14, shadowColor: '#235D61', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 15, elevation: 4 },
  adaptivePhotoFrameGallery: { borderWidth: 3, borderColor: '#F8E7D0', borderRadius: 10, shadowColor: '#000000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 18, elevation: 5 },
  adaptivePhotoFrameSunsetPostcard: { borderWidth: 6, borderColor: '#FFFDF8', borderRadius: 16, shadowColor: '#8A3E1F', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.14, shadowRadius: 18, elevation: 5 },
  adaptiveImage: { width: '100%', height: '100%' },
  adaptiveImagePostcard: { borderRadius: 2 },
  sunsetWrap: { height: 318, borderRadius: 20, marginBottom: 14, overflow: 'hidden', backgroundColor: '#FA6E3E', borderWidth: 1, borderColor: '#E85B2E' },
  sunsetOrb: { position: 'absolute', right: -48, top: -38, width: 180, height: 180, borderRadius: 90, backgroundColor: '#FFD07B', opacity: 0.9 },
  sunsetGlowBand: { position: 'absolute', left: -24, right: -24, bottom: 88, height: 86, borderRadius: 43, backgroundColor: 'rgba(255,220,156,0.35)', transform: [{ rotate: '-7deg' }] },
  sunsetHeaderBlock: { position: 'absolute', left: 18, top: 18, right: 112, zIndex: 4 },
  sunsetLabelLine: { width: '76%', height: 9, borderRadius: 5, backgroundColor: '#351A15', opacity: 0.92, marginBottom: 8 },
  sunsetLabelShort: { width: '48%', height: 5, borderRadius: 3, backgroundColor: '#FFF3D8', opacity: 0.86 },
  sunsetTiny: { color: '#FFF3D8', fontSize: 10, letterSpacing: 0, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', marginBottom: 7 },
  sunsetTitle: { color: '#341A16', fontSize: 24, lineHeight: 27, fontFamily: 'Inter_700Bold' },
  sunsetHero: { position: 'absolute', left: 18, right: 18, bottom: 55, height: '56%', borderRadius: 20, borderWidth: 8, borderColor: '#FFF6E8', backgroundColor: '#EAD2C2', shadowColor: '#5B2418', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.22, shadowRadius: 24, elevation: 6 },
  sunsetInset: { position: 'absolute', right: 28, top: 70, width: '30%', height: '30%', borderRadius: 14, borderWidth: 6, borderColor: '#FFF6E8', backgroundColor: '#EAD2C2', transform: [{ rotate: '5deg' }], zIndex: 5, shadowColor: '#5B2418', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 4 },
  sunsetFooter: { position: 'absolute', left: 20, right: 22, bottom: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sunsetPlace: { color: '#FFF6E8', fontSize: 18, fontFamily: 'Inter_700Bold' },
  sunsetDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFF6E8' },
  sunsetRule: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,246,232,0.62)' },
  passportWrap: { height: 318, borderRadius: 20, marginBottom: 14, overflow: 'hidden', backgroundColor: '#DDF4F1', borderWidth: 1, borderColor: '#A6D3D5' },
  passportGrid: { ...StyleSheet.absoluteFillObject, borderWidth: 14, borderColor: 'rgba(255,255,255,0.32)' },
  passportMapShapeA: { position: 'absolute', left: -18, top: 42, width: 124, height: 82, borderRadius: 42, backgroundColor: 'rgba(46,139,139,0.13)', transform: [{ rotate: '-16deg' }] },
  passportMapShapeB: { position: 'absolute', right: -24, bottom: 48, width: 144, height: 94, borderRadius: 48, backgroundColor: 'rgba(58,122,149,0.16)', transform: [{ rotate: '11deg' }] },
  passportSeal: { position: 'absolute', right: 22, top: 22, width: 78, height: 78, borderRadius: 39, borderWidth: 3, borderColor: '#2E8B8B', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,253,248,0.72)', zIndex: 4 },
  passportSealText: { color: '#246D74', fontSize: 10, letterSpacing: 0, fontFamily: 'Inter_700Bold' },
  passportPhotoMain: { position: 'absolute', left: 20, top: 26, width: '55%', height: '56%', borderRadius: 16, borderWidth: 7, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2', transform: [{ rotate: '-2deg' }], shadowColor: '#173F4A', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 5 },
  passportPhotoSmall: { position: 'absolute', right: 24, bottom: 28, width: '37%', height: '37%', borderRadius: 14, borderWidth: 7, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2', transform: [{ rotate: '4deg' }], shadowColor: '#173F4A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 18, elevation: 4 },
  passportTicket: { position: 'absolute', left: 28, bottom: 30, width: '42%', minHeight: 66, borderRadius: 12, backgroundColor: '#173F4A', padding: 12, justifyContent: 'center', gap: 8 },
  passportTicketLine: { width: '78%', height: 6, borderRadius: 3, backgroundColor: '#B7E8E3' },
  passportTicketLineShort: { width: '48%', backgroundColor: '#E6FFFB' },
  passportTicketPlace: { color: '#FFFDF8', fontSize: 16, fontFamily: 'Inter_700Bold' },
  passportTicketDate: { color: '#B7E8E3', fontSize: 11, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  passportStampBox: { position: 'absolute', right: 108, top: 105, borderWidth: 2, borderColor: '#F26A2E', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, transform: [{ rotate: '-8deg' }] },
  passportStampInner: { width: 28, height: 12, borderRadius: 6, backgroundColor: 'rgba(242,106,46,0.22)' },
  passportStampText: { color: '#F26A2E', fontSize: 10, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  colorPopWrap: { height: 318, borderRadius: 20, marginBottom: 14, overflow: 'hidden', backgroundColor: '#F9CB41', borderWidth: 1, borderColor: '#E6B321' },
  colorPopOrange: { position: 'absolute', left: 0, top: 0, width: '44%', height: '42%', backgroundColor: '#FF6B35' },
  colorPopMint: { position: 'absolute', right: 0, bottom: 0, width: '42%', height: '44%', backgroundColor: '#6ED2B5' },
  colorPopBlue: { position: 'absolute', right: 18, top: 18, width: 58, height: 58, borderRadius: 29, backgroundColor: '#4BB7E8', opacity: 0.86 },
  colorPopHero: { position: 'absolute', left: 22, top: 24, width: '60%', height: '49%', borderRadius: 20, borderWidth: 8, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2', shadowColor: '#8B4B00', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.16, shadowRadius: 20, elevation: 5 },
  colorPopTileLeft: { position: 'absolute', left: 32, bottom: 28, width: '36%', height: '33%', borderRadius: 17, borderWidth: 7, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2', transform: [{ rotate: '-5deg' }], shadowColor: '#8B4B00', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 4 },
  colorPopTileRight: { position: 'absolute', right: 25, top: 68, width: '31%', height: '33%', borderRadius: 17, borderWidth: 7, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2', transform: [{ rotate: '6deg' }], shadowColor: '#8B4B00', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 4 },
  colorPopCaption: { position: 'absolute', right: 22, bottom: 24, left: '48%', minHeight: 86, borderRadius: 18, backgroundColor: '#FFFDF8', padding: 13, justifyContent: 'center', gap: 7 },
  colorPopCaptionLine: { width: '84%', height: 7, borderRadius: 4, backgroundColor: '#2A1714' },
  colorPopCaptionLineShort: { width: '55%', backgroundColor: '#FF6B35' },
  colorPopCaptionDotRow: { flexDirection: 'row', gap: 5, marginTop: 2 },
  colorPopCaptionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F26A2E' },
  colorPopPlace: { color: '#FF5F2E', fontSize: 12, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', marginBottom: 5 },
  colorPopTitle: { color: INK, fontSize: 17, lineHeight: 20, fontFamily: 'Inter_700Bold' },
  dreamWrap: { height: 318, borderRadius: 20, marginBottom: 14, overflow: 'hidden', backgroundColor: '#E8DDF8', borderWidth: 1, borderColor: '#D3C0EF' },
  dreamMoon: { position: 'absolute', left: -40, top: -40, width: 154, height: 154, borderRadius: 77, backgroundColor: '#FFD9C8', opacity: 0.74 },
  dreamCloud: { position: 'absolute', right: -42, bottom: 48, width: 168, height: 92, borderRadius: 46, backgroundColor: '#CDEEFF', opacity: 0.8 },
  dreamBackPhoto: { position: 'absolute', left: 22, top: 34, width: '48%', height: '47%', borderRadius: 20, opacity: 0.72, backgroundColor: '#EAD2C2', transform: [{ rotate: '-8deg' }] },
  dreamMainPhoto: { position: 'absolute', right: 25, top: 42, width: '58%', height: '56%', borderRadius: 22, borderWidth: 8, borderColor: 'rgba(255,253,248,0.92)', backgroundColor: '#EAD2C2', transform: [{ rotate: '3deg' }] },
  dreamSmallPhoto: { position: 'absolute', left: 34, bottom: 32, width: '34%', height: '31%', borderRadius: 18, borderWidth: 7, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2', transform: [{ rotate: '5deg' }] },
  dreamStarA: { position: 'absolute', left: 56, top: 34, width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFDF8', opacity: 0.88 },
  dreamStarB: { position: 'absolute', right: 66, bottom: 104, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFD9C8', opacity: 0.95 },
  dreamNote: { position: 'absolute', right: 28, bottom: 26, left: '45%', minHeight: 76, borderRadius: 18, backgroundColor: 'rgba(255,253,248,0.82)', padding: 12, gap: 8 },
  dreamNoteLine: { width: '78%', height: 6, borderRadius: 3, backgroundColor: '#A391D0' },
  dreamNoteLineShort: { width: '48%', backgroundColor: '#F2BCA7' },
  dreamNoteCircle: { position: 'absolute', right: 12, bottom: 12, width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#D7C9F3' },
  dreamNoteDate: { color: '#7D6EAB', fontSize: 10, fontFamily: 'Inter_700Bold', marginBottom: 5, textTransform: 'uppercase' },
  dreamNoteTitle: { color: '#2A1714', fontSize: 16, lineHeight: 19, fontFamily: 'Inter_700Bold' },
  scrapbookWrap: { height: 318, borderRadius: 20, marginBottom: 14, overflow: 'hidden', backgroundColor: '#F3E0BF', borderWidth: 1, borderColor: '#E6C69C' },
  scrapbookWarmWash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,248,231,0.52)' },
  scrapbookDeckleA: { position: 'absolute', left: -18, top: 18, width: '58%', height: '78%', borderRadius: 26, backgroundColor: 'rgba(255,253,248,0.42)', transform: [{ rotate: '-8deg' }] },
  scrapbookDeckleB: { position: 'absolute', right: -28, bottom: 20, width: '62%', height: '64%', borderRadius: 30, backgroundColor: 'rgba(215,157,83,0.2)', transform: [{ rotate: '9deg' }] },
  scrapbookPressedFlower: { position: 'absolute', left: 18, bottom: 20, width: 74, height: 118, zIndex: 5 },
  scrapFlowerStem: { position: 'absolute', left: 31, bottom: 0, width: 3, height: 92, borderRadius: 2, backgroundColor: '#B99A63', transform: [{ rotate: '14deg' }] },
  scrapLeaf: { position: 'absolute', width: 24, height: 13, borderRadius: 12, backgroundColor: 'rgba(151,140,88,0.38)' },
  scrapLeafA: { left: 6, top: 41, transform: [{ rotate: '-26deg' }] },
  scrapLeafB: { right: 8, top: 59, transform: [{ rotate: '24deg' }] },
  scrapFlowerBud: { position: 'absolute', left: 20, top: 17, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#D8BFA1' },
  scrapNoteCard: { position: 'absolute', left: 24, top: 34, width: 106, height: 93, borderRadius: 9, backgroundColor: 'rgba(255,253,248,0.94)', padding: 14, gap: 9, transform: [{ rotate: '-5deg' }], shadowColor: '#7D4F2F', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 4, zIndex: 5 },
  scrapNoteTitleLine: { width: '76%', height: 8, borderRadius: 4, backgroundColor: INK },
  scrapNoteLine: { width: '94%', height: 5, borderRadius: 3, backgroundColor: '#D7BCA0' },
  scrapNoteLineShort: { width: '58%', backgroundColor: '#E6CEB2' },
  scrapNoteHeart: { position: 'absolute', right: 13, bottom: 12, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#CF7D6C' },
  scrapBackgroundPhoto: { position: 'absolute', right: 20, top: 28, width: '42%', height: '48%', borderWidth: 7, borderColor: '#FFFDF8', borderRadius: 8, backgroundColor: '#EAD2C2', opacity: 0.58, transform: [{ rotate: '8deg' }], zIndex: 1 },
  scrapHeroFrame: { position: 'absolute', left: '30%', right: 24, top: 48, height: '47%', borderWidth: 8, borderColor: '#FFFDF8', borderRadius: 9, backgroundColor: '#FFFDF8', overflow: 'hidden', transform: [{ rotate: '1deg' }], shadowColor: '#7D4F2F', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.18, shadowRadius: 22, elevation: 7, zIndex: 4 },
  scrapHeroPhoto: { width: '100%', height: '100%', backgroundColor: '#EAD2C2' },
  scrapSmallPhotoLeft: { position: 'absolute', left: '34%', bottom: 24, width: '29%', height: '27%', borderWidth: 6, borderColor: '#FFFDF8', borderRadius: 7, backgroundColor: '#EAD2C2', transform: [{ rotate: '-4deg' }], zIndex: 6 },
  scrapSmallPhotoRight: { position: 'absolute', right: 22, bottom: 30, width: '30%', height: '28%', borderWidth: 6, borderColor: '#FFFDF8', borderRadius: 7, backgroundColor: '#EAD2C2', transform: [{ rotate: '5deg' }], zIndex: 5 },
  scrapTapeTop: { position: 'absolute', top: 38, left: '47%', width: 86, height: 23, borderRadius: 5, backgroundColor: 'rgba(210,145,74,0.42)', transform: [{ rotate: '2deg' }], zIndex: 8 },
  scrapTapeSmall: { position: 'absolute', right: 42, bottom: 104, width: 54, height: 16, borderRadius: 4, backgroundColor: 'rgba(255,253,248,0.72)', transform: [{ rotate: '12deg' }], zIndex: 7 },
  mosaicWrap: { height: 318, borderRadius: 20, marginBottom: 14, overflow: 'hidden', backgroundColor: '#F8EBDD', borderWidth: 1, borderColor: '#EBD0B8' },
  mosaicPaperGlow: { position: 'absolute', left: -70, top: -54, width: 180, height: 180, borderRadius: 90, backgroundColor: '#FFF7EA', opacity: 0.74 },
  mosaicPostcardLines: { position: 'absolute', right: 20, top: 99, width: '33%', gap: 10, zIndex: 2 },
  mosaicAddressLine: { height: 2, borderRadius: 1, backgroundColor: 'rgba(132,97,75,0.24)' },
  mosaicPhoto: { position: 'absolute', borderRadius: 5, borderWidth: 7, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2', shadowColor: '#7D4F2F', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 4 },
  mosaicA: { left: 22, top: 21, width: '38%', height: '40%', transform: [{ rotate: '-2deg' }], zIndex: 3 },
  mosaicB: { right: 25, top: 29, width: '37%', height: '34%', transform: [{ rotate: '2deg' }], zIndex: 3 },
  mosaicC: { left: 30, bottom: 23, width: '42%', height: '36%', transform: [{ rotate: '1deg' }], zIndex: 3 },
  mosaicD: { right: 27, bottom: 27, width: '33%', height: '40%', transform: [{ rotate: '-1deg' }], zIndex: 3 },
  mosaicStamp: { position: 'absolute', right: 24, top: 20, width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: '#A97858', alignItems: 'center', justifyContent: 'center', zIndex: 6, backgroundColor: 'rgba(255,253,248,0.86)' },
  mosaicStampCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#B88D70', marginBottom: 5 },
  mosaicStampLine: { width: 32, height: 3, borderRadius: 2, backgroundColor: '#D7BFA0' },
  mosaicStampText: { color: '#8D674F', fontSize: 9, textAlign: 'center', fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  mosaicTicket: { position: 'absolute', left: 20, bottom: 27, width: 116, minHeight: 58, borderRadius: 8, borderWidth: 1, borderColor: '#E6C6A9', backgroundColor: '#F6DFC1', padding: 9, transform: [{ rotate: '-2deg' }], gap: 7 },
  mosaicTicketLine: { width: '78%', height: 5, borderRadius: 3, backgroundColor: '#B88D70' },
  mosaicTicketLineShort: { width: '54%', backgroundColor: '#D8BCA8' },
  mosaicTicketHeart: { position: 'absolute', right: 10, bottom: 9, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: '#D7A88C' },
  mosaicTicketText: { color: '#704B3A', fontSize: 11, lineHeight: 15, fontFamily: 'Inter_500Medium' },
  mosaicPerforation: { position: 'absolute', left: '49%', top: 22, bottom: 22, width: 1, justifyContent: 'space-between', zIndex: 1 },
  mosaicPerforationDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(132,97,75,0.2)' },
  editorialWrap: { height: 318, borderRadius: 20, marginBottom: 14, overflow: 'hidden', backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#EFD6C4' },
  editorialTextPanel: { position: 'absolute', left: 18, top: 18, width: '34%', height: '54%', zIndex: 4, gap: 8 },
  editorialAccentBlock: { position: 'absolute', left: 14, top: 14, width: '40%', height: '58%', borderRadius: 15, backgroundColor: '#F7EFE4', zIndex: 1 },
  editorialLineHero: { width: '95%', height: 10, borderRadius: 5, backgroundColor: INK },
  editorialLine: { width: '78%', height: 6, borderRadius: 3, backgroundColor: '#D8BCA8' },
  editorialLineShort: { width: '52%', height: 6, borderRadius: 3, backgroundColor: '#EBCFB9' },
  editorialTitle: { color: INK, fontSize: 22, lineHeight: 25, fontFamily: 'Inter_700Bold', marginBottom: 9 },
  editorialBody: { color: MUTED, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium' },
  editorialLeaf: { width: 30, height: 48, borderLeftWidth: 2, borderColor: '#C9AD92', borderRadius: 16, marginTop: 13, transform: [{ rotate: '18deg' }] },
  editorialHeroPhoto: { position: 'absolute', right: 18, top: 18, width: '55%', height: '55%', borderRadius: 12, backgroundColor: '#EAD2C2', zIndex: 3 },
  editorialBottomRow: { position: 'absolute', left: 18, right: 18, bottom: 18, height: '30%', flexDirection: 'row', gap: 6, zIndex: 3 },
  editorialSmallPhoto: { flex: 1, borderRadius: 10, backgroundColor: '#EAD2C2', borderWidth: 3, borderColor: '#FFFDF8' },
  filmWrap: { height: 318, borderRadius: 20, marginBottom: 14, overflow: 'hidden', backgroundColor: '#221915', borderWidth: 1, borderColor: '#3E2C22', justifyContent: 'center', paddingHorizontal: 14 },
  filmGlow: { position: 'absolute', left: -50, bottom: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(242,167,79,0.16)' },
  filmHoleRow: { position: 'absolute', top: 17, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' },
  filmHoleRowBottom: { position: 'absolute', bottom: 17, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' },
  filmHole: { width: 10, height: 8, borderRadius: 2, backgroundColor: '#F8E8C9' },
  filmTopLabel: { position: 'absolute', left: 26, right: 26, top: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filmTopLabelLine: { width: 100, height: 4, borderRadius: 2, backgroundColor: '#E8BD73', opacity: 0.8 },
  filmTopDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F26A2E' },
  filmFrames: { flexDirection: 'row', gap: 9, height: '55%', zIndex: 3 },
  filmFrameMount: { flex: 1, borderRadius: 9, borderWidth: 2, borderColor: '#D0A56E', backgroundColor: '#120D0B', padding: 3 },
  filmFrame: { width: '100%', height: '100%', borderRadius: 6, backgroundColor: '#EAD2C2' },
  filmNote: { position: 'absolute', left: 66, right: 66, bottom: 44, minHeight: 62, borderRadius: 7, backgroundColor: '#F8E1BF', padding: 11, transform: [{ rotate: '-2deg' }], gap: 7, justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 4, zIndex: 6 },
  filmNoteLine: { width: '82%', height: 5, borderRadius: 3, backgroundColor: '#8E5D34' },
  filmNoteLineShort: { width: '54%', backgroundColor: '#C08A58' },
  filmNoteText: { color: '#5B3828', fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold' },
  filmSprig: { position: 'absolute', right: 14, bottom: 10, width: 22, height: 18, borderBottomWidth: 2, borderColor: '#A98047', borderRadius: 10, transform: [{ rotate: '-15deg' }] },
  filmTape: { position: 'absolute', left: '42%', top: 54, width: 78, height: 18, borderRadius: 5, backgroundColor: 'rgba(234,193,125,0.36)', transform: [{ rotate: '3deg' }], zIndex: 8 },
  journalWrap: { height: 318, borderRadius: 20, marginBottom: 14, overflow: 'hidden', backgroundColor: '#D8A566', borderWidth: 1, borderColor: '#C98D50', flexDirection: 'row', padding: 13 },
  journalShadowPage: { position: 'absolute', left: 24, right: 24, top: 18, bottom: 17, borderRadius: 16, backgroundColor: 'rgba(99,62,34,0.12)' },
  journalPageLeft: { flex: 1, borderTopLeftRadius: 13, borderBottomLeftRadius: 13, backgroundColor: '#FFF7E8', padding: 14, paddingRight: 18, overflow: 'hidden' },
  journalPageRight: { flex: 1, borderTopRightRadius: 13, borderBottomRightRadius: 13, backgroundColor: '#FFF7E8', padding: 14, overflow: 'hidden' },
  journalSpiral: { width: 18, backgroundColor: '#B77843', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 18 },
  journalRing: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#8E5D34', backgroundColor: '#FFF7E8' },
  journalPageTitle: { color: INK, fontSize: 20, lineHeight: 24, fontFamily: 'Inter_700Bold', marginBottom: 10 },
  journalPageBody: { color: MUTED, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_500Medium' },
  journalPageTag: { alignSelf: 'flex-start', width: 82, height: 34, borderRadius: 8, backgroundColor: '#F7D9AC', justifyContent: 'center', paddingHorizontal: 10, transform: [{ rotate: '-4deg' }], marginBottom: 12 },
  journalPageTagLine: { width: '78%', height: 5, borderRadius: 3, backgroundColor: '#7A4A31' },
  journalLeftPhoto: { width: '86%', height: '30%', borderWidth: 6, borderColor: '#FFFDF8', borderRadius: 8, backgroundColor: '#EAD2C2', transform: [{ rotate: '-3deg' }], marginLeft: 4, marginBottom: 12 },
  journalLeftNote: { borderRadius: 10, backgroundColor: '#FFFDF8', padding: 10, gap: 8, transform: [{ rotate: '2deg' }] },
  journalTitleLine: { width: '82%', height: 7, borderRadius: 4, backgroundColor: INK },
  journalRuleLine: { width: '100%', height: 2, borderRadius: 1, backgroundColor: '#E7CDB1' },
  journalRuleLineShort: { width: '58%' },
  journalDoodle: { position: 'absolute', left: 18, bottom: 18, width: 42, height: 36, borderBottomWidth: 2, borderColor: '#C6AD7C', borderRadius: 18, transform: [{ rotate: '-14deg' }] },
  journalTape: { position: 'absolute', top: 12, left: 40, width: 58, height: 18, borderRadius: 5, backgroundColor: 'rgba(213,147,76,0.36)', transform: [{ rotate: '-5deg' }], zIndex: 4 },
  journalPhotoLarge: { width: '70%', height: '43%', alignSelf: 'center', borderRadius: 7, borderWidth: 7, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2', transform: [{ rotate: '3deg' }] },
  journalPhotoSmall: { width: '44%', height: '28%', borderRadius: 7, borderWidth: 6, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2', marginTop: 10, marginLeft: 9, transform: [{ rotate: '-4deg' }] },
  journalPhotoWide: { position: 'absolute', right: 13, bottom: 17, width: '43%', height: '33%', borderRadius: 7, borderWidth: 6, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2', transform: [{ rotate: '4deg' }] },
  journalBotanical: { position: 'absolute', left: 12, bottom: 15, width: 36, height: 54, borderLeftWidth: 2, borderColor: '#BFAE76', borderRadius: 16, transform: [{ rotate: '17deg' }] },
  fullPhotoWrap: { height: 292, borderRadius: 18, overflow: 'hidden', marginBottom: 14, backgroundColor: '#F8E9D9', borderWidth: 1, borderColor: '#F7DEC9' },
  postcardImage: { width: '100%', height: '100%' },
  fullPhotoShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%', backgroundColor: 'rgba(42,23,20,0.18)' },
  fullPhotoTag: { position: 'absolute', left: 16, bottom: 16, minWidth: 96, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,253,248,0.9)', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10 },
  fullPhotoTagDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ORANGE },
  fullPhotoTagLine: { width: 54, height: 4, borderRadius: 2, backgroundColor: '#D8BCA8' },
  splitWrap: { height: 292, borderRadius: 18, overflow: 'hidden', marginBottom: 14, backgroundColor: '#FFFDF8', borderWidth: 5, borderColor: '#FFFDF8', flexDirection: 'row', gap: 5, shadowColor: '#7D4F2F', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 },
  splitHero: { flex: 1.12, height: '100%', borderRadius: 13, backgroundColor: '#EAD2C2' },
  splitSide: { flex: 0.9, height: '100%', gap: 5 },
  splitSideTop: { flex: 1.1, borderRadius: 13, backgroundColor: '#EAD2C2' },
  splitSideBottomRow: { flex: 0.9, flexDirection: 'row', gap: 5 },
  splitSideSmall: { flex: 1, borderRadius: 13, backgroundColor: '#EAD2C2' },
  splitLabelRail: { position: 'absolute', left: 15, bottom: 15, width: 54, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,253,248,0.82)' },
  postcardStackWrap: { height: 300, borderRadius: 20, marginBottom: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#FFF1E6', borderWidth: 1, borderColor: '#F4D2B9' },
  postcardBackdrop: { position: 'absolute', left: -28, top: -20, right: -22, bottom: -18, backgroundColor: '#FFE8D1', transform: [{ rotate: '-4deg' }] },
  postcardSunCircle: { position: 'absolute', left: 20, bottom: 22, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,198,122,0.44)' },
  postcardLoosePhoto: { position: 'absolute', width: '47%', height: '50%', borderWidth: 8, borderColor: '#FFFDF8', borderRadius: 8, backgroundColor: '#EAD2C2', shadowColor: '#5E321F', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.11, shadowRadius: 18, elevation: 4, zIndex: 2 },
  postcardLooseLeft: { left: '7%', top: 36, transform: [{ rotate: '-13deg' }], opacity: 0.86 },
  postcardLooseRight: { right: '7%', bottom: 34, transform: [{ rotate: '12deg' }], opacity: 0.86 },
  postcardStackShadow: { position: 'absolute', left: '18%', right: '18%', bottom: 24, height: 30, borderRadius: 15, backgroundColor: 'rgba(94,50,31,0.12)', transform: [{ rotate: '-3deg' }], zIndex: 1 },
  postcardMain: { width: '70%', height: '74%', borderRadius: 11, borderWidth: 10, borderColor: '#FFFDF8', backgroundColor: '#FFFDF8', overflow: 'hidden', transform: [{ rotate: '-3deg' }], shadowColor: '#5E321F', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.2, shadowRadius: 22, elevation: 7, zIndex: 5 },
  postcardMainCompact: { borderWidth: 7 },
  postcardMainImage: { width: '100%', height: '78%', backgroundColor: '#EAD2C2' },
  postcardCaptionStrip: { flex: 1, backgroundColor: '#FFFDF8', justifyContent: 'center', gap: 5, paddingHorizontal: 12 },
  postcardCaptionText: { color: INK, fontSize: 12, fontFamily: 'Inter_700Bold' },
  postcardCaptionLine: { width: '60%', height: 5, borderRadius: 3, backgroundColor: '#D9BCA8' },
  postcardCaptionShort: { width: '38%', backgroundColor: '#EBCFB9' },
  postcardCaptionHeart: { position: 'absolute', right: 12, bottom: 11, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#D68E7A' },
  tapeLeft: { position: 'absolute', left: '21%', top: 29, width: 64, height: 19, borderRadius: 5, backgroundColor: 'rgba(255,253,248,0.76)', transform: [{ rotate: '-14deg' }], zIndex: 7 },
  tapeRight: { position: 'absolute', right: '16%', top: 41, width: 60, height: 18, borderRadius: 5, backgroundColor: 'rgba(255,253,248,0.72)', transform: [{ rotate: '13deg' }], zIndex: 7 },
  postcardStamp: { position: 'absolute', right: 18, top: 18, width: 58, height: 42, borderRadius: 12, borderWidth: 1, borderColor: '#E0B89A', backgroundColor: 'rgba(255,253,248,0.9)', alignItems: 'center', justifyContent: 'center', gap: 3, transform: [{ rotate: '5deg' }], zIndex: 8 },
  postcardStampCircle: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: ORANGE },
  postcardStampLine: { width: 25, height: 3, borderRadius: 2, backgroundColor: '#D8BCA8' },
  memoryCaption: { borderRadius: 16, borderWidth: 1, borderColor: '#EFD6C4', backgroundColor: '#FFFDF8', padding: 14, borderLeftWidth: 4, borderLeftColor: ORANGE },
  memoryCaptionCompact: { borderRadius: 10, padding: 8 },
  memoryLabel: { color: ORANGE, fontSize: 11, fontFamily: 'Inter_700Bold', marginBottom: 4, textTransform: 'uppercase' },
  generatedStory: { color: INK, fontSize: 14, lineHeight: 21, fontFamily: 'Inter_500Medium' },
  generatedStoryCompact: { fontSize: 11, lineHeight: 15 },
  generatedDate: { color: MUTED, fontSize: 12, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  generatedDateCompact: { fontSize: 10 },
  quoteCaptionBand: {
    marginTop: -3,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFD6C4',
    backgroundColor: 'rgba(255,253,248,0.72)',
    padding: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  quoteCaptionBandCompact: { borderRadius: 10, padding: 8, gap: 7, marginBottom: 8 },
  quoteCaptionIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFF1E6', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F7C7A4', overflow: 'visible' },
  quoteCaptionIconCompact: { width: 30, height: 30, borderRadius: 15 },
  studiousBeanBadge: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  studiousBeanBadgeCompact: { width: 32, height: 32 },
  studiousBeanImage: { width: '100%', height: '100%' },
  quoteSparkBadge: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  quoteSparkBadgeCompact: { width: 16, height: 16 },
  quoteSparkBack: { position: 'absolute', width: 16, height: 14, borderRadius: 4, backgroundColor: '#FFD3B8', transform: [{ rotate: '-8deg' }], left: 1, top: 5 },
  quoteSparkBackCompact: { width: 12, height: 11, borderRadius: 3, left: 1, top: 4 },
  quoteSparkFront: { width: 16, height: 16, borderRadius: 5, backgroundColor: '#FFFDF8', borderWidth: 1.5, borderColor: ORANGE, alignItems: 'center', justifyContent: 'center', gap: 1.5, shadowColor: '#8B5B38', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  quoteSparkFrontCompact: { width: 12, height: 12, borderRadius: 4, borderWidth: 1, gap: 1 },
  quoteSparkMarks: { flexDirection: 'row', gap: 2 },
  quoteSparkPair: { width: 3.5, height: 6, alignItems: 'center' },
  quoteSparkPairCompact: { width: 2.5, height: 4.5 },
  quoteSparkDot: { width: 3.5, height: 3.5, borderRadius: 1.75, backgroundColor: ORANGE },
  quoteSparkDotCompact: { width: 2.5, height: 2.5, borderRadius: 1.25 },
  quoteSparkStem: { width: 1.5, height: 3, borderRadius: 1, backgroundColor: ORANGE, marginTop: -1, transform: [{ rotate: '14deg' }] },
  quoteSparkStemCompact: { width: 1.2, height: 2.3 },
  quoteSparkLine: { width: 9, height: 1.5, borderRadius: 1, backgroundColor: '#F7B58C' },
  quoteSparkLineCompact: { width: 6, height: 1 },
  quoteSparkAccent: { position: 'absolute', right: 0, top: 1, width: 5.5, height: 5.5, borderRadius: 3, backgroundColor: '#F7B85E', borderWidth: 1, borderColor: '#FFFDF8' },
  quoteSparkAccentCompact: { right: 0, top: 0, width: 4, height: 4, borderRadius: 2 },
  quoteCaptionText: { color: INK, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_700Bold' },
  quoteCaptionTextCompact: { fontSize: 10, lineHeight: 14 },
  quoteCaptionAuthor: { color: MUTED, fontSize: 12, fontFamily: 'Inter_700Bold', marginTop: 5 },
  quoteCaptionAuthorCompact: { fontSize: 9, marginTop: 3 },
  quoteBase: {
    position: 'absolute',
    zIndex: 20,
    shadowColor: '#2A1714',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  quoteCompact: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7 },
  quoteScrapbook: {
    left: 18,
    bottom: 18,
    width: '46%',
    borderRadius: 12,
    backgroundColor: 'rgba(255,253,248,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(221,191,149,0.46)',
    padding: 12,
    transform: [{ rotate: '-2deg' }],
  },
  quotePostcard: {
    left: 18,
    right: 18,
    bottom: 18,
    borderRadius: 14,
    backgroundColor: 'rgba(255,253,248,0.64)',
    borderWidth: 1,
    borderColor: 'rgba(169,120,88,0.24)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  quoteFilm: {
    left: 28,
    right: 28,
    bottom: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(18,13,11,0.56)',
    borderWidth: 1,
    borderColor: 'rgba(248,232,201,0.28)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  quoteElegant: {
    left: 24,
    right: 24,
    bottom: 22,
    borderRadius: 16,
    backgroundColor: 'rgba(255,253,248,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,253,248,0.36)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  quoteText: { color: INK, fontSize: 13, lineHeight: 17, fontFamily: 'Inter_700Bold' },
  quoteTextCompact: { fontSize: 10, lineHeight: 13 },
  quoteTextFilm: { color: '#FFFDF8', textAlign: 'center' },
  quoteAuthor: { color: MUTED, fontSize: 10, fontFamily: 'Inter_700Bold', marginTop: 5 },
  quoteAuthorCompact: { fontSize: 8, marginTop: 3 },
  quoteAuthorFilm: { color: '#E8BD73', textAlign: 'center' },
  watermark: {
    position: 'absolute',
    right: 8,
    top: 10,
    width: 112,
    height: 76,
    alignItems: 'flex-end',
    justifyContent: 'center',
    opacity: 0.94,
    zIndex: 40,
    transform: [{ rotate: '-6deg' }],
  },
  watermarkSmall: { width: 78, height: 56 },
  watermarkCompact: { right: 6, top: 6 },
  watermarkInCollage: { right: 9, top: 9, opacity: 0.94, zIndex: 90, elevation: 10 },
  mascotWatermark: {
    position: 'absolute',
    right: 10,
    top: 9,
    width: 88,
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.96,
    zIndex: 40,
    transform: [{ rotate: '-4deg' }],
  },
  mascotWatermarkSmall: { width: 64, minHeight: 68 },
  templateMascotWatermark: { width: 86, minHeight: 86, opacity: 0.72, transform: [{ rotate: '-3deg' }] },
  templateMascotWatermarkSmall: { width: 62, minHeight: 62 },
  mascotWatermarkLabel: { marginTop: -5, borderRadius: 10, backgroundColor: 'rgba(255,253,248,0.86)', paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(241,215,197,0.9)' },
  mascotWatermarkLabelSmall: { marginTop: -4, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2 },
  mascotWatermarkText: { color: ORANGE, fontSize: 8, lineHeight: 10, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  mascotWatermarkTextSmall: { fontSize: 5.5, lineHeight: 7 },
  stampRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2.4,
    borderColor: 'rgba(125,75,48,0.74)',
    backgroundColor: 'rgba(255,253,248,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampRingCompact: { width: 50, height: 50, borderRadius: 25, borderWidth: 1.5 },
  stampInnerRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: 'rgba(125,75,48,0.56)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  stampInnerRingCompact: { width: 41, height: 41, borderRadius: 20.5 },
  stampMadeText: { color: 'rgba(125,75,48,0.9)', fontSize: 6.5, lineHeight: 8, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  stampMadeTextCompact: { fontSize: 4.2, lineHeight: 5.5 },
  stampIconSeal: {
    width: 25,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(125,75,48,0.46)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    backgroundColor: 'rgba(255,253,248,0.34)',
  },
  stampIconSealCompact: { width: 18, height: 18, borderRadius: 9, marginTop: 1 },
  stampRule: { width: 34, height: 1, borderRadius: 1, backgroundColor: 'rgba(125,75,48,0.52)', marginVertical: 1.5 },
  stampRuleCompact: { width: 24, marginVertical: 1 },
  stampPassText: { color: 'rgba(125,75,48,0.88)', fontSize: 5.8, lineHeight: 6.8, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  stampPassTextCompact: { fontSize: 4, lineHeight: 4.8 },
  stampCancelLines: { position: 'absolute', right: 54, top: 27, gap: 5 },
  stampCancelLinesCompact: { right: 39, top: 20, gap: 3.5 },
  stampCancelLine: { width: 48, height: 2, borderRadius: 1, backgroundColor: 'rgba(125,75,48,0.54)' },
  stampCancelLineCompact: { width: 34, height: 1.5 },
});
