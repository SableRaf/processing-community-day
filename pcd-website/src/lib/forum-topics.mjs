/** Public topic payloads are untrusted; render titles as text and construct fixed-origin links. */
export function latestPcdTopics(payload, limit = 5) {
  if (!Array.isArray(payload?.topic_list?.topics)) throw new Error('Invalid forum response');
  const users = new Map((Array.isArray(payload.users) ? payload.users : []).map(user => [user.id, user]));
  return payload.topic_list.topics.filter(topic =>
    Number.isSafeInteger(topic.id) && topic.id > 0 && typeof topic.title === 'string' && topic.title.trim() &&
    Array.isArray(topic.tags) && topic.tags.some(tag => (typeof tag === 'string' ? tag : tag?.name) === 'pcd') &&
    Number.isFinite(Date.parse(topic.bumped_at || topic.last_posted_at))
  ).map(topic => ({
    id: topic.id,
    title: topic.title,
    url: `https://discourse.processing.org/t/${topic.id}`,
    updated: topic.bumped_at || topic.last_posted_at,
    // Discourse's topic-list Replies column counts all posts except the opening post.
    replies: Number.isSafeInteger(topic.posts_count) ? Math.max(0, topic.posts_count - 1) : 0,
    posters: [...new Set((Array.isArray(topic.posters) ? topic.posters : []).map(poster => poster.user_id))]
      .map(id => users.get(id))
      .filter(user => user && typeof user.username === 'string')
      .slice(0, 5)
      .map(user => ({ username: user.username, avatar: forumAvatarUrl(user.avatar_template) })),
  })).sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated) || b.id - a.id).slice(0, limit);
}

function forumAvatarUrl(template) {
  if (typeof template !== 'string') return null;
  try {
    const url = new URL(template.replaceAll('{size}', '64'), 'https://discourse.processing.org');
    return url.protocol === 'https:' && (url.hostname === 'discourse.processing.org' || url.hostname.endsWith('.discourse-cdn.com'))
      ? url.href : null;
  } catch { return null; }
}

export function relativeForumTime(updated, now = Date.now()) {
  const seconds = Math.max(0, (now - Date.parse(updated)) / 1000);
  if (!Number.isFinite(seconds)) return '';
  if (seconds < 60) return 'just now';
  for (const [unit, duration] of [['y', 31536000], ['mo', 2592000], ['d', 86400], ['h', 3600], ['m', 60]]) {
    if (seconds >= duration) return `${Math.floor(seconds / duration)}${unit} ago`;
  }
}
