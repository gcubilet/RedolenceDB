import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

const router = Router()

// Get top layering suggestions for a perfume
router.get('/:perfumeId/suggestions', async (req, res) => {
  const { perfumeId } = req.params

  const { data, error } = await supabase
    .from('layering_pairs')
    .select(`
      *,
      perfume_a:perfumes!layering_pairs_perfume_a_id_fkey(id, name, image_url, brands(name)),
      perfume_b:perfumes!layering_pairs_perfume_b_id_fkey(id, name, image_url, brands(name))
    `)
    .or(`perfume_a_id.eq.${perfumeId},perfume_b_id.eq.${perfumeId}`)
    .order('votes', { ascending: false })
    .limit(6)

  if (error) return res.status(500).json({ error })

  // Return the "other" perfume in each pair
  const suggestions = data.map(pair => ({
    ...pair,
    suggestion: pair.perfume_a_id === perfumeId ? pair.perfume_b : pair.perfume_a
  }))

  res.json(suggestions)
})

export default router