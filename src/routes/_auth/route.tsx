import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth')({
  component: PublicLayout,
})

function PublicLayout() {
  return (
    <main className="flex h-screen w-screen items-center justify-center">
      <div className="absolute inset-0 bg-cover bg-center" />
      <div className="absolute inset-0 bg-black/70" />
      <div className="z-10">
        <Outlet />
      </div>
    </main>
  )
}
