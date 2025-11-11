import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth')({
  component: PublicLayout,
})

function PublicLayout() {
  return (
    <main className="canvas-grid-signin relative flex h-screen w-screen items-center justify-center overflow-hidden">
      {/* Diffuse glows */}
      <div className="pointer-events-none absolute top-[-200px] left-[-200px] h-[600px] w-[600px] rounded-full bg-blue-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-200px] bottom-[-200px] h-[600px] w-[600px] rounded-full bg-indigo-500/10 blur-[120px]" />

      <div className="z-10">
        <Outlet />
      </div>
    </main>
  )
}
