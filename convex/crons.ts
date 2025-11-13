import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Run cleanup daily at 3 AM UTC to remove stale presence records
crons.daily(
  'cleanup stale presence',
  { hourUTC: 3, minuteUTC: 0 },
  internal.presence.cleanupStalePresence,
)

export default crons
