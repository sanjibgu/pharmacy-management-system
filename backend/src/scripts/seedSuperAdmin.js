import { connectDb } from '../config/db.js'
import { env } from '../config/env.js'
import { User } from '../models/User.js'
import { hashPassword } from '../services/passwordService.js'

const name = process.env.SUPERADMIN_NAME || 'Super Admin'
const email = (process.env.SUPERADMIN_EMAIL || '').toLowerCase().trim()
const password = process.env.SUPERADMIN_PASSWORD || ''

if (!email || password.length < 8) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD (min 8 chars). Example:\n' +
      'SUPERADMIN_EMAIL=admin@mypharmacyapp.com SUPERADMIN_PASSWORD=ChangeMe123! npm run seed:superadmin',
  )
  process.exit(1)
}

await connectDb(env.mongoUri)

const existing = await User.findOne({ role: 'SuperAdmin', pharmacyId: null, email })
if (existing) {
  // eslint-disable-next-line no-console
  console.log('SuperAdmin already exists:', existing.email)
  process.exit(0)
}

const passwordHash = await hashPassword(password)
await User.create({
  role: 'SuperAdmin',
  pharmacyId: null,
  name,
  email,
  passwordHash,
  isActive: true,
})

// eslint-disable-next-line no-console
console.log('Created SuperAdmin:', email)

