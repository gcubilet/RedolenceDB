import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  // 1. Get user's profile tags from quiz
  const { data: quiz } = await supabase
    .from('quiz_responses')
    .select('profile_tags')
    .eq('user_id', req.user.id)
    .single()

  if (!quiz) return res.status(404).json({ error: 'No quiz found' })

  const userTags = quiz.profile_tags // e.g. ['woody','warm','EDP','oriental']

  // 2. Fetch all perfumes with their tags
  const { data: perfumes } = await supabase
    .from('perfumes')
    .select('id, name, image_url, tags, brands(name)')

  // 3. Score each perfume by tag overlap
  const scored = perfumes
    .map(p => {
      const overlap = (p.tags || []).filter(t => userTags.includes(t)).length
      const total = new Set([...userTags, ...(p.tags || [])]).size
      const score = total > 0 ? Math.round((overlap / total) * 100) : 0
      return { ...p, matchScore: score }
    })
    .filter(p => p.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 12)

  res.json(scored)
})

export default router