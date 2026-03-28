import { connectDb } from '../config/db.js'
import { env } from '../config/env.js'
import { User } from '../models/User.js'
import { fullAccess } from '../services/accessService.js'

await connectDb(env.mongoUri)

const res = await User.updateMany(
  { role: 'PharmacyAdmin', pharmacyId: { $ne: null } },
  { $set: { moduleAccess: fullAccess() } },
)

// eslint-disable-next-line no-console
console.log(`Updated PharmacyAdmin users: ${res.modifiedCount ?? res.nModified ?? 0}`)

