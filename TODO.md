## Ready for work

- [ ] Add a default OG description for events that don't have a short or long description, a generic fallback like "Join the global celebration at Processing Community Day 2026 in [City]. Explore the map, or start a PCD in your community." Also change the default OG description to something more engaging and less generic, to encourage people to click through to the map and explore the events. Maybe something like "Discover the global celebration of creativity and coding at Processing Community Day 2026! Explore events worldwide, connect with local communities, and join the fun. Find an event near you or start your own PCD today!"
- [ ] Add Fathom analytics
- [ ] Group the list by country, and then sort alphabetically by city within each country, to make it easier for users to find events in their area.
- [ ] The "Submit an event" button should open a modal with the 3 steps for submitting an event, instead of linking to the GitHub page. 1. Say hi in the thread. 2. Open a thread in the forum (can be a stub) 3. Create a PR with the event details. This will make it easier for users to understand the process and encourage more submissions, especially from those who may not be familiar with GitHub.
- [ ] Hover state for "Submit an event" should be the same as the other large buttons.
- [ ] If an event has a thread AND an event page, have two buttons on top of each other. The event page first, and the thread button below in a secondary color.
- [ ] When the menu or panel is focused, the + and - buttons should controll the zoom of the page instead of the map, to allow users to zoom in on the text. Currently, the map zooms in and out when trying to zoom the page, which can be frustrating for users who are trying to read the event details.
- [ ] Use a stylesheet for the markdown in the event details panel to support things like headings, lists, links, and other basic markdown formatting, to make the event descriptions more visually appealing and easier to read. No markdown in the short description, but the long description can support markdown formatting.
- [ ] Add item to the review checklist to encourage reviewers to check that the forum link is correct.
- [ ] Make the OSM links more robust (lat/lon maybe?) and add a link to Google Maps as well (dropdown similar to the add to calendar links in the event details panel).
- [ ] Italicize the name in "This event is organized by [name] and is not affiliated..." in the event details side panel.
- [ ] BUG: on Safari, tabbing from the burger menu button goes straight to markers on the map instead of the other header items.
- [ ] In the panel-info-card, a "location TBD" should use a pin icon (not a link icon) unless it is a virtual event
- [ ] BUG: the checkbox "Don't show again" cannot be toggled by pressing enter on the keyboard. 

## Needs design or clarification:
- [ ] When landing on an area of the map without any events, show a message encouraging users to submit an event in that area, and provide a link to the submission process. Something like "No events found in this area. Be the first to bring PCD to your community! [Submit an event](#)."
- [ ] Add links to the modal for social media, discord, github repo, processing foundation website, to encourage people to connect with the community and learn more about Processing.
- [ ] Add Discourse integration to post a message in the event thread when the PR is merged, with a link to the event on the map and a reminder to share the event.
- [ ] Replace the close button in the menu with a double chevron that matches the open button, to make it clearer that it's a toggle for the menu.
- [ ] In review feedback checklist, only refer to data that was changed in the edit form.
- [ ] Add PCD or Processing Foundation favicon to the map page.
- [ ] Add a "fullscreen" button to the details panel that opens the event details in a new page with a larger layout, to make it easier to read and navigate the event information.
- [ ] Add OSM URI to the event details. Helps with venues inside of other buildings, and info (for example accessibility info) that may be on the OSM page for the venue.

## Later improvements (not for MVP):
- [ ] Investigate translating the map labels to match the language selector (seems complicated)
- [ ] Add an optional total event count to the map view, showing the total number of events currently on the map. This can be added as a large badge in the top left corner of the map, with a tooltip that says "Total number of PCD events worldwide: XXX". Only show this badge if there are more than 10 events on the map.
- [ ] Label "new" on the map for events that were added in the last 7 days, to help users discover new events that were recently added to the map. This can be a small badge or icon next to the event name in the popup and in the side panel.
- [ ] Add form submission using Decap CMS or similar, to allow organizers to submit their events without needing a Github account or going through the issue/PR process.
- [ ] Support events with multiple locations (e.g. in-person event with multiple venues,). This may require changes to the data model and the way events are displayed on the map and in the details panel.
- [ ] Add submission form with confirmation email when the event is approved and published.
- [ ] Allow organizers to edit their event information after it's published.
- [ ] Add support for "related" events or locations around the main event, to allow organizers to link to nearby venues, cultural spaces, or related events happening around the same time even if not officially part of PCD.

## Feedback from Sebastian

Here is a good starter you can use as a template: https://web.archive.org/web/20250326143004/https://www.turbulence.berlin/portfolio

Note that events might have heavily varying accessibility despite being in the same venue

But still the venues have basic stuff that stays – at least regarding mobility. If you allow events to add a OSM place URL, you're future-proof :)

Something like this: https://www.openstreetmap.org/node/3215910341

 A OSM URI is better [note: than plus codes] the venue might be inside another venue. OSM normally has infos then – e.g. when the place is indoors, and on which level it is

Maps are heavily difficult to make accessible. Simply add a list view that you can toggle, and have a hidden switch when the map is focused by the screenreader that allows toggling to the list view.

Have the menu inside a <nav> element would be the standard, and open it when you tab into it from the home/logo button

Like

<hidden link reachable via shift+tab on the home link that skips focus to main content>
 [menu items go here, if you tab into it the menu opens]
</nav>
<main>
…main content, list, map, single open feature…
</main>