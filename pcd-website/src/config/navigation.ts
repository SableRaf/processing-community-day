export interface NavItem {
  label: string;
  href: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Events Map', href: '/' },
  { label: 'Organize', href: '/organize/' },
  { label: 'What is PCD?', href: '/about/' },
];
