import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth')({
  component: PublicLayout,
})

function PublicLayout() {
  return (
    <main className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="z-10">
        <Outlet />
      </div>
    </main>
  )
}
