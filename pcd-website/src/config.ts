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

export const ACTIVITY_GUIDE_SUBMISSION_TEMPLATE = `**Activity Title:**
**Created by:**

**Activity Format:** [workshop, discussion, creative exercise, group project, etc]

**Topic:** [what does the activity explore?]
**About the Activity:** [In 1-2 sentences, explain what participants will do and why a PCD organizer might choose this activity]

**Duration:** [1 hour / 2 hours / 3 hours]
**Tools or Materials needed:**

**Link to Activity:**

**License:** I confirm that I own or have permission to license this material, and I agree to publish my original contribution under the [CC BY-SA 4.0 License](https://creativecommons.org/licenses/by-sa/4.0/). I have identified any third-party material that is not covered by this license.

**Preferred Attribution:**`;

export const ACTIVITY_GUIDE_SUBMIT_URL =
  "https://discourse.processing.org/new-topic?" +
  new URLSearchParams({
    title: 'Activity Guide Submission: [Title of your Activity]',
    body: ACTIVITY_GUIDE_SUBMISSION_TEMPLATE,
    category: 'community',
    tags: 'pcd,zine',
  }).toString();

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
