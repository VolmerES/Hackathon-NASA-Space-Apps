// Writes the Sun and Earth azimuth and elevation the web shows, hour by hour, for the 5 sites of
// the team, with the very same code the browser runs (src/data/model.ts), so others can check them
// against NASA JPL Horizons (docs/verificacion/).
// usage: npx esbuild scripts/export_angles.ts --bundle --platform=node --outfile=<tmp>.mjs && node <tmp>.mjs <data dir> <out dir> <from ISO> <days>
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadData, simulate, SITES } from '../src/data/model'

const [dataDir, outDir, from = '2027-01-01T00:00:00Z', days = '7'] = process.argv.slice(2)
globalThis.fetch = (async (u: string) => {
  const body = readFileSync(join(dataDir, String(u).replace(/^data\//, '')), 'utf-8')
  return { ok: true, json: async () => JSON.parse(body) }
}) as unknown as typeof fetch

await loadData('data/')
for (const site of SITES.filter((s) => s.team)) {
  const samples = simulate(site, { landing: new Date(from), durationDays: Number(days), slipDays: 0, survivalPowerW: 0, minAntennaElevDeg: 0 })
  const rows = samples.map((s) => [s.t.toISOString().slice(0, 16) + 'Z', s.sunAz.toFixed(4), s.sunEl.toFixed(4), s.earthAz.toFixed(4), s.earthEl.toFixed(4)].join(','))
  const head = `# ${site.name} (${site.team!.code}) lat ${site.lat} lon ${site.lon}; geometric angles from the local horizontal of the Moon's sphere, azimuth from local north, clockwise\ntime_utc,sun_az_deg,sun_el_deg,earth_az_deg,earth_el_deg`
  writeFileSync(join(outDir, `${site.team!.code}.csv`), head + '\n' + rows.join('\n') + '\n')
  console.log(site.team!.code, site.lat, site.lon, samples.length, 'hours')
}
