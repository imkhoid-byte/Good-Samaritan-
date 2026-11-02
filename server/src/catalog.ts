// Static catalogs: shop products, partner charities, loss-prevention tips.
// Kept in code (not the DB) because they change with releases, not with users.

export interface Product {
  id: string;
  name: string;
  description: string;
  material: string;
  priceCents: number;
  tagsIncluded: number;
  icon: string;
}

export const PRODUCTS: Product[] = [
  {
    id: 'keychain-6',
    name: 'Keychain Tag Starter Pack',
    description: 'Six slim keychain tags for keys, bags and zipper pulls.',
    material: '100% ocean-recovered plastic',
    priceCents: 1499,
    tagsIncluded: 6,
    icon: '🔑'
  },
  {
    id: 'stickers-12',
    name: 'Everyday Sticker Sheet',
    description: 'Twelve weatherproof stickers for laptops, phones, bottles and gear.',
    material: 'PVC-free compostable film',
    priceCents: 799,
    tagsIncluded: 12,
    icon: '🏷️'
  },
  {
    id: 'luggage-1',
    name: 'Cork Luggage Tag',
    description: 'A sturdy travel tag with a leather-free strap. QR on one side, your note on the other.',
    material: 'Natural cork & hemp strap',
    priceCents: 1299,
    tagsIncluded: 1,
    icon: '🧳'
  },
  {
    id: 'pet-1',
    name: 'Pet Collar Tag',
    description: 'Engraved QR tag that stays readable after years of muddy adventures.',
    material: 'Recycled aluminium',
    priceCents: 999,
    tagsIncluded: 1,
    icon: '🐾'
  },
  {
    id: 'family-bundle',
    name: 'Family Bundle',
    description: 'Two starter packs, a sticker sheet, two luggage tags and a pet tag.',
    material: 'Mixed sustainable materials',
    priceCents: 5999,
    tagsIncluded: 27,
    icon: '🏡'
  }
];

export const SHIPPING_CENTS = 399;
export const FREE_SHIPPING_OVER_CENTS = 2500;
export const PREMIUM_DISCOUNT = 0.15;
export const PREMIUM_PRICE_CENTS = 499;

export interface Charity {
  id: string;
  name: string;
  cause: string;
  icon: string;
}

export const CHARITIES: Charity[] = [
  { id: 'trees', name: 'Reforest Together', cause: 'Plants native trees in deforested regions', icon: '🌳' },
  { id: 'meals', name: 'Community Food Share', cause: 'Funds meals at local food banks', icon: '🍲' },
  { id: 'oceans', name: 'Clean Coasts Fund', cause: 'Removes plastic from beaches and rivers', icon: '🌊' },
  { id: 'literacy', name: 'Books for Every Child', cause: 'Puts books in under-resourced classrooms', icon: '📚' },
  { id: 'shelter', name: 'Safe Paws Shelter Network', cause: 'Rescues and rehomes lost and stray animals', icon: '🐶' }
];

export function charityById(id: string): Charity | undefined {
  return CHARITIES.find(c => c.id === id);
}

// Points redeem at 100 points = $1.00 donated. Donations are funded from the
// sponsor pool (corporate partners), not from the user.
export const POINTS_PER_DOLLAR = 100;
export const MIN_DONATION_POINTS = 100;
// When a finder reports an item, the platform donates this much to the
// charity they choose, once per finder per item.
export const FINDER_MATCH_CENTS = 100;

export interface Tip {
  category: string; // item category, or 'general'
  title: string;
  body: string;
}

export const TIPS: Tip[] = [
  { category: 'general', title: 'Do a "phone, wallet, keys" pat-down', body: 'Build a habit of checking your three essentials every time you stand up to leave a seat, taxi or table.' },
  { category: 'general', title: 'Give everything a home', body: 'Use one bowl or hook by the door for items you carry daily. Most "lost" items are just misplaced at home.' },
  { category: 'general', title: 'Mark items lost quickly', body: 'Switch an item to "Lost" in your dashboard as soon as you notice. Finders who scan see that it is actively missed.' },
  { category: 'keys', title: 'Use a bright keyring', body: 'Bright colours are spotted more easily on dark floors, car seats and grass.' },
  { category: 'keys', title: 'Keep a spare with someone you trust', body: 'A spare key with a neighbour turns a lockout into a short walk.' },
  { category: 'wallet', title: 'Photograph your cards', body: 'Keep a secure note of card issuers and their lost-card numbers so you can freeze them in minutes.' },
  { category: 'wallet', title: 'Front pocket in crowds', body: 'Move your wallet to a front pocket or zipped bag on transit and at events.' },
  { category: 'bag', title: 'Put the tag inside and outside', body: 'An outside tag gets scanned; an inside sticker survives if the outer tag is torn off.' },
  { category: 'bag', title: 'Never hang bags on chair backs', body: 'Loop a strap around your leg or chair leg in cafés and restaurants.' },
  { category: 'phone', title: 'Add an emergency contact to your lock screen', body: 'Most phones can show a contact or message without unlocking. Add a sticker tag to the case too.' },
  { category: 'phone', title: 'Turn on device location', body: 'Enable your phone maker\'s find-my-device feature before you need it.' },
  { category: 'laptop', title: 'Tag the charger too', body: 'Chargers are left behind more often than laptops and are expensive to replace.' },
  { category: 'laptop', title: 'Airport security tray check', body: 'Count your trays going in and coming out. Security checkpoints are the top spot for lost laptops.' },
  { category: 'jewelry', title: 'Use a dedicated travel pouch', body: 'Take jewellery off into one zipped pouch, never onto a sink or bedside table in hotels.' },
  { category: 'glasses', title: 'Tag the case, not the frames', body: 'A sticker on the case gets your glasses home without marking the frames.' },
  { category: 'pet', title: 'Keep the collar tag up to date', body: 'A QR collar tag lets anyone reach you instantly, even without a microchip scanner.' },
  { category: 'other', title: 'Photograph valuables with their tag', body: 'A photo showing the item and its tag makes it easy to prove ownership when it is handed in.' },
  { category: 'other', title: 'Write a short description', body: 'Distinctive marks and colours in the item description help venue staff match it to you.' },
  { category: 'pet', title: 'Have a recent photo ready', body: 'Keep a clear, recent photo of your pet for local lost-pet groups and shelters.' }
];
