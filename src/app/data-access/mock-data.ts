import type { Category, Product } from '../models/product.model';

const img = (id: string, w = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

// Initial business categories for the Marsa Alam / Hurghada storefront.
// Stable ids/slugs are the permanent identifiers; display names are
// dashboard-managed localized data (see LocalizedText). The storefront never
// hardcodes these two categories into navigation or filters — everything
// renders from ProductService.categories().
export const MOCK_CATEGORIES: Category[] = [
  {
    id: 'cosmetics',
    name: 'Cosmetics',
    names: {
      en: 'Cosmetics',
      ar: 'مستحضرات التجميل',
      cs: 'Kosmetika',
      it: 'Cosmetici',
      pl: 'Kosmetyki',
      fr: 'Cosmétiques',
      sk: 'Kozmetika',
      de: 'Kosmetik',
    },
    description: 'Skincare, haircare and personal care essentials with natural ingredients.',
    descriptions: {
      en: 'Skincare, haircare and personal care essentials with natural ingredients.',
      ar: 'أساسيات العناية بالبشرة والشعر والعناية الشخصية بمكونات طبيعية.',
      cs: 'Základní péče o pleť, vlasy a tělo s přírodními složkami.',
      it: 'Cura di viso, capelli e corpo con ingredienti naturali.',
      pl: 'Pielęgnacja skóry, włosów i ciała z naturalnymi składnikami.',
      fr: 'Soins visage, cheveux et corps aux ingrédients naturels.',
      sk: 'Starostlivosť o pleť, vlasy a telo s prírodnými zložkami.',
      de: 'Haut-, Haar- und Körperpflege mit natürlichen Inhaltsstoffen.',
    },
    image: img('photo-1596462502278-27bfdc403348'),
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 'herbs',
    name: 'Herbs',
    names: {
      en: 'Herbs',
      ar: 'أعشاب',
      cs: 'Byliny',
      it: 'Erbe',
      pl: 'Zioła',
      fr: 'Herbes',
      sk: 'Bylinky',
      de: 'Kräuter',
    },
    description: 'Single-origin herbs and balanced herbal blends for everyday infusions.',
    descriptions: {
      en: 'Single-origin herbs and balanced herbal blends for everyday infusions.',
      ar: 'أعشاب مختارة وخلطات عشبية متوازنة للاستخدام اليومي.',
      cs: 'Vybrané byliny a vyvážené bylinné směsi pro každodenní popíjení.',
      it: 'Erbe selezionate e miscele equilibrate per l’uso quotidiano.',
      pl: 'Wybrane zioła i zbalansowane mieszanki na co dzień.',
      fr: 'Herbes sélectionnées et mélanges équilibrés pour le quotidien.',
      sk: 'Vybrané bylinky a vyvážené bylinné zmesi na každý deň.',
      de: 'Ausgewählte Kräuter und ausgewogene Kräutermischungen für jeden Tag.',
    },
    image: img('photo-1596040033229-a9821ebd058d'),
    sortOrder: 2,
    isActive: true,
  },
];

interface Seed {
  id: string;
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  price: number;
  salePrice?: number;
  images: string[];
  rating: number;
  reviewsCount: number;
  soldCount: number;
  stock: number;
  isNew: boolean;
  isFeatured: boolean;
  isPopular: boolean;
  tags: string[];
  attributes: { name: string; value: string }[];
  variants?: { id: string; name: string; options: string[] }[];
  createdAt: string;
}

// Sample catalog. Descriptions are neutral product facts only: no medical or
// therapeutic claims anywhere (herbs are described by taste, use and origin).
const SEEDS: Seed[] = [
  // ------------------------------- Cosmetics -------------------------------
  {
    id: 'argan-oil',
    sku: 'COS-1001',
    name: 'Cold-Pressed Argan Oil 100ml',
    description:
      'Fragrance-free argan oil for daily skin and hair care routines. Lightweight texture, glass bottle with dropper.',
    categoryId: 'cosmetics',
    price: 24,
    salePrice: 19,
    images: [img('photo-1526947425960-945c6e72858f'), img('photo-1556228720-195a672e8a03'), img('photo-1570172619644-dfd03ed5d881')],
    rating: 4.8, reviewsCount: 1830, soldCount: 14200, stock: 46,
    isNew: false, isFeatured: true, isPopular: true,
    tags: ['skincare', 'haircare', 'bestseller'],
    attributes: [
      { name: 'Volume', value: '100 ml' },
      { name: 'Type', value: 'Cold-pressed, fragrance-free' },
      { name: 'Packaging', value: 'Glass bottle with dropper' },
    ],
    variants: [{ id: 'size', name: 'Size', options: ['50 ml', '100 ml'] }],
    createdAt: '2026-06-02T10:00:00Z',
  },
  {
    id: 'shea-body-butter',
    sku: 'COS-1002',
    name: 'Raw Shea Body Butter 200ml',
    description:
      'Rich unrefined shea butter whipped for daily body care. Light vanilla scent from natural ingredients only.',
    categoryId: 'cosmetics',
    price: 18, salePrice: 14,
    images: [img('photo-1570172619644-dfd03ed5d881'), img('photo-1556228453-efd6c1ff04f6'), img('photo-1608248543803-ba4f8c70ae0b')],
    rating: 4.7, reviewsCount: 1240, soldCount: 9800, stock: 38,
    isNew: false, isFeatured: true, isPopular: true,
    tags: ['skincare', 'personal-care'],
    attributes: [
      { name: 'Volume', value: '200 ml' },
      { name: 'Type', value: 'Unrefined shea butter' },
    ],
    createdAt: '2026-04-14T10:00:00Z',
  },
  {
    id: 'black-seed-oil',
    sku: 'COS-1003',
    name: 'Black Seed Oil 60ml',
    description:
      'Cold-pressed black seed (nigella) oil for skin and hair care routines. Dark glass bottle to protect freshness.',
    categoryId: 'cosmetics',
    price: 21,
    images: [img('photo-1616394584738-fc6e612e71b9'), img('photo-1617897903246-719242e9d9d7'), img('photo-1526947425960-945c6e72858f')],
    rating: 4.6, reviewsCount: 860, soldCount: 6400, stock: 29,
    isNew: true, isFeatured: false, isPopular: true,
    tags: ['skincare', 'haircare'],
    attributes: [
      { name: 'Volume', value: '60 ml' },
      { name: 'Type', value: 'Cold-pressed nigella oil' },
    ],
    createdAt: '2026-09-12T10:00:00Z',
  },
  {
    id: 'aloe-vera-gel',
    sku: 'COS-1004',
    name: 'Pure Aloe Vera Gel 250ml',
    description:
      'Clear aloe vera gel for face and body care after sun exposure. Fast-absorbing, non-sticky formula.',
    categoryId: 'cosmetics',
    price: 12, salePrice: 9,
    images: [img('photo-1509423350716-97f9360b4e09'), img('photo-1596541223130-5d31a73a2c40'), img('photo-1584305574647-0cc949a2bb9f')],
    rating: 4.5, reviewsCount: 2110, soldCount: 16800, stock: 64,
    isNew: false, isFeatured: true, isPopular: true,
    tags: ['skincare', 'personal-care', 'bestseller'],
    attributes: [{ name: 'Volume', value: '250 ml' }],
    createdAt: '2026-03-18T10:00:00Z',
  },
  {
    id: 'rose-water-toner',
    sku: 'COS-1005',
    name: 'Rose Water Facial Toner 200ml',
    description:
      'Distilled rose water facial mist for daily skincare routines. Fine spray bottle, travel friendly.',
    categoryId: 'cosmetics',
    price: 14,
    images: [img('photo-1594035910387-fea47794261f'), img('photo-1571781926291-c477ebfd024b'), img('photo-1556229010-6c3f2c9ca5f8')],
    rating: 4.6, reviewsCount: 720, soldCount: 5300, stock: 41,
    isNew: true, isFeatured: false, isPopular: false,
    tags: ['skincare', 'beauty'],
    attributes: [{ name: 'Volume', value: '200 ml' }],
    createdAt: '2026-08-20T10:00:00Z',
  },
  {
    id: 'sea-salt-scrub',
    sku: 'COS-1006',
    name: 'Sea Salt & Citrus Body Scrub 300g',
    description:
      'Red Sea salt body scrub with citrus peel and plant oils. Resealable jar for shower routines.',
    categoryId: 'cosmetics',
    price: 16, salePrice: 12,
    images: [img('photo-1570194065650-d99fb4bedf0a'), img('photo-1600857544200-b2f7666c1707'), img('photo-1608571423902-eed4a5ad8108')],
    rating: 4.7, reviewsCount: 540, soldCount: 4100, stock: 33,
    isNew: false, isFeatured: false, isPopular: true,
    tags: ['personal-care', 'skincare'],
    attributes: [{ name: 'Weight', value: '300 g' }],
    variants: [{ id: 'scent', name: 'Scent', options: ['Citrus', 'Lavender', 'Unscented'] }],
    createdAt: '2026-05-01T10:00:00Z',
  },
  {
    id: 'clay-face-mask',
    sku: 'COS-1007',
    name: 'Natural Clay Face Mask 150g',
    description:
      'Mineral clay powder mask to mix with water or rose water. Makes around 15 applications per jar.',
    categoryId: 'cosmetics',
    price: 13,
    images: [img('photo-1596755389378-c31d21fd1273'), img('photo-1631729371254-42c2892f0e6e'), img('photo-1570172619644-dfd03ed5d881')],
    rating: 4.5, reviewsCount: 480, soldCount: 3600, stock: 27,
    isNew: false, isFeatured: false, isPopular: false,
    tags: ['skincare', 'beauty'],
    attributes: [{ name: 'Weight', value: '150 g' }],
    createdAt: '2026-02-11T10:00:00Z',
  },
  {
    id: 'henna-powder',
    sku: 'COS-1008',
    name: 'Natural Henna Powder 200g',
    description:
      'Finely sifted henna powder for hair care and traditional body art. Sealed pack preserves color strength.',
    categoryId: 'cosmetics',
    price: 9,
    images: [img('photo-1601049676869-702ea24cfd58'), img('photo-1519415943484-9fa1873496d4'), img('photo-1522337660859-02fbefca4702')],
    rating: 4.6, reviewsCount: 690, soldCount: 7200, stock: 52,
    isNew: false, isFeatured: false, isPopular: true,
    tags: ['haircare', 'beauty'],
    attributes: [{ name: 'Weight', value: '200 g' }],
    createdAt: '2026-01-30T10:00:00Z',
  },
  {
    id: 'kohl-eyeliner',
    sku: 'COS-1009',
    name: 'Traditional Kohl Eyeliner',
    description:
      'Classic kohl eyeliner stick in a travel case. Deep black matte finish for everyday makeup routines.',
    categoryId: 'cosmetics',
    price: 7, salePrice: 5,
    images: [img('photo-1512496015851-a90fb38ba796'), img('photo-1596462502278-27bfdc403348'), img('photo-1522335789203-aabd1fc54bc9')],
    rating: 4.4, reviewsCount: 1120, soldCount: 9400, stock: 4,
    isNew: false, isFeatured: true, isPopular: false,
    tags: ['beauty'],
    attributes: [{ name: 'Finish', value: 'Matte black' }],
    createdAt: '2026-07-11T10:00:00Z',
  },
  {
    id: 'musk-perfume-oil',
    sku: 'COS-1010',
    name: 'Alcohol-Free Musk Perfume Oil 12ml',
    description:
      'Concentrated alcohol-free perfume oil in a roll-on bottle. A small amount lasts through the day.',
    categoryId: 'cosmetics',
    price: 19,
    images: [img('photo-1541643600914-78b084683601'), img('photo-1592945403244-b3fbafd7f539'), img('photo-1594035910387-fea47794261f')],
    rating: 4.8, reviewsCount: 640, soldCount: 4800, stock: 24,
    isNew: true, isFeatured: true, isPopular: false,
    tags: ['beauty', 'personal-care'],
    attributes: [{ name: 'Volume', value: '12 ml' }],
    variants: [{ id: 'scent', name: 'Scent', options: ['White Musk', 'Amber', 'Rose Musk'] }],
    createdAt: '2026-09-20T10:00:00Z',
  },
  {
    id: 'hibiscus-soap',
    sku: 'COS-1011',
    name: 'Handmade Hibiscus Soap Bar 120g',
    description:
      'Cold-process soap bar with hibiscus petals and plant oils. Wrapped, palm-sized bar for daily use.',
    categoryId: 'cosmetics',
    price: 6,
    images: [img('photo-1600857544200-b2f7666c1707'), img('photo-1585232004423-244e0e6904e3'), img('photo-1570194065650-d99fb4bedf0a')],
    rating: 4.5, reviewsCount: 380, soldCount: 3100, stock: 0,
    isNew: false, isFeatured: false, isPopular: false,
    tags: ['personal-care'],
    attributes: [{ name: 'Weight', value: '120 g' }],
    createdAt: '2026-02-20T10:00:00Z',
  },
  {
    id: 'coconut-hair-mask',
    sku: 'COS-1012',
    name: 'Coconut Hair Mask 250ml',
    description:
      'Creamy coconut hair mask for weekly hair care routines. Rinse-out formula in a wide-mouth jar.',
    categoryId: 'cosmetics',
    price: 17, salePrice: 13,
    images: [img('photo-1526947425960-945c6e72858f'), img('photo-1631729371254-42c2892f0e6e'), img('photo-1556228720-195a672e8a03')],
    rating: 4.6, reviewsCount: 590, soldCount: 4700, stock: 31,
    isNew: false, isFeatured: false, isPopular: true,
    tags: ['haircare'],
    attributes: [{ name: 'Volume', value: '250 ml' }],
    createdAt: '2026-07-02T10:00:00Z',
  },
  // --------------------------------- Herbs ---------------------------------
  {
    id: 'karkadeh-hibiscus',
    sku: 'HER-2001',
    name: 'Dried Hibiscus Flowers (Karkadeh) 250g',
    description:
      'Whole dried hibiscus calyces from Upper Egypt. Brews a ruby-red infusion, enjoyed hot or chilled.',
    categoryId: 'herbs',
    price: 11, salePrice: 9,
    images: [img('photo-1564890369478-c89ca6d9cde9'), img('photo-1544787219-7f47ccb76574'), img('photo-1563822249366-3efb23b8e0c9')],
    rating: 4.9, reviewsCount: 1980, soldCount: 18600, stock: 73,
    isNew: false, isFeatured: true, isPopular: true,
    tags: ['single-herb', 'infusion', 'bestseller'],
    attributes: [
      { name: 'Weight', value: '250 g' },
      { name: 'Form', value: 'Whole dried calyces' },
    ],
    variants: [{ id: 'weight', name: 'Weight', options: ['100 g', '250 g', '500 g'] }],
    createdAt: '2026-05-30T10:00:00Z',
  },
  {
    id: 'chamomile-flowers',
    sku: 'HER-2002',
    name: 'Whole Chamomile Flowers 100g',
    description:
      'Hand-picked whole chamomile flower heads with a mild apple-like aroma. A gentle infusion for any time of day.',
    categoryId: 'herbs',
    price: 9,
    images: [img('photo-1563822249366-3efb23b8e0c9'), img('photo-1544787219-7f47ccb76574'), img('photo-1512069772995-ec65ed45afd6')],
    rating: 4.7, reviewsCount: 840, soldCount: 7900, stock: 48,
    isNew: false, isFeatured: true, isPopular: true,
    tags: ['single-herb', 'infusion'],
    attributes: [{ name: 'Weight', value: '100 g' }],
    variants: [{ id: 'weight', name: 'Weight', options: ['50 g', '100 g', '250 g'] }],
    createdAt: '2026-04-05T10:00:00Z',
  },
  {
    id: 'peppermint-leaves',
    sku: 'HER-2003',
    name: 'Dried Peppermint Leaves 100g',
    description:
      'Cut peppermint leaves with a fresh cooling aroma. Brews a clear, bright infusion in minutes.',
    categoryId: 'herbs',
    price: 7, salePrice: 6,
    images: [img('photo-1506368249639-73a05d6f6488'), img('photo-1466637574441-749b8f19452f'), img('photo-1544787219-7f47ccb76574')],
    rating: 4.6, reviewsCount: 720, soldCount: 6800, stock: 55,
    isNew: false, isFeatured: false, isPopular: true,
    tags: ['single-herb', 'infusion'],
    attributes: [{ name: 'Weight', value: '100 g' }],
    createdAt: '2026-06-25T10:00:00Z',
  },
  {
    id: 'green-anise',
    sku: 'HER-2004',
    name: 'Green Anise Seeds 150g',
    description:
      'Whole green anise seeds with a sweet, mild liquorice-like aroma. Used in baking and brewed as infusion.',
    categoryId: 'herbs',
    price: 8,
    images: [img('photo-1596040033229-a9821ebd058d'), img('photo-1509358271058-acd22cc93898'), img('photo-1466637574441-749b8f19452f')],
    rating: 4.5, reviewsCount: 410, soldCount: 3900, stock: 36,
    isNew: false, isFeatured: false, isPopular: false,
    tags: ['single-herb', 'culinary'],
    attributes: [{ name: 'Weight', value: '150 g' }],
    createdAt: '2026-06-18T10:00:00Z',
  },
  {
    id: 'fennel-seeds',
    sku: 'HER-2005',
    name: 'Fennel Seeds 150g',
    description:
      'Whole fennel seeds for cooking and baking, also brewed as a mild sweet infusion.',
    categoryId: 'herbs',
    price: 8,
    images: [img('photo-1509358271058-acd22cc93898'), img('photo-1596040033229-a9821ebd058d'), img('photo-1466637574441-749b8f19452f')],
    rating: 4.5, reviewsCount: 350, soldCount: 3200, stock: 42,
    isNew: false, isFeatured: false, isPopular: false,
    tags: ['single-herb', 'culinary'],
    attributes: [{ name: 'Weight', value: '150 g' }],
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'wild-thyme',
    sku: 'HER-2006',
    name: 'Wild Thyme 100g',
    description:
      'Dried wild thyme for the kitchen and the teapot. Strong herbal aroma, sealed pack keeps it fresh.',
    categoryId: 'herbs',
    price: 10, salePrice: 8,
    images: [img('photo-1466637574441-749b8f19452f'), img('photo-1506368249639-73a05d6f6488'), img('photo-1596040033229-a9821ebd058d')],
    rating: 4.7, reviewsCount: 620, soldCount: 5600, stock: 39,
    isNew: true, isFeatured: true, isPopular: false,
    tags: ['single-herb', 'culinary', 'infusion'],
    attributes: [{ name: 'Weight', value: '100 g' }],
    createdAt: '2026-09-28T10:00:00Z',
  },
  {
    id: 'sage-leaves',
    sku: 'HER-2007',
    name: 'Dried Sage Leaves 80g',
    description:
      'Whole dried sage leaves for cooking and herbal infusions. Earthy aroma, resealable pack.',
    categoryId: 'herbs',
    price: 9,
    images: [img('photo-1515586000433-45406d8e6662'), img('photo-1466692476868-aef1dfb1e735'), img('photo-1509423350716-97f9360b4e09')],
    rating: 4.6, reviewsCount: 440, soldCount: 3800, stock: 26,
    isNew: false, isFeatured: false, isPopular: false,
    tags: ['single-herb', 'culinary', 'infusion'],
    attributes: [{ name: 'Weight', value: '80 g' }],
    createdAt: '2026-07-25T10:00:00Z',
  },
  {
    id: 'sweet-marjoram',
    sku: 'HER-2008',
    name: 'Sweet Marjoram 80g',
    description:
      'Dried sweet marjoram for Mediterranean cooking and mild herbal infusions.',
    categoryId: 'herbs',
    price: 9,
    images: [img('photo-1466692476868-aef1dfb1e735'), img('photo-1515586000433-45406d8e6662'), img('photo-1506368249639-73a05d6f6488')],
    rating: 4.5, reviewsCount: 310, soldCount: 2700, stock: 23,
    isNew: false, isFeatured: false, isPopular: false,
    tags: ['single-herb', 'culinary'],
    attributes: [{ name: 'Weight', value: '80 g' }],
    createdAt: '2026-05-22T10:00:00Z',
  },
  {
    id: 'lemongrass',
    sku: 'HER-2009',
    name: 'Dried Lemongrass 100g',
    description:
      'Cut dried lemongrass stalks with a bright citrus aroma. Brews a golden infusion, hot or chilled.',
    categoryId: 'herbs',
    price: 10, salePrice: 8,
    images: [img('photo-1544787219-7f47ccb76574'), img('photo-1564890369478-c89ca6d9cde9'), img('photo-1512069772995-ec65ed45afd6')],
    rating: 4.7, reviewsCount: 580, soldCount: 5100, stock: 34,
    isNew: true, isFeatured: false, isPopular: true,
    tags: ['single-herb', 'infusion'],
    attributes: [{ name: 'Weight', value: '100 g' }],
    createdAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'bedouin-blend',
    sku: 'HER-2010',
    name: 'Bedouin Desert Herbal Blend 150g',
    description:
      'A balanced mix of sage, thyme and marjoram in the style of Sinai desert blends. Brews a hearty amber infusion.',
    categoryId: 'herbs',
    price: 14,
    images: [img('photo-1587080413959-06b859fb107d'), img('photo-1544787219-7f47ccb76574'), img('photo-1512675828443-4f454c42253a')],
    rating: 4.8, reviewsCount: 470, soldCount: 3900, stock: 21,
    isNew: true, isFeatured: true, isPopular: false,
    tags: ['blend', 'infusion'],
    attributes: [
      { name: 'Weight', value: '150 g' },
      { name: 'Mix', value: 'Sage, thyme, marjoram' },
    ],
    createdAt: '2026-09-08T10:00:00Z',
  },
  {
    id: 'red-sea-blend',
    sku: 'HER-2011',
    name: 'Red Sea Herbal Blend 150g',
    description:
      'Chamomile, lemongrass and hibiscus petals in one balanced everyday infusion mix.',
    categoryId: 'herbs',
    price: 15, salePrice: 12,
    images: [img('photo-1512675828443-4f454c42253a'), img('photo-1587080413959-06b859fb107d'), img('photo-1564890369478-c89ca6d9cde9')],
    rating: 4.8, reviewsCount: 520, soldCount: 4300, stock: 28,
    isNew: false, isFeatured: true, isPopular: true,
    tags: ['blend', 'infusion'],
    attributes: [
      { name: 'Weight', value: '150 g' },
      { name: 'Mix', value: 'Chamomile, lemongrass, hibiscus' },
    ],
    createdAt: '2026-07-02T10:00:00Z',
  },
  {
    id: 'cinnamon-sticks',
    sku: 'HER-2012',
    name: 'Cinnamon Sticks 100g',
    description:
      'Whole cinnamon quills for desserts, hot drinks and spiced infusions. Warm sweet aroma.',
    categoryId: 'herbs',
    price: 12,
    images: [img('photo-1587132137056-bfbf0166836e'), img('photo-1596040033229-a9821ebd058d'), img('photo-1509358271058-acd22cc93898')],
    rating: 4.7, reviewsCount: 660, soldCount: 5900, stock: 44,
    isNew: false, isFeatured: false, isPopular: true,
    tags: ['single-herb', 'culinary'],
    attributes: [{ name: 'Weight', value: '100 g' }],
    createdAt: '2026-08-05T10:00:00Z',
  },
];

export const MOCK_PRODUCTS: Product[] = SEEDS.map((s) => ({ ...s }));

export const MAX_CATALOG_PRICE = Math.max(...MOCK_PRODUCTS.map((p) => p.price));
