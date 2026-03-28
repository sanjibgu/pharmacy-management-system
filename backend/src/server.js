import { createApp } from './app.js'
import { connectDb } from './config/db.js'
import { env } from './config/env.js'

await connectDb(env.mongoUri)

const app = createApp()
app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${env.port}`)
})

