import migrations from '@convex-dev/migrations/convex.config'
import presence from '@convex-dev/presence/convex.config'
import autumn from '@useautumn/convex/convex.config'
import { defineApp } from 'convex/server'
import betterAuth from './betterAuth/convex.config'

const app = defineApp()
app.use(betterAuth)
app.use(migrations)
app.use(presence)
app.use(autumn)

export default app
