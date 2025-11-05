import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/foo')({
  component: PublicLayout,
})

function PublicLayout() {
  return (
    <main className="flex h-screen w-screen items-center justify-center">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/hero.webp')" }}
      />
      <div className="absolute inset-0 bg-black/70" />
      <div className="z-10">
        <Outlet />
      </div>
    </main>
  )
}
