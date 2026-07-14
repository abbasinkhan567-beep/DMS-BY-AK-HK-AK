export function CreditsWatermark({ variant = "footer" }: { variant?: "footer" | "sidebar" }) {
  if (variant === "sidebar") {
    return (
      <div className="mt-auto border-t border-white/10 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Credits</p>
        <div className="mt-2 space-y-2.5 text-[11px] leading-relaxed text-white/70">
          <div>
            <p className="font-semibold text-white/90">Developed By</p>
            <p>Abbasin Khan Bazai &amp; Team</p>
            <p>03188133522</p>
            <p className="break-all">abbasinkhan567@gmail.com</p>
          </div>
          <div className="border-t border-white/10 pt-2.5">
            <p className="font-semibold text-white/90">Designed By</p>
            <p>Abdul Hakeem Bazai &amp; Team</p>
            <p>03131668443</p>
          </div>
          <div className="border-t border-white/10 pt-2.5">
            <p className="font-semibold text-white/90">Backend By</p>
            <p>Ameen Ullah &amp; Team</p>
            <p>0314 2678188</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <footer className="pointer-events-none select-none px-4 pb-4 pt-2 sm:px-6 lg:px-8">
      <div className="rounded-xl border border-edge bg-surface-card/80 px-4 py-3 text-center shadow-soft backdrop-blur-sm">
        <p className="text-[11px] leading-relaxed text-muted">
          <span className="font-semibold text-ink">Developed By</span> Abbasin Khan Bazai
          &amp; Team · 03188133522 · abbasinkhan567@gmail.com
          <span className="mx-2 text-edge">|</span>
          <span className="font-semibold text-ink">Designed By</span> Abdul Hakeem Bazai
          &amp; Team · 03131668443
          <span className="mx-2 text-edge">|</span>
          <span className="font-semibold text-ink">Backend By</span> Ameen Ullah &amp; Team · 0314
          2678188
        </p>
      </div>
    </footer>
  );
}
