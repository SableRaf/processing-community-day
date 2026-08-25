import type { ImageMetadata } from 'astro';
import openProcessingLogo from '../images/openprocessing_logo.svg';

export interface Sponsor {
  name: string;
  href: string;
  logo: ImageMetadata;
}

export const SPONSORS: Sponsor[] = [
  {
    name: 'OpenProcessing',
    href: 'https://openprocessing.org',
    logo: openProcessingLogo,
  },
];
