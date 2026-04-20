import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabase } from '../lib/supabase.js'

const router = Router()

// Only allow admins — check a custom claim or a separate admins table
router.post('/', requireAuth, async (req, res) => {
  const { sql } = req.body

  // Safety: only allow SELECT statements
  const trimmed = sql.trim().toLowerCase()
  if (!trimmed.startsWith('select')) {
    return res.status(403).json({ error: 'Only SELECT queries are permitted' })
  }

  const { data, error } = await supabase.rpc('run_query', { query: sql })
  if (error) return res.status(400).json({ error })
  res.json({ data })
})

export default router