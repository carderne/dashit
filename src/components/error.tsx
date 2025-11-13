import { Link } from '@tanstack/react-router'

export function ErrorComponent({ error }: { error: Error }) {
  return (
    <div className="canvas-grid-error relative flex h-screen w-full items-center justify-center overflow-hidden">
      {/* Diffuse glows - urgent red/orange theme */}
      <div className="pointer-events-none absolute top-[-200px] left-[-200px] h-[600px] w-[600px] rounded-full bg-red-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-200px] bottom-[-200px] h-[600px] w-[600px] rounded-full bg-orange-500/15 blur-[120px]" />

      <div className="relative max-w-2xl">
        {/* Glassy card */}
        <div className="relative rounded-3xl border border-white/20 bg-white/50 p-12 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          {/* Gradient overlay for extra depth */}
          <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-white/50 to-transparent dark:from-white/5 dark:to-transparent" />

          {/* Content */}
          <div className="relative space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="bg-linear-to-br from-red-600 via-orange-600 to-red-600 bg-clip-text text-5xl font-bold text-transparent dark:from-red-400 dark:via-orange-400 dark:to-red-400">
                Oops! Something went wrong
              </h1>
              <p className="text-lg font-medium text-slate-700 dark:text-slate-300">
                We encountered an unexpected error
              </p>
            </div>

            {/* Error details */}
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 backdrop-blur-sm dark:border-red-900/50 dark:bg-red-950/30">
              <h2 className="mb-2 text-sm font-semibold text-red-900 dark:text-red-300">
                Error Details:
              </h2>
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-400">
                    {error.name || 'Error'}
                  </p>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error.message}</p>
                </div>
                {error.stack && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-red-800 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                      Stack Trace
                    </summary>
                    <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-red-100/50 p-3 text-xs text-red-900 dark:bg-red-950/50 dark:text-red-200">
                      {error.stack}
                    </pre>
                  </details>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-center gap-3">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-900 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
