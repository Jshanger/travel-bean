import type { BeanMood } from './travelBeanMvp';

export type QuoteCategory =
  | 'All'
  | 'Short'
  | 'Adventure'
  | 'Reflection'
  | 'Wonder'
  | 'Love & Friends'
  | 'Classic'
  | 'Discovery'
  | 'Nature'
  | 'Home'
  | 'Self-discovery';

export interface TravelQuote {
  id: string;
  text: string;
  author: string;
  categories: Exclude<QuoteCategory, 'All'>[];
  moodTags: Array<BeanMood | 'Reflective'>;
}

export type QuoteSourceType = 'premium_library' | 'premium_custom' | 'none';
export type QuotePlacement = 'postcard_quote' | 'scrapbook_note' | 'film_subtitle' | 'elegant_overlay' | 'none';

export const QUOTE_CATEGORIES: QuoteCategory[] = [
  'All',
  'Short',
  'Adventure',
  'Reflection',
  'Wonder',
  'Love & Friends',
  'Classic',
  'Discovery',
  'Nature',
  'Home',
  'Self-discovery',
];

export const TRAVEL_QUOTES: TravelQuote[] = [
  {
    id: 'quote_001',
    text: 'Not all those who wander are lost.',
    author: 'J.R.R. Tolkien',
    categories: ['Short', 'Adventure', 'Classic'],
    moodTags: ['Playful', 'Dreamy', 'Minimal'],
  },
  {
    id: 'quote_002',
    text: "One's destination is never a place, but a new way of seeing things.",
    author: 'Henry Miller',
    categories: ['Discovery', 'Reflection', 'Classic'],
    moodTags: ['Dreamy', 'Reflective'],
  },
  {
    id: 'quote_003',
    text: 'The world is a book, and those who do not travel read only a page.',
    author: 'Saint Augustine',
    categories: ['Classic', 'Wonder', 'Discovery'],
    moodTags: ['Dreamy', 'Reflective'],
  },
  {
    id: 'quote_004',
    text: "I haven't been everywhere, but it's on my list.",
    author: 'Susan Sontag',
    categories: ['Short', 'Adventure'],
    moodTags: ['Playful', 'Minimal'],
  },
  {
    id: 'quote_005',
    text: 'To travel is to live.',
    author: 'Hans Christian Andersen',
    categories: ['Short', 'Classic'],
    moodTags: ['Minimal', 'Dreamy', 'Playful'],
  },
  {
    id: 'quote_006',
    text: 'A journey is best measured in friends, rather than miles.',
    author: 'Tim Cahill',
    categories: ['Love & Friends', 'Short'],
    moodTags: ['Cozy', 'Playful'],
  },
  {
    id: 'quote_007',
    text: 'Traveling in the company of those we love is home in motion.',
    author: 'Leigh Hunt',
    categories: ['Love & Friends', 'Home'],
    moodTags: ['Cozy'],
  },
  {
    id: 'quote_008',
    text: 'The real voyage of discovery consists not in seeking new landscapes, but in having new eyes.',
    author: 'Marcel Proust',
    categories: ['Discovery', 'Reflection', 'Classic'],
    moodTags: ['Dreamy', 'Reflective'],
  },
  {
    id: 'quote_009',
    text: 'Traveling-it leaves you speechless, then turns you into a storyteller.',
    author: 'Ibn Battuta',
    categories: ['Classic', 'Wonder', 'Reflection'],
    moodTags: ['Dreamy', 'Reflective'],
  },
  {
    id: 'quote_010',
    text: 'Wherever you go, go with all your heart.',
    author: 'Confucius',
    categories: ['Short', 'Classic'],
    moodTags: ['Minimal', 'Cozy', 'Dreamy'],
  },
  {
    id: 'quote_011',
    text: 'There is pleasure in the pathless woods, there is rapture in the lonely shore.',
    author: 'Lord Byron',
    categories: ['Nature', 'Classic', 'Wonder'],
    moodTags: ['Dreamy', 'Reflective'],
  },
  {
    id: 'quote_012',
    text: 'The longest journey is the journey inwards.',
    author: 'Dag Hammarskjold',
    categories: ['Self-discovery', 'Short', 'Reflection'],
    moodTags: ['Minimal', 'Reflective'],
  },
  ...lifeQuoteTexts().map((quote, index): TravelQuote => ({
    id: `life_quote_${String(index + 1).padStart(3, '0')}`,
    text: quote.text,
    author: quote.author,
    categories: categoriesForLifeQuote(quote.text, quote.author),
    moodTags: moodsForLifeQuote(quote.text),
  })),
  ...travelBeanOriginalTexts().map((text, index): TravelQuote => ({
    id: `travel_bean_${String(index + 1).padStart(3, '0')}`,
    text,
    author: 'Travel Bean',
    categories: categoriesForTravelBeanQuote(text),
    moodTags: moodsForTravelBeanQuote(text),
  })),
];

function lifeQuoteTexts() {
  return [
    { text: 'Life is short; do what you want while you still can.', author: 'Unknown' },
    { text: 'The beauty you see in me is a reflection of you.', author: 'Rumi' },
    { text: 'The most dangerous form of blindness is believing that your perspective is the only reality.', author: 'Friedrich Nietzsche' },
    { text: "If you spend too much time thinking about a thing, you'll never get it done.", author: 'Bruce Lee' },
    { text: 'Before you speak, let your words pass through three gates: Is it true? Is it necessary? Is it kind?', author: 'Rumi' },
    { text: 'If you never take a risk, your life will never change.', author: 'Unknown' },
    { text: "You don't know them and they don't know you, so why are you so concerned with what they think about you?", author: 'Unknown' },
    { text: "If something excites you and you feel intuitively that it's good for you: take the risk. This is the sign you've been waiting for.", author: 'Unknown' },
    { text: 'By believing passionately in something that does not yet exist, we create it.', author: 'Franz Kafka' },
    { text: 'As long as you are alive, you can start over.', author: 'Unknown' },
    { text: 'When it feels scary to jump, that is exactly when you jump. Otherwise, you end up staying in the same place your whole life.', author: 'Abel Morales' },
    { text: "We don't see things as they are, we see them as we are.", author: 'Anais Nin' },
    { text: 'A ship in harbor is safe, but that is not what ships are built for.', author: 'John A. Shedd' },
    { text: 'The present moment is the only moment available to us, and it is the door to all moments.', author: 'Thich Nhat Hanh' },
    { text: 'In order to love yourself, you must behave in ways that you admire.', author: 'Irving Yalom' },
    { text: 'To be happy you must eliminate two things: the fear of a bad future and the memory of a bad past.', author: 'Seneca' },
    { text: "Your normal day is someone's dream, so be thankful every day.", author: 'Unknown' },
    { text: 'Glow differently.', author: 'Unknown' },
    { text: "Not everyone will understand your journey. That's okay. You're here to live your life, not to make everyone understand.", author: 'Unknown' },
    { text: 'Make sure to live.', author: 'Unknown' },
    { text: 'The most creative act is the act of creating yourself.', author: 'Unknown' },
    { text: 'May the calm in you win over the chaos around you.', author: 'Unknown' },
    { text: 'May you live every day of your life.', author: 'Jonathan Swift' },
    { text: 'The privilege of a lifetime is to become who you truly are.', author: 'Carl Jung' },
    { text: "The universe will never give you peace in something you weren't meant to settle in.", author: 'Unknown' },
    { text: "In three words I can sum up everything I've learned about life: it goes on.", author: 'Robert Frost' },
    { text: "Don't forget to look around and appreciate the things that are going right as well.", author: 'Unknown' },
    { text: "It's your road, and yours alone. Others may walk it with you, but no one can walk it for you.", author: 'Rumi' },
    { text: "One day you will wake up and there won't be any more time to do the things you've always wanted. Do it now.", author: 'Paulo Coelho' },
    { text: "Man only likes to count his troubles; he doesn't calculate his happiness.", author: 'Fyodor Dostoevsky' },
    { text: 'To live is the rarest thing in the world. Most people exist, that is all.', author: 'Oscar Wilde' },
    { text: 'In the depth of winter, I finally learned that within me there lay an invincible summer.', author: 'Albert Camus' },
    { text: 'Sometimes you will never know the value of a moment until it becomes a memory.', author: 'Unknown' },
  ] as const;
}

function travelBeanOriginalTexts() {
  return [
  'Wherever you go, become part of the place.',
  'Some roads are answers.',
  'The best views ask for effort.',
  'A new place can change the old story.',
  'Let the map be wrong for once.',
  'Soft skies, open roads.',
  'This moment needed a horizon.',
  'A suitcase full of sunlight.',
  'Go slowly; the world is detailed.',
  'Every border teaches perspective.',
  'The road knows what I need.',
  'I came for the view and stayed for the feeling.',
  'The best souvenirs are changes in perspective.',
  'Travel light, feel deeply.',
  'This is what freedom looks like today.',
  'Found: one quiet corner of the world.',
  'The sky looked different here.',
  'A small road, a large memory.',
  'New streets, old dreams.',
  'I followed the light and found this.',
  'Some places speak before you do.',
  'The world opens when you move.',
  'Postcard weather, real-life feeling.',
  'A little lost, perfectly placed.',
  'The view was worth the silence.',
  'This place feels like a deep breath.',
  'Every journey has a before and after.',
  'I left home and found more of it.',
  'Let the road edit your worries.',
  'Distance makes space for wonder.',
  'Here, even the air feels new.',
  'A good trip changes the shape of your thoughts.',
  'Small bag, big sky.',
  'The best days start without a plan.',
  'A thousand miles of becoming.',
  'The road does not rush.',
  'Let the horizon pull you forward.',
  'Different city, different self.',
  'The world is wider than my worries.',
  'I came here to remember how big life is.',
  'Sunset has a different accent everywhere.',
  'Every place leaves a fingerprint.',
  'The road gave me room to think.',
  'A beautiful view is a kind of reset.',
  'Some places feel like permission.',
  'Clouds, roads, and second chances.',
  'This is my kind of quiet.',
  'The sea remembers no borders.',
  'Mountains make problems look smaller.',
  'The city changed when I walked it.',
  'I took the long way and found more.',
  'Every arrival begins with leaving.',
  'The journey made the photo matter.',
  'A map is only the beginning.',
  'Let the road surprise you.',
  'This place asked me to slow down.',
  'Open roads, open mind.',
  'I found a new colour for peace.',
  'Some views stay behind your eyes.',
  'Here feels far from yesterday.',
  'The best light arrives after the climb.',
  'Wander until the noise gets quiet.',
  'I packed less and noticed more.',
  'This road has its own language.',
  'The horizon is a quiet invitation.',
  'Every journey is a conversation with the unknown.',
  'I went looking for a place and found a feeling.',
  'A new view can soften an old thought.',
  'The world is not small when you walk it.',
  'Some paths are better than plans.',
  'Leave room for the unexpected.',
  'This is where the map became memory.',
  'The farther I went, the lighter I felt.',
  'A place can hold you without knowing your name.',
  'Every road has a mood.',
  'A window seat changes everything.',
  'Miles become memories.',
  'The world rewards curiosity.',
  'Go where the ordinary feels new.',
  'This view made time slow down.',
  'A quiet road can be a loud teacher.',
  'The best places do not need filters.',
  'Here, the day felt bigger.',
  'I found wonder in the detour.',
  'The road is a good listener.',
  'Some skies feel personal.',
  'Every trip teaches a different kind of patience.',
  'I came back with fewer answers and better questions.',
  'Travel turns distance into meaning.',
  'The best places make you forget your phone.',
  'A slow walk is the best guidebook.',
  'The world feels kinder from a train window.',
  'Go far enough to hear yourself clearly.',
  'This moment belongs to the road.',
  'The sun sets differently when you are far from home.',
  'A road trip is a moving conversation.',
  'The landscape said what I could not.',
  'New places make old habits visible.',
  'Every destination begins as a question.',
  'The best view is the one you earned.',
  'Some roads repair what routine breaks.',
  'A new country is a mirror.',
  'This place gave me a better silence.',
  'The journey is the frame; the photo is the proof.',
  'Mountains, mist, and a quiet mind.',
  'A little farther, a little freer.',
  'The road turned ordinary light into magic.',
  'Here, even silence had a view.',
  'I did not escape life; I entered it.',
  'This place made me feel awake.',
  'Every trip begins with a small act of courage.',
  'The world is full of rooms without walls.',
  'I walked into the day and found a story.',
  'The best memories start with why not?',
  'A good horizon can change your mood.',
  'The road gave the day a shape.',
  'Nothing felt urgent under this sky.',
  'Here is where my thoughts finally stretched.',
  'A place becomes yours when you notice it slowly.',
  'Travel is the art of becoming unfamiliar with yourself.',
  'The map ended, but the memory began.',
  'This is the kind of place that stays.',
  'The road was long enough to change me.',
  'A new view is a quiet kind of hope.',
  'Go where your attention comes back to life.',
  'The world is softer when you move through it slowly.',
  'This place turned distance into wonder.',
  'A single road can hold a whole season of your life.',
  'I came home with more sky inside me.',
  ] as const;
}

function categoriesForLifeQuote(text: string, author: string): Exclude<QuoteCategory, 'All'>[] {
  const lower = text.toLowerCase();
  const categories = new Set<Exclude<QuoteCategory, 'All'>>(['Reflection']);
  if (text.length <= 58) categories.add('Short');
  if (author !== 'Unknown') categories.add('Classic');
  if (lower.includes('risk') || lower.includes('jump') || lower.includes('ship') || lower.includes('road')) categories.add('Adventure');
  if (lower.includes('yourself') || lower.includes('perspective') || lower.includes('creating yourself') || lower.includes('truly are')) categories.add('Self-discovery');
  if (lower.includes('moment') || lower.includes('memory') || lower.includes('alive') || lower.includes('live')) categories.add('Wonder');
  if (lower.includes('calm') || lower.includes('happy') || lower.includes('thankful') || lower.includes('peace')) categories.add('Home');
  return Array.from(categories).slice(0, 3);
}

function moodsForLifeQuote(text: string): Array<BeanMood | 'Reflective'> {
  const lower = text.toLowerCase();
  if (lower.includes('risk') || lower.includes('jump') || lower.includes('road') || lower.includes('do it now')) return ['Playful', 'Reflective'];
  if (lower.includes('moment') || lower.includes('ship') || lower.includes('universe') || lower.includes('winter')) return ['Dreamy', 'Reflective'];
  if (lower.includes('calm') || lower.includes('happy') || lower.includes('thankful') || lower.includes('kind')) return ['Cozy', 'Reflective'];
  if (text.length <= 58) return ['Minimal', 'Dreamy'];
  return ['Minimal', 'Reflective'];
}

function categoriesForTravelBeanQuote(text: string): Exclude<QuoteCategory, 'All'>[] {
  const lower = text.toLowerCase();
  if (lower.includes('home')) return ['Home', 'Reflection'];
  if (lower.includes('self') || lower.includes('becoming') || lower.includes('yourself')) return ['Self-discovery', 'Reflection'];
  if (lower.includes('sea') || lower.includes('sky') || lower.includes('mountain') || lower.includes('cloud') || lower.includes('sunset') || lower.includes('horizon') || lower.includes('landscape')) return ['Nature', 'Wonder'];
  if (lower.includes('road') || lower.includes('map') || lower.includes('miles') || lower.includes('trip') || lower.includes('journey')) return ['Adventure', 'Reflection'];
  if (text.length <= 46) return ['Short', 'Wonder'];
  if (lower.includes('place') || lower.includes('world') || lower.includes('city') || lower.includes('country')) return ['Discovery', 'Wonder'];
  return ['Reflection', 'Wonder'];
}

function moodsForTravelBeanQuote(text: string): Array<BeanMood | 'Reflective'> {
  const lower = text.toLowerCase();
  if (lower.includes('quiet') || lower.includes('slow') || lower.includes('soft') || lower.includes('silence')) return ['Cozy', 'Reflective'];
  if (lower.includes('sky') || lower.includes('light') || lower.includes('horizon') || lower.includes('wonder')) return ['Dreamy', 'Reflective'];
  if (lower.includes('road') || lower.includes('map') || lower.includes('farther') || lower.includes('unexpected')) return ['Playful', 'Dreamy'];
  if (lower.includes('home') || lower.includes('feeling') || lower.includes('memory')) return ['Cozy', 'Dreamy'];
  return ['Minimal', 'Reflective'];
}

export function suggestQuotesForMood(mood?: BeanMood | 'Reflective') {
  const moodMatches = TRAVEL_QUOTES.filter(quote => mood && quote.moodTags.includes(mood));
  const source = moodMatches.length >= 3 ? moodMatches : TRAVEL_QUOTES.filter(quote => quote.categories.includes('Short'));
  return source.slice(0, 3);
}

export function quotesForCategory(category: QuoteCategory) {
  if (category === 'All') return TRAVEL_QUOTES;
  return TRAVEL_QUOTES.filter(quote => quote.categories.includes(category));
}
