import { Link } from '@tanstack/react-router'

export function NotFoundComponent() {
  return (
    <div className="canvas-grid-404 relative flex h-screen w-full items-center justify-center overflow-hidden">
      {/* Diffuse glows - sparse, lost purple/slate theme */}
      <div className="pointer-events-none absolute top-[-200px] left-[-200px] h-[600px] w-[600px] rounded-full bg-purple-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-200px] bottom-[-200px] h-[600px] w-[600px] rounded-full bg-slate-500/10 blur-[120px]" />

      <div className="relative">
        {/* Glassy card */}
        <div className="relative rounded-3xl border border-white/20 bg-white/50 p-12 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          {/* Gradient overlay for extra depth */}
          <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-white/50 to-transparent dark:from-white/5 dark:to-transparent" />

          {/* Content */}
          <div className="relative space-y-6 text-center">
            <div className="space-y-2">
              <h1 className="bg-linear-to-br from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-6xl font-bold text-transparent dark:from-white dark:via-slate-300 dark:to-white">
                404
              </h1>
              <p className="text-xl font-medium text-slate-700 dark:text-slate-300">
                Sorry, you lost your way
              </p>
            </div>

            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-900 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
            >
              Take me home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
