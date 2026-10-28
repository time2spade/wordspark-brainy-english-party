/**
 * WordSpark Affiliate & Sponsor Monetization Engine
 * Manages verified high-converting affiliate partners (Language, Vocabulary & Learning),
 * automated UTM tracking parameters, custom referral links, local click analytics,
 * and direct advertiser contact channels.
 */

export interface AdSponsor {
  id: string;
  brand: string;
  badge: string;
  headline: string;
  description: string;
  ctaText: string;
  iconBg: string;
  iconEmoji: string;
  rating: string;
  downloads: string;
  accentColor: string;
  tagline: string;
  defaultUrl: string;
  affiliateProgram: string;
  estimatedPayout: string;
  signUpUrl: string;
}

export const SPONSORS: AdSponsor[] = [
  {
    id: 'grammarly_ai',
    brand: 'Grammarly',
    badge: 'High Conversion',
    tagline: 'Smart Writing Assistant',
    headline: 'Never Misspell or Hesitate on Vocabulary Again',
    description: 'Real-time word recommendations, tone adjustments, and clarity scores across all your devices and emails.',
    ctaText: 'Install Free Extension',
    iconBg: 'from-teal-500 to-cyan-600',
    iconEmoji: '✍️',
    rating: '4.9 ★',
    downloads: '50M+ Users',
    accentColor: '#06b6d4',
    defaultUrl: 'https://www.grammarly.com?utm_source=wordspark&utm_medium=affiliate&utm_campaign=noun_rush',
    affiliateProgram: 'Grammarly Affiliate (Impact.com)',
    estimatedPayout: '$0.20 Free Install / $20.00 Premium',
    signUpUrl: 'https://www.grammarly.com/affiliates'
  },
  {
    id: 'duo_english',
    brand: 'Duolingo Max',
    badge: "Editor's Choice",
    tagline: 'AI Language Partner',
    headline: 'Master English Nouns & Grammar in 10 Mins a Day',
    description: 'Learn vocabulary faster with personalized roleplay exercises and instant explanations powered by AI.',
    ctaText: 'Start 14-Day Free Trial',
    iconBg: 'from-emerald-500 to-green-600',
    iconEmoji: '🦉',
    rating: '4.8 ★',
    downloads: '100M+ Downloads',
    accentColor: '#10b981',
    defaultUrl: 'https://www.duolingo.com?utm_source=wordspark&utm_medium=affiliate&utm_campaign=daily_challenge',
    affiliateProgram: 'Duolingo Partner Program',
    estimatedPayout: '$10 - $25 per subscription',
    signUpUrl: 'https://www.duolingo.com'
  },
  {
    id: 'babbel_pro',
    brand: 'Babbel Live',
    badge: 'Top Rated',
    tagline: 'Interactive Live Speaking',
    headline: 'Speak English with Native Tutors in Small Groups',
    description: 'Live interactive classes with certified language teachers. Join anytime from anywhere with zero pressure.',
    ctaText: 'Claim 60% Discount',
    iconBg: 'from-orange-500 to-amber-600',
    iconEmoji: '🗣️',
    rating: '4.8 ★',
    downloads: '10M+ Learners',
    accentColor: '#f59e0b',
    defaultUrl: 'https://www.babbel.com?utm_source=wordspark&utm_medium=affiliate&utm_campaign=vocabulary_sprint',
    affiliateProgram: 'Babbel Affiliate (CJ Affiliate / Awin)',
    estimatedPayout: '$32.00 - $65.00 per paid student',
    signUpUrl: 'https://www.babbel.com/affiliate'
  },
  {
    id: 'elevate_brain',
    brand: 'Elevate Brain Games',
    badge: 'App of the Year',
    tagline: 'Cognitive Brain Training',
    headline: 'Sharpen Word Recall, Focus & Mental Math',
    description: '35+ science-backed mini games designed to expand vocabulary, memory retention, and quick decision-making.',
    ctaText: 'Play Free Daily Workout',
    iconBg: 'from-indigo-500 to-purple-600',
    iconEmoji: '🧠',
    rating: '4.7 ★',
    downloads: '30M+ Brains Trained',
    accentColor: '#8b5cf6',
    defaultUrl: 'https://www.elevateapp.com?utm_source=wordspark&utm_medium=affiliate&utm_campaign=brain_rush',
    affiliateProgram: 'Elevate Referral Program',
    estimatedPayout: '$15.00 per annual member',
    signUpUrl: 'https://www.elevateapp.com'
  },
  {
    id: 'coursera_english',
    brand: 'Coursera English',
    badge: 'Certified',
    tagline: 'University English Certifications',
    headline: 'Earn English Grammar & Writing Credentials',
    description: 'Courses from University of Pennsylvania, UC Irvine, and Macquarie with accredited certificates.',
    ctaText: 'Explore Free Courses',
    iconBg: 'from-blue-600 to-indigo-700',
    iconEmoji: '🎓',
    rating: '4.9 ★',
    downloads: '120M+ Students',
    accentColor: '#3b82f6',
    defaultUrl: 'https://www.coursera.org/specializations/learn-english?utm_source=wordspark&utm_medium=affiliate',
    affiliateProgram: 'Coursera Affiliate (Impact.com)',
    estimatedPayout: '15% - 45% commission per sale',
    signUpUrl: 'https://www.coursera.org/about/affiliates'
  }
];

const AFFILIATE_KEY_PREFIX = 'wordspark_affiliate_';
const AFFILIATE_CLICKS_KEY = 'wordspark_affiliate_clicks';
const SPONSORS_ENABLED_KEY = 'wordspark_sponsors_enabled';
const SPONSOR_EMAIL_KEY = 'wordspark_sponsor_email';

export const DEFAULT_SPONSOR_EMAIL = 'T2Spade@gmail.com';

/**
 * Returns whether active sponsor ads are enabled.
 * Defaults to false until the owner enables it or adds custom affiliate links.
 */
export function hasActiveSponsors(): boolean {
  try {
    const setting = localStorage.getItem(SPONSORS_ENABLED_KEY);
    if (setting !== null) {
      return setting === 'true';
    }
    // Also check if any custom affiliate link was set
    const hasAnyCustom = SPONSORS.some(s => {
      const custom = localStorage.getItem(`${AFFILIATE_KEY_PREFIX}${s.id}`);
      return custom && custom.trim().length > 0;
    });
    return hasAnyCustom;
  } catch (e) {
    return false;
  }
}

/**
 * Enables or disables sponsor ads display.
 */
export function setSponsorsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SPONSORS_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (e) {}
}

/**
 * Retrieves the contact email for sponsor inquiries.
 */
export function getSponsorContactEmail(): string {
  try {
    return localStorage.getItem(SPONSOR_EMAIL_KEY) || DEFAULT_SPONSOR_EMAIL;
  } catch (e) {
    return DEFAULT_SPONSOR_EMAIL;
  }
}

/**
 * Sets the contact email for sponsor inquiries.
 */
export function setSponsorContactEmail(email: string): void {
  try {
    if (!email || email.trim().length === 0) {
      localStorage.removeItem(SPONSOR_EMAIL_KEY);
    } else {
      localStorage.setItem(SPONSOR_EMAIL_KEY, email.trim());
    }
  } catch (e) {}
}

/**
 * Returns the effective affiliate tracking URL:
 * Checks for a custom user-defined affiliate link first, otherwise returns defaultUrl with UTM tracking.
 */
export function getAffiliateUrl(sponsorId: string): string {
  try {
    const custom = localStorage.getItem(`${AFFILIATE_KEY_PREFIX}${sponsorId}`);
    if (custom && custom.trim().length > 0) {
      return custom.trim();
    }
  } catch (e) {}

  const sponsor = SPONSORS.find(s => s.id === sponsorId);
  return sponsor ? sponsor.defaultUrl : 'https://www.grammarly.com';
}

/**
 * Returns the stored custom affiliate URL if set, or empty string.
 */
export function getStoredAffiliateUrl(sponsorId: string): string {
  try {
    return localStorage.getItem(`${AFFILIATE_KEY_PREFIX}${sponsorId}`) || '';
  } catch (e) {
    return '';
  }
}

/**
 * Saves a custom affiliate link provided by the app administrator/owner.
 */
export function setAffiliateUrl(sponsorId: string, customUrl: string): void {
  try {
    if (!customUrl || customUrl.trim().length === 0) {
      localStorage.removeItem(`${AFFILIATE_KEY_PREFIX}${sponsorId}`);
    } else {
      localStorage.setItem(`${AFFILIATE_KEY_PREFIX}${sponsorId}`, customUrl.trim());
    }
  } catch (e) {}
}

/**
 * Tracks click conversions locally so the site owner can see exact performance.
 */
export function trackAffiliateClick(sponsorId: string): void {
  try {
    const raw = localStorage.getItem(AFFILIATE_CLICKS_KEY);
    const clicks: Record<string, number> = raw ? JSON.parse(raw) : {};
    clicks[sponsorId] = (clicks[sponsorId] || 0) + 1;
    clicks['_total'] = (clicks['_total'] || 0) + 1;
    localStorage.setItem(AFFILIATE_CLICKS_KEY, JSON.stringify(clicks));
  } catch (e) {}
}

/**
 * Retrieves click analytics for all affiliate partners.
 */
export function getAffiliateClicks(): Record<string, number> {
  try {
    const raw = localStorage.getItem(AFFILIATE_CLICKS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {}
  return {};
}

/**
 * Resets click tracking statistics.
 */
export function resetAffiliateClicks(): void {
  try {
    localStorage.removeItem(AFFILIATE_CLICKS_KEY);
  } catch (e) {}
}
