import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestPcdTopics, relativeForumTime } from '../../pcd-website/src/lib/forum-topics.mjs';
const topic = (id, updated, extra = {}) => ({ id, title: `Topic ${id}`, bumped_at: updated, tags: [{name:'pcd'}], ...extra });
test('sorts by latest activity rather than pinned order and limits the feed', () => {
  const topics = latestPcdTopics({ topic_list: { topics: [topic(1,'2026-09-01'), topic(2,'2026-09-05'), topic(3,'2026-09-03')] } }, 2);
  assert.deepEqual(topics.map(t => t.id), [2, 3]);
});
test('accepts both tag formats and skips unrelated, malformed, or undated topics', () => {
  const topics = latestPcdTopics({ topic_list: { topics: [
    topic(1, '2026-09-01', {tags:['pcd']}), topic(2, 'invalid'), topic(3, '2026-09-03', {tags:['other']}),
    topic(-4, '2026-09-04'), topic(5, '2026-09-05', {title:''}),
  ] } });
  assert.deepEqual(topics.map(t => t.id), [1]);
});
test('constructs fixed-origin links and preserves titles as plain text', () => {
  const [result] = latestPcdTopics({topic_list:{topics:[topic(7, '', {last_posted_at:'2026-09-01', title:'<img onerror=alert(1)>', slug:'https://evil.example'})]}});
  assert.equal(result.url, 'https://discourse.processing.org/t/7');
  assert.equal(result.title, '<img onerror=alert(1)>');
  assert.equal(result.updated, '2026-09-01');
  assert.throws(() => latestPcdTopics({}), /Invalid forum response/);
  assert.deepEqual(latestPcdTopics({topic_list:{topics:[]}}), []);
});

test('matches Discourse reply totals and resolves unique poster avatars safely', () => {
  const [result] = latestPcdTopics({users:[
    {id:1, username:'alice', avatar_template:'/user_avatar/discourse.processing.org/alice/{size}/1.png'},
    {id:2, username:'bob', avatar_template:'https://avatars.discourse-cdn.com/letter/b/{size}.png'},
    {id:3, username:'eve', avatar_template:'javascript:alert(1)'},
  ], topic_list:{topics:[topic(1,'2026-09-01',{posts_count:76, reply_count:25, posters:[{user_id:1},{user_id:2},{user_id:1},{user_id:3},{user_id:999}]})]}});
  assert.equal(result.replies, 75);
  assert.deepEqual(result.posters.map(p => p.username), ['alice','bob','eve']);
  assert.equal(result.posters[0].avatar, 'https://discourse.processing.org/user_avatar/discourse.processing.org/alice/64/1.png');
  assert.equal(result.posters[1].avatar, 'https://avatars.discourse-cdn.com/letter/b/64.png');
  assert.equal(result.posters[2].avatar, null);
});

test('relative timestamps cover minutes, hours, days, and future clock skew', () => {
  const now = Date.parse('2026-09-05T12:00:00Z');
  assert.equal(relativeForumTime('2026-09-05T11:55:00Z', now), '5m ago');
  assert.equal(relativeForumTime('2026-09-05T10:00:00Z', now), '2h ago');
  assert.equal(relativeForumTime('2026-09-03T12:00:00Z', now), '2d ago');
  assert.equal(relativeForumTime('2026-09-06T12:00:00Z', now), 'just now');
});
