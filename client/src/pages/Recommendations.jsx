import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'
import PerfumeCard from '../components/perfume/PerfumeCard'

async function fetchRecommendations(userId) {
  // 1. Get user's profile tags from their quiz
  const { data: quiz, error: quizError } = await supabase
    .from('quiz_responses')
    .select('profile_tags')
    .eq('user_id', userId)
    .single()

  if (quizError || !quiz) return { perfumes: [], tags: [] }

  const userTags = quiz.profile_tags || []

  // 2. Fetch all perfumes with tags
  const { data: perfumes } = await supabase
    .from('perfumes')
    .select(`
      perfume_id, name, image_url, concentration, release_date, tags,
      brands ( brand_id, brand_name ),
      perfume_notes ( note_type, notes ( name, scent_family ) ),
      user_ratings ( score )
    `)

  if (!perfumes) return { perfumes: [], tags: userTags }

  // 3. Score by tag overlap, exclude already-owned
  const { data: owned } = await supabase
    .from('user_perfumes')
    .select('perfume_id')
    .eq('user_id', userId)

  const ownedIds = new Set((owned || []).map(o => String(o.perfume_id)))

  const scored = perfumes
    .filter(p => !ownedIds.has(String(p.perfume_id)))
    .map(p => {
      const pTags = p.tags || []
      const overlap = pTags.filter(t => userTags.includes(t)).length
      const total = new Set([...userTags, ...pTags]).size
      const matchScore = total > 0 ? Math.round((overlap / total) * 100) : 0
      return { ...p, matchScore }
    })
    .filter(p => p.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 24)

  return { perfumes: scored, tags: userTags }
}

export default function Recommendations() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['recommendations', user?.id],
    queryFn: () => fetchRecommendations(user.id),
    enabled: !!user,
  })

  const { perfumes = [], tags = [] } = data || {}

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        body { background: #F7F2EC; font-family: 'DM Sans', sans-serif; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div style={styles.page}>
        {/* Header */}
        <div style={styles.header}>
          <p style={styles.eyebrow}>Matched for you</p>
          <h1 style={styles.title}>Your scent recommendations</h1>
          <p style={styles.sub}>Based on your taste profile from the quiz.</p>

          {/* Profile tags */}
          {tags.length > 0 && (
            <div style={styles.tagRow}>
              {tags.map(tag => (
                <span key={tag} style={styles.tag}>{tag}</span>
              ))}
              <Link to="/onboarding" style={styles.retakeLink}>Retake quiz</Link>
            </div>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={styles.grid}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ background: '#EDE4D8', borderRadius: 12, aspectRatio: '3/4' }} />
            ))}
          </div>
        )}

        {/* No quiz taken */}
        {!isLoading && tags.length === 0 && (
          <div style={styles.empty}>
            <p style={styles.emptyTitle}>No profile yet</p>
            <p style={styles.emptySub}>Take the quiz to get personalised recommendations.</p>
            <button onClick={() => navigate('/onboarding')} style={styles.quizBtn}>
              Take the quiz
            </button>
          </div>
        )}

        {/* No matches */}
        {!isLoading && tags.length > 0 && perfumes.length === 0 && (
          <div style={styles.empty}>
            <p style={styles.emptyTitle}>No matches found</p>
            <p style={styles.emptySub}>
              Your catalogue may need more tagged perfumes, or you already own everything that matches.
            </p>
            <Link to="/" style={styles.quizBtn}>Browse the catalogue</Link>
          </div>
        )}

        {/* Results */}
        {!isLoading && perfumes.length > 0 && (
          <>
            <p style={styles.resultCount}>{perfumes.length} matches found</p>
            <div style={styles.grid}>
              {perfumes.map((p, i) => (
                <div key={p.perfume_id} style={{ position: 'relative' }}>
                  <PerfumeCard perfume={p} index={i} />
                  <div style={styles.matchBadge}>{p.matchScore}% match</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}

const styles = {
  page: { maxWidth: 1100, margin: '0 auto', padding: '2rem 2.5rem 4rem' },
  header: { marginBottom: '2.5rem' },
  eyebrow: { fontSize: 11, fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A8878', margin: '0 0 10px', fontFamily: "'DM Sans', sans-serif" },
  title: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 300, color: '#2C2018', margin: '0 0 8px', lineHeight: 1.15 },
  sub: { fontSize: 14, color: '#9A8878', margin: '0 0 16px', fontFamily: "'DM Sans', sans-serif" },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  tag: { background: '#EDE4D8', color: '#5C4A38', fontSize: 12, padding: '4px 12px', borderRadius: 20, fontFamily: "'DM Sans', sans-serif" },
  retakeLink: { fontSize: 12, color: '#C4845A', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, textDecoration: 'none', padding: '4px 8px' },
  resultCount: { fontSize: 12, color: '#9A8878', margin: '0 0 16px', fontFamily: "'DM Sans', sans-serif" },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem' },
  matchBadge: { position: 'absolute', bottom: 80, right: 12, background: 'rgba(40,30,20,.7)', color: '#F5EFE6', fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 20, fontFamily: "'DM Sans', sans-serif", pointerEvents: 'none' },
  empty: { textAlign: 'center', padding: '5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 },
  emptyTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: '#2C2018', margin: 0 },
  emptySub: { fontSize: 14, color: '#9A8878', margin: 0, maxWidth: 360, fontFamily: "'DM Sans', sans-serif" },
  quizBtn: { marginTop: 8, padding: '10px 24px', background: '#C4845A', color: '#FDF8F2', border: 'none', borderRadius: 24, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textDecoration: 'none', display: 'inline-block' },
}
