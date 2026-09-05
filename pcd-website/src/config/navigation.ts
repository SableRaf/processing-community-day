export interface NavItem {
  label: string;
  href: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Events Map', href: '/' },
  { label: 'Events List', href: '/events/' },
  { label: 'Organize', href: '/organize/getting-started/introduction/' },
  { label: 'What is PCD?', href: '/about/' },
];
