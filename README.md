
> [!NOTE] 
> This project is in early development. The map and event data are not yet complete, but we welcome contributions from the community! 

[Submit your event](https://github.com/processing/processing-community-day/issues/new?template=new-event.yml) to the map!

# Processing Community Day Website

A global map of Processing Community Day events.

In 2026, Processing turns 25. To mark the occasion, Processing Community Day (PCD) returns as a worldwide celebration! PCD is a global network of community-led events that brings together artists, designers, technologists, educators, and open-source communities around the world.

For more information about PCD 2026 and how to get involved, see the [forum thread](https://discourse.processing.org/t/pcd-worldwide-2026-call-for-organizers/48081).

## About this project

For now it's a simple static map showcasing PCD events around the world. The goal is to have something ready to share in the next few weeks to help organizers promote their events and encourage more people to sign up to host events in new locations.

This will eventually grow into a full-featured site with resources, an organizer kit, guidelines, and more.

The map site is open source and contributions are welcome!

## Adding an event

To add your event to the map, open a GitHub Issue using the [**New Event**](https://github.com/processing/processing-community-day/issues/new?template=new-event.yml) template.

A script will automatically validate your submission and create a pull request. If there are errors (missing fields, invalid dates, etc.), you'll receive friendly error messages. Once the validation passes, a maintainer will review and merge the PR, and your event will appear on the map.

If you have any questions or need help, feel free to ask in the [forum thread](https://discourse.processing.org/t/pcd-worldwide-2026/48081) or join the [Processing Foundation Discord server](https://discord.gg/q5NksnwGsY).

## Tech

- **[Astro 5](https://astro.build)** — static site generation
- **[Vue 3](https://vuejs.org)** — all interactive UI as client-only island components
- **[Leaflet](https://leafletjs.com)** — for map rendering and interactivity
- **[leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster)** — for clustering map markers
- **[Open Location Code](https://github.com/google/open-location-code)** — for geocoding plus codes to lat/lng
- **[GitHub Workflows](https://github.com/features/actions)** — for event submission, review, and data management

## Developing

```sh
cd pcd-website
npm install
npm run dev      # localhost:4321
npm run build    # production build → dist/
npm run preview  # preview production build
```

## Known issues

Fractional zoom levels cause gaps in the map tiles on Chromium. (this is a known issue with Leaflet, see: https://github.com/Leaflet/Leaflet/issues/3575)

## Looking for the old PCD website? 

See [processing/processing-community-day-website-archived](https://github.com/processing/processing-community-day-website-archived) or the [Wayback Machine archive](https://web.archive.org/web/20221201000000*/https://day.processing.org/).

## Disclosure and a Personal Note on "AI" Tools

Large parts of this project's code and documentation were written or edited with the help of LLM-based tools including Claude Code and GitHub Copilot, and reviewed by a human (me, @SableRaf).

LLMs can be useful, but they also make mistakes and should be treated with caution. That being said, this repository would likely not exist without these generative tools, as I simply did not have the time to write everything from scratch myself. I believe it is possible and important to be critical of the more problematic aspects of these tools while also acknowledging their occasional usefulness.

If you notice issues, bugs, factual mistakes, or anything else that could be improved, please feel free to open an issue or suggest changes. Contributions and corrections are always welcome.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.