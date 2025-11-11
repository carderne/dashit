import { MousePointer2 } from 'lucide-react'

interface CursorData {
  x?: number
  y?: number
  displayName?: string
}

interface PresenceUser {
  id: string
  data: CursorData
  lastPresent: number
}

interface CursorOverlayProps {
  users: Array<PresenceUser>
}

// Generate a color from a string hash
function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = hash % 360
  return `hsl(${hue}, 70%, 60%)`
}

export function CursorOverlay({ users }: CursorOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      {users
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        .filter((user) => user.data !== undefined)
        .map((user) => {
          const { x, y, displayName } = user.data

          // Don't render if no position
          if (x === undefined || y === undefined) return null

          const color = stringToColor(user.id)
          const name = displayName || 'Anonymous'

          return (
            <div
              key={user.id}
              className="absolute transition-all duration-200 ease-out"
              style={{
                left: `${x}px`,
                top: `${y}px`,
                transform: 'translate(-2px, -2px)',
              }}
            >
              {/* Cursor icon */}
              <MousePointer2 className="h-5 w-5 drop-shadow-lg" style={{ color }} fill={color} />

              {/* Name label */}
              <div
                className="mt-1 rounded px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow-lg"
                style={{ backgroundColor: color }}
              >
                {name}
              </div>
            </div>
          )
        })}
    </div>
  )
}
