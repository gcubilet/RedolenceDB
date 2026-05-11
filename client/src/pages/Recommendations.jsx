import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'
import PerfumeCard from '../components/perfume/PerfumeCard'

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchRecommendations(userId) {
  // 1. Quiz profile
  const { data: quiz } = await supabase
    .from('quiz_responses')
    .select('profile_tags, answers')
    .eq('user_id', userId)
    .single()

  const userTags    = quiz?.profile_tags || []
  const negativeTags = quiz?.answers?.negative_tags || []

  // 2. User's collection — fetch with tags + notes for the collection signal
  const { data: ownedRaw } = await supabase
    .from('user_perfumes')
    .select(`
      perfume_id,
      perfumes (
        tags,
        perfume_notes ( notes ( name, scent_family ) )
      )
    `)
    .eq('user_id', userId)

  const owned = ownedRaw || []
  const ownedIds = new Set(owned.map(o => String(o.perfume_id)))

  // Build a frequency map from the user's collection tags + note scent families
  const collectionFreq = {}
  owned.forEach(o => {
    const p = o.perfumes
    if (!p) return
    ;(p.tags || []).forEach(t => {
      collectionFreq[t] = (collectionFreq[t] || 0) + 2   // tags weighted x2
    })
    ;(p.perfume_notes || []).forEach(pn => {
      const fam = pn.notes?.scent_family
      if (fam) collectionFreq[fam.toLowerCase()] = (collectionFreq[fam.toLowerCase()] || 0) + 1
    })
  })
  const collectionTotal = Object.values(collectionFreq).reduce((a, b) => a + b, 0) || 1

  // 3. All perfumes (not owned), with tags + avg rating
  const { data: allPerfumes } = await supabase
    .from('perfumes')
    .select(`
      perfume_id, name, image_url, concentration, release_date, tags,
      brands ( brand_id, brand_name ),
      perfume_notes ( note_type, notes ( name, scent_family ) ),
      user_ratings ( score )
    `)

  if (!allPerfumes) return { perfumes: [], userTags, negativeTags, hasCollection: owned.length > 0 }

  const candidates = allPerfumes.filter(p => !ownedIds.has(String(p.perfume_id)))

  // 4. Score each candidate
  const scored = candidates.map(p => {
    const pTags = p.tags || []
    const pNoteFamilies = (p.perfume_notes || [])
      .map(pn => pn.notes?.scent_family?.toLowerCase())
      .filter(Boolean)

    // ── Quiz signal (Jaccard overlap) ──────────────────────────────────────
    let quizScore = 0
    if (userTags.length > 0) {
      const overlap = pTags.filter(t => userTags.includes(t)).length
      const union   = new Set([...userTags, ...pTags]).size
      quizScore = union > 0 ? overlap / union : 0
    }

    // ── Collection signal ─────────────────────────────────────────────────
    let collectionScore = 0
    if (collectionTotal > 0 && owned.length > 0) {
      const allCandidateTerms = [...pTags, ...pNoteFamilies]
      const rawOverlap = allCandidateTerms.reduce((sum, term) => {
        return sum + (collectionFreq[term] || 0)
      }, 0)
      // normalise against collectionTotal
      collectionScore = Math.min(rawOverlap / collectionTotal, 1)
    }

    // ── Negative tag penalty ──────────────────────────────────────────────
    const negativeHits = negativeTags.filter(neg => {
      const key = neg.replace('dislike-', '')
      return pTags.some(t => t.includes(key)) || pNoteFamilies.some(f => f.includes(key))
    }).length
    const penalty = negativeHits * 0.25

    // ── Community rating boost (small) ───────────────────────────────────
    const scores = (p.user_ratings || []).filter(r => r.score).map(r => r.score)
    const avgRating = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    const ratingBoost = avgRating / 50   // max ~0.1 boost for a 5/5 rated perfume

    // ── Final weighted blend ──────────────────────────────────────────────
    // If user has a collection, weight it 50/50 with quiz; otherwise 100% quiz
    const hasCollection = owned.length > 0
    const raw = hasCollection
      ? (quizScore * 0.5 + collectionScore * 0.5)
      : quizScore
    const final = Math.max(0, raw - penalty + ratingBoost)
    const matchPct = Math.min(Math.round(final * 100), 99)

    return { ...p, matchScore: matchPct, quizScore, collectionScore }
  })
  .filter(p => p.matchScore > 0)
  .sort((a, b) => b.matchScore - a.matchScore)
  .slice(0, 24)

  return {
    perfumes:      scored,
    userTags,
    negativeTags,
    hasCollection: owned.length > 0,
    collectionSize: owned.length,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Recommendations() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['recommendations', user?.id],
    queryFn: () => fetchRecommendations(user.id),
    enabled: !!user,
  })

  const { perfumes = [], userTags = [], negativeTags = [], hasCollection, collectionSize } = data || {}

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
          <p style={styles.sub}>
            {hasCollection
              ? `Based on your taste profile and your ${collectionSize}-perfume collection.`
              : 'Based on your taste profile from the quiz.'}
          </p>

          {/* Signal pills */}
          <div style={styles.signalRow}>
            {userTags.length > 0 && (
              <div style={styles.signalBlock}>
                <span style={styles.signalLabel}>Quiz tags</span>
                <div style={styles.tagCloud}>
                  {userTags.slice(0, 10).map(tag => (
                    <span key={tag} style={styles.tag}>{tag}</span>
                  ))}
                  {userTags.length > 10 && (
                    <span style={styles.tagMore}>+{userTags.length - 10}</span>
                  )}
                </div>
              </div>
            )}
            {negativeTags.length > 0 && (
              <div style={styles.signalBlock}>
                <span style={styles.signalLabel}>Avoiding</span>
                <div style={styles.tagCloud}>
                  {negativeTags.map(tag => (
                    <span key={tag} style={styles.tagNeg}>{tag.replace('dislike-', '')}</span>
                  ))}
                </div>
              </div>
            )}
            <Link to="/onboarding" style={styles.retakeLink}>Retake quiz →</Link>
          </div>
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <div style={styles.grid}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ background: '#EDE4D8', borderRadius: 12, aspectRatio: '3/4', opacity: 1 - i * 0.08 }} />
            ))}
          </div>
        )}

        {/* No quiz taken */}
        {!isLoading && userTags.length === 0 && (
          <div style={styles.empty}>
            <p style={styles.emptyTitle}>No profile yet</p>
            <p style={styles.emptySub}>Take the quiz to get personalised recommendations.</p>
            <button onClick={() => navigate('/onboarding')} style={styles.ctaBtn}>
              Take the quiz
            </button>
          </div>
        )}

        {/* No matches */}
        {!isLoading && userTags.length > 0 && perfumes.length === 0 && (
          <div style={styles.empty}>
            <p style={styles.emptyTitle}>No matches found</p>
            <p style={styles.emptySub}>
              Your catalogue may need more tagged perfumes, or you already own everything that matches.
            </p>
            <Link to="/" style={styles.ctaBtn}>Browse the catalogue</Link>
          </div>
        )}

        {/* Results */}
        {!isLoading && perfumes.length > 0 && (
          <>
            <div style={styles.resultsMeta}>
              <p style={styles.resultCount}>{perfumes.length} matches found</p>
              {hasCollection && (
                <span style={styles.collectionSignalBadge}>
                  Perfumes that match your collection
                </span>
              )}
            </div>
            <div style={styles.grid}>
              {perfumes.map((p, i) => (
                <div key={p.perfume_id} style={{ position: 'relative', animation: `fadeUp .3s ease ${i * 0.04}s both` }}>
                  <PerfumeCard perfume={p} index={i} />
                  <div style={{
                    ...styles.matchBadge,
                    background: p.matchScore >= 60
                      ? 'rgba(85, 75, 170, 0.88)'
                      : 'rgba(40, 30, 20, 0.65)',
                  }}>
                    {p.matchScore}% match
                  </div>
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
  sub: { fontSize: 14, color: '#9A8878', margin: '0 0 20px', fontFamily: "'DM Sans', sans-serif" },
  signalRow: { display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' },
  signalBlock: { display: 'flex', flexDirection: 'column', gap: 6 },
  signalLabel: { fontSize: 10, color: '#9A8878', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: "'DM Sans', sans-serif" },
  tagCloud: { display: 'flex', flexWrap: 'wrap', gap: 5 },
  tag: { background: '#EDE4D8', color: '#5C4A38', fontSize: 11, padding: '3px 10px', borderRadius: 20, fontFamily: "'DM Sans', sans-serif" },
  tagNeg: { background: '#FAECE7', color: '#8B3A22', fontSize: 11, padding: '3px 10px', borderRadius: 20, fontFamily: "'DM Sans', sans-serif" },
  tagMore: { background: '#EDE4D8', color: '#9A8878', fontSize: 11, padding: '3px 10px', borderRadius: 20, fontFamily: "'DM Sans', sans-serif" },
  retakeLink: { fontSize: 12, color: '#7F77DD', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, textDecoration: 'none', alignSelf: 'flex-end', paddingBottom: 2 },
  resultsMeta: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  resultCount: { fontSize: 12, color: '#9A8878', margin: 0, fontFamily: "'DM Sans', sans-serif" },
  collectionSignalBadge: { fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#EEEDFE', color: '#5C56B8', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem' },
  matchBadge: { position: 'absolute', bottom: 80, right: 12, color: '#F5EFE6', fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 20, fontFamily: "'DM Sans', sans-serif", pointerEvents: 'none', transition: 'background .2s' },
  empty: { textAlign: 'center', padding: '5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 },
  emptyTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: '#2C2018', margin: 0 },
  emptySub: { fontSize: 14, color: '#9A8878', margin: 0, maxWidth: 360, fontFamily: "'DM Sans', sans-serif" },
  ctaBtn: { marginTop: 8, padding: '10px 24px', background: '#7F77DD', color: '#FDF8F2', border: 'none', borderRadius: 24, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textDecoration: 'none', display: 'inline-block' },
}
