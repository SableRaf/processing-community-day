export const PCD_EMAIL = "day@processing.org";
export const SUBMIT_EVENT_URL =
  "https://github.com/processing/processing-community-day/issues/new?template=01-new-event.yml";
export const GITHUB_EDIT_EVENT_URL =
  "https://github.com/processing/processing-community-day/issues/new?template=04-edit-event.yml";
export const GITHUB_CONTENT_ISSUE_URL =
  "https://github.com/processing/processing-community-day/issues/new?template=03-content-issue.yml";
export const PCD_FORUM_THREAD_URL =
  "https://discourse.processing.org/t/pcd-worldwide-2026-call-for-organizers/48081";
export const PCD_FORUM_NEW_TOPIC_URL =
  "https://discourse.processing.org/new-topic?" +
  new URLSearchParams({
    title: "PCD @ [Your City] 2026",
    body: "Hi! I'm organizing a Processing Community Day 2026 event in [City, Country].\n\nI'll update this thread with more details as planning progresses.",
    category: "community",
    tags: "pcd",
  }).toString();

export const ZINE_SUBMIT_URL =
  "https://github.com/processing/processing-community-day/issues/new?template=05-new-zine.yml";

export const PCD_DISCORD_URL = "https://discord.gg/q5NksnwGsY";

export interface SocialLink {
  label: string;
  href: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  { label: "Instagram", href: "https://instagram.com/processingorg" },
  { label: "Medium", href: "https://medium.com/@ProcessingOrg" },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/processing-foundation/" },
];
