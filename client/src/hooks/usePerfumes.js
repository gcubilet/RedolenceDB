import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function usePerfumes(filters = {}) {
  return useQuery({
    queryKey: ['perfumes', filters],
    queryFn: () => fetchPerfumes(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

async function fetchPerfumes(filters) {
  let query = supabase
    .from('perfumes')
    .select(`
      perfume_id,
      name,
      image_url,
      concentration,
      release_date,
      brands (
        brand_id,
        brand_name
      ),
      perfume_notes (
        note_type,
        notes!perfume_notes_note_name_fkey(
          name,
          scent_family
        )
      ),
      user_ratings (
        score,
        gender_lean,
        best_season
      )
    `)
    .order('name', { ascending: true })

  if (filters.brand_id) {
    query = query.eq('brand_id', filters.brand_id)
  }

  if (filters.concentration) {
    query = query.eq('concentration', filters.concentration)
  }

  const { data, error } = await query
  if (error) throw error

  // Client-side filtering for note family, season, gender
  // (these live in nested tables so easier to filter after fetch)
  let results = data || []

  if (filters.note_family) {
    results = results.filter(p =>
      p.perfume_notes?.some(pn =>
        pn.notes?.scent_family === filters.note_family
      )
    )
  }

  // user_ratings.best_season is a text[] (e.g. ['Spring','Summer']).
  if (filters.season) {
    results = results.filter(p =>
      p.user_ratings?.some(r =>
        Array.isArray(r.best_season) && r.best_season.includes(filters.season)
      )
    )
  }

  // user_ratings.gender_lean is a text column: feminine | slightly_feminine |
  // unisex | slightly_masculine | masculine. The UI filters on the three
  // "base" leans; treat the slightly_* values as matches too.
  if (filters.gender) {
    const group = (lean) => {
      if (!lean) return null
      if (lean === 'feminine' || lean === 'slightly_feminine') return 'feminine'
      if (lean === 'masculine' || lean === 'slightly_masculine') return 'masculine'
      return 'unisex'
    }
    results = results.filter(p =>
      p.user_ratings?.some(r => group(r.gender_lean) === filters.gender)
    )
  }

  if (filters.search) {
    const q = filters.search.toLowerCase()
    results = results.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.brands?.brand_name?.toLowerCase().includes(q)
    )
  }

  return results
}

// Separate query for filter options (brands + note families)
export function useFilterOptions() {
  return useQuery({
    queryKey: ['filter-options'],
    queryFn: async () => {
      const [brandsRes, notesRes] = await Promise.all([
        supabase.from('brands').select('brand_id, brand_name').order('brand_name'),
        supabase.from('notes').select('scent_family').not('scent_family', 'is', null),
      ])

      const families = [...new Set(
        (notesRes.data || []).map(n => n.scent_family).filter(Boolean)
      )].sort()

      return {
        brands: brandsRes.data || [],
        noteFamilies: families,
      }
    },
    staleTime: 1000 * 60 * 30, // 30 minutes — rarely changes
  })
}