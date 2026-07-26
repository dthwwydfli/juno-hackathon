import type { LandingIconName } from './LandingIcon';

export type StoryChapter = {
  id: string;
  title: string;
  body: string;
  image: string;
  imageLabel: string;
  icon: LandingIconName;
};

export const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: 'intro',
    title: 'Every medicine and supplement, in one pocket.',
    body:
      'Bring your NHS, private and over-the-counter medicines together, get a heads-up on potential interactions, and share a clear summary with your GP.',
    image: '/landing/v5-home-light.png',
    imageLabel: 'Home screen showing your medicine list',
    icon: 'capsule',
  },
  {
    id: 'connect',
    title: 'Connect your NHS record',
    body: 'Pull in prescriptions automatically, then add private and OTC medicines yourself.',
    image: '/landing/v5-nhs-light.png',
    imageLabel: 'NHS connection screen',
    icon: 'shield',
  },
  {
    id: 'cabinet',
    title: 'Build your full list',
    body: 'Add private and over-the-counter medicines, scan barcodes where available, and archive old courses.',
    image: '/landing/v5-add-light.png',
    imageLabel: 'Add medicine screen',
    icon: 'plus',
  },
  {
    id: 'interactions',
    title: 'Spot potential interactions',
    body: 'See when two medicines may not mix well, explained in plain English.',
    image: '/landing/v5-ix-light.png',
    imageLabel: 'Interactions screen with plain-English warnings',
    icon: 'warning',
  },
  {
    id: 'share',
    title: 'Share with your GP',
    body: 'Generate a QR code that opens a ready-made summary of your medicines.',
    image: '/landing/v5-share-light.png',
    imageLabel: 'Share screen with GP summary and QR code',
    icon: 'qr',
  },
];

export type PrivacyItem = {
  icon: LandingIconName;
  title: string;
  body: string;
};

export const PRIVACY_CHAPTER = {
  id: 'privacy',
  title: 'Privacy and security',
  image: '/landing/v5-share-light.png',
  imageLabel: 'Share screen with time-limited GP link',
  items: [
    {
      icon: 'lock',
      title: 'NHS login',
      body: 'We use NHS authentication patterns suitable for demos; production would follow NHS digital standards.',
    },
    {
      icon: 'shield',
      title: 'Your cabinet, your choice',
      body: 'Medicines you add or sync are stored for your session and backend demo; you decide what to share with a clinician.',
    },
    {
      icon: 'qr',
      title: 'Share links expire',
      body: 'GP QR links are time-limited (typically a few hours) so summaries are not left open indefinitely.',
    },
  ] satisfies PrivacyItem[],
  disclaimer:
    'Not medical advice. Always follow your prescriber, pharmacist, or GP. Hackathon prototype, not a licensed medical device.',
};
