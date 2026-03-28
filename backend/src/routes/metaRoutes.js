import { Router } from 'express'
import { MODULES } from '../config/modules.js'

const router = Router()

router.get('/modules', (req, res) => {
  res.json({ items: MODULES })
})

export default router

