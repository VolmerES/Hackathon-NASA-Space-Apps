// When the device cannot show the live 3D Moon (no WebGL, the GPU gives up, or the maps take too
// long), a still image of the same scene takes its place, rendered beforehand from our own 3D Moon
// (NASA SVS imagery), drifting slowly so the page still feels alive. Everything else works as usual.
export function MoonFallback() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-black" aria-hidden="true">
      <picture>
        <source media="(orientation: portrait)" srcSet="moon/moon_fallback_tall.jpg" />
        <img src="moon/moon_fallback_wide.jpg" alt="" className="moon-drift h-full w-full object-cover object-bottom" />
      </picture>
      <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_100%,transparent_0%,rgba(0,0,0,0.35)_100%)]" />
    </div>
  )
}
