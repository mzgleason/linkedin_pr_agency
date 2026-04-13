export default function HomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Repo overhaul in progress</h1>
      <p className="text-sm text-neutral-700">
        This is the base mobile-first layout scaffold for MZG-25. Next steps: wire in data + workflows.
      </p>
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="text-sm font-medium">Quick checks</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
          <li>App router is enabled (`/app`).</li>
          <li>Tailwind is configured (`app/globals.css`).</li>
          <li>API route exists (`/api/health`).</li>
        </ul>
      </div>
    </div>
  );
}
