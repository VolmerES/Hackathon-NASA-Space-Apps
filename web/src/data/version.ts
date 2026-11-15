// Each build stamps the data URLs with its own id. The data files keep their names (they are
// regenerated in place), so without this a browser or a CDN that kept an old copy (the Hostinger CDN
// did, for a day, with "immutable") would go on computing with old horizons after a deploy.
declare const __BUILD_ID__: string
export const BUILD_ID = __BUILD_ID__
/** "data/horizons.json" → "data/horizons.json?v=<build>" */
export const versioned = (url: string) => `${url}${url.includes('?') ? '&' : '?'}v=${BUILD_ID}`
