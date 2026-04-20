import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'

const SEASON_MAP = { 1: 'Spring', 2: 'Summer', 3: 'Autumn', 4: 'Winter' }
const GENDER_MAP = { 1: 'Feminine', 2: 'Unisex', 3: 'Masculine' }
const SILLAGE_MAP = {
  intimate: 'Intimate', moderate: 'Moderate',
  strong: 'Strong', enormous: 'Enormous'
}
const LONGEVITY_MAP = {
  weak: 'Weak', moderate: 'Moderate',
  long: 'Long', eternal: 'Eternal'
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchPerfume(id) {
  const { data, error } = await supabase
    .from('perfumes')
    .select(`
      *,
      brands ( brand_id, brand_name ),
      perfume_notes (
        note_type,
        notes ( name, scent_family, photo_url, description )
      ),
      user_ratings ( score, sillage, longevity, gender, season, review, user_id )
    `)
    .eq('perfume_id', id)
    .single()
  if (error) throw error
  return data
}

async function fetchLayeringPairs(id) {
  const { data } = await supabase
    .from('layering_pairs')
    .select(`
      *,
      perfume_a:perfumes!layering_pairs_perfume_a_id_fkey ( perfume_id, name, image_url, brands(brand_name) ),
      perfume_b:perfumes!layering_pairs_perfume_b_id_fkey ( perfume_id, name, image_url, brands(brand_name) )
    `)
    .or(`perfume_a_id.eq.${id},perfume_b_id.eq.${id}`)
    .order('votes', { ascending: false })
    .limit(4)
  return (data || []).map(pair => ({
    ...pair,
    other: String(pair.perfume_a_id) === String(id) ? pair.perfume_b : pair.perfume_a,
  }))
}

async function fetchUserRating(perfumeId, userId) {
  if (!userId) return null
  const { data } = await supabase
    .from('user_ratings')
    .select('*')
    .eq('perfume_id', perfumeId)
    .eq('user_id', userId)
    .single()
  return data || null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avgScore(ratings) {
  const scores = (ratings || []).filter(r => r.score).map(r => r.score)
  if (!scores.length) return null
  return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
}

function modeOf(arr) {
  if (!arr?.length) return null
  const freq = {}
  arr.forEach(v => { if (v) freq[v] = (freq[v] || 0) + 1 })
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || null
}

function groupNotes(perfumeNotes) {
  const groups = { top: [], middle: [], base: [] }
  ;(perfumeNotes || []).forEach(pn => {
    if (groups[pn.note_type]) groups[pn.note_type].push(pn.notes)
  })
  return groups
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PerfumeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [ratingOpen, setRatingOpen] = useState(false)

  const { data: perfume, isLoading, isError } = useQuery({
    queryKey: ['perfume', id],
    queryFn: () => fetchPerfume(id),
  })

  const { data: pairs = [] } = useQuery({
    queryKey: ['layering', id],
    queryFn: () => fetchLayeringPairs(id),
    enabled: !!id,
  })

  const { data: myRating } = useQuery({
    queryKey: ['my-rating', id, user?.id],
    queryFn: () => fetchUserRating(id, user?.id),
    enabled: !!user,
  })

  const ratingMutation = useMutation({
    mutationFn: async (values) => {
      const payload = { ...values, perfume_id: id, user_id: user.id }
      const { error } = await supabase
        .from('user_ratings')
        .upsert(payload, { onConflict: 'user_id,perfume_id' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['perfume', id])
      queryClient.invalidateQueries(['my-rating', id, user?.id])
      setRatingOpen(false)
    },
  })

  const addToCollection = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('user_perfumes')
        .upsert({ user_id: user.id, perfume_id: id }, { onConflict: 'user_id,perfume_id' })
      if (error) throw error
    },
  })

  if (isLoading) return <LoadingSkeleton />
  if (isError || !perfume) return <ErrorState onBack={() => navigate('/')} />

  const score = avgScore(perfume.user_ratings)
  const commonSillage = modeOf(perfume.user_ratings?.map(r => r.sillage))
  const commonGender  = modeOf(perfume.user_ratings?.map(r => String(r.gender)))
  const commonSeason  = modeOf(perfume.user_ratings?.map(r => String(r.season)))
  const notes = groupNotes(perfume.perfume_notes)
  const reviews = (perfume.user_ratings || []).filter(r => r.review)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        body { background: #F7F2EC; font-family: 'DM Sans', sans-serif; }
        .note-card:hover { border-color: #D4B89A !important; transform: translateY(-2px); }
        .layer-card:hover { border-color: #C4845A !important; }
        .action-btn:hover { opacity: .85; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div style={styles.page}>
        {/* Breadcrumb */}
        <div style={styles.breadcrumb}>
          <Link to="/" style={styles.breadLink}>Catalogue</Link>
          <span style={styles.breadSep}>/</span>
          <Link to={`/brand/${perfume.brands?.brand_id}`} style={styles.breadLink}>
            {perfume.brands?.brand_name}
          </Link>
          <span style={styles.breadSep}>/</span>
          <span style={styles.breadCurrent}>{perfume.name}</span>
        </div>

        {/* Hero */}
        <div style={styles.hero}>
          {/* Image */}
          <div style={styles.imageCol}>
            <div style={styles.imageWrap}>
              {perfume.image_url
                ? <img src={perfume.image_url} alt={perfume.name} style={styles.image} />
                : <ImageFallback />
              }
              {perfume.concentration && (
                <span style={styles.concBadge}>{perfume.concentration}</span>
              )}
            </div>
          </div>

          {/* Info */}
          <div style={styles.infoCol}>
            <Link to={`/brand/${perfume.brands?.brand_id}`} style={styles.brandLink}>
              {perfume.brands?.brand_name}
            </Link>
            <h1 style={styles.title}>{perfume.name}</h1>

            {perfume.release_date && (
              <p style={styles.meta}>
                Released {new Date(perfume.release_date).getFullYear()}
                {perfume.discontinued && ` · Discontinued ${new Date(perfume.discontinued).getFullYear()}`}
              </p>
            )}

            {/* Score */}
            {score && (
              <div style={styles.scoreRow}>
                <div style={styles.scoreBig}>{score}</div>
                <div>
                  <StarRow score={parseFloat(score)} />
                  <p style={styles.ratingCount}>
                    {perfume.user_ratings?.length} {perfume.user_ratings?.length === 1 ? 'rating' : 'ratings'}
                  </p>
                </div>
              </div>
            )}

            {/* Community profile badges */}
            <div style={styles.badgeRow}>
              {commonSillage && <Badge label="Sillage" value={SILLAGE_MAP[commonSillage]} />}
              {commonGender  && <Badge label="Gender" value={GENDER_MAP[commonGender]} />}
              {commonSeason  && <Badge label="Season" value={SEASON_MAP[commonSeason]} />}
            </div>

            {perfume.description && (
              <p style={styles.description}>{perfume.description}</p>
            )}

            {/* Actions */}
            <div style={styles.actions}>
              {user ? (
                <>
                  <button
                    className="action-btn"
                    onClick={() => addToCollection.mutate()}
                    style={styles.primaryBtn}
                    disabled={addToCollection.isSuccess}
                  >
                    {addToCollection.isSuccess ? '✓ In collection' : '+ Add to collection'}
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => setRatingOpen(o => !o)}
                    style={styles.secondaryBtn}
                  >
                    {myRating ? 'Edit rating' : 'Rate this'}
                  </button>
                </>
              ) : (
                <Link to="/login" style={styles.primaryBtn}>Sign in to rate & collect</Link>
              )}
            </div>

            {/* Inline rating form */}
            {ratingOpen && user && (
              <RatingForm
                initial={myRating}
                onSubmit={(values) => ratingMutation.mutate(values)}
                onCancel={() => setRatingOpen(false)}
                loading={ratingMutation.isPending}
              />
            )}
          </div>
        </div>

        {/* Notes section */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Fragrance notes</h2>
          <div style={styles.noteTiers}>
            {[['top', 'Top notes'], ['middle', 'Heart notes'], ['base', 'Base notes']].map(([tier, label]) => (
              notes[tier].length > 0 && (
                <div key={tier}>
                  <p style={styles.noteTierLabel}>{label}</p>
                  <div style={styles.noteGrid}>
                    {notes[tier].map((note, i) => (
                      <NoteCard key={i} note={note} />
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        </section>

        {/* Layering recommendations */}
        {pairs.length > 0 && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Layer with</h2>
            <p style={styles.sectionSub}>Community-recommended pairings for {perfume.name}</p>
            <div style={styles.layerGrid}>
              {pairs.map((pair, i) => (
                <LayerCard key={i} pair={pair} />
              ))}
            </div>
          </section>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Reviews</h2>
            <div style={styles.reviewList}>
              {reviews.map((r, i) => (
                <div key={i} style={styles.reviewCard}>
                  <div style={styles.reviewMeta}>
                    <StarRow score={r.score} small />
                    <div style={styles.reviewBadges}>
                      {r.sillage  && <MiniTag>{SILLAGE_MAP[r.sillage]}</MiniTag>}
                      {r.gender   && <MiniTag>{GENDER_MAP[r.gender]}</MiniTag>}
                      {r.season   && <MiniTag>{SEASON_MAP[r.season]}</MiniTag>}
                    </div>
                  </div>
                  <p style={styles.reviewText}>{r.review}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NoteCard({ note }) {
  return (
    <div className="note-card" style={styles.noteCard}>
      <div style={styles.noteImg}>
        {note?.photo_url
          ? <img src={note.photo_url} alt={note.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
          : <span style={{ fontSize: 20 }}>🌿</span>
        }
      </div>
      <p style={styles.noteName}>{note?.name}</p>
      {note?.scent_family && <p style={styles.noteFamily}>{note.scent_family}</p>}
    </div>
  )
}

function LayerCard({ pair }) {
  const navigate = useNavigate()
  return (
    <div
      className="layer-card"
      onClick={() => navigate(`/perfume/${pair.other?.perfume_id}`)}
      style={styles.layerCard}
    >
      <div style={styles.layerImg}>
        {pair.other?.image_url
          ? <img src={pair.other.image_url} alt={pair.other.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
          : <span style={{ fontSize: 24 }}>🫧</span>
        }
      </div>
      <div style={styles.layerInfo}>
        <p style={styles.layerBrand}>{pair.other?.brands?.brand_name}</p>
        <p style={styles.layerName}>{pair.other?.name}</p>
        {pair.description && <p style={styles.layerDesc}>{pair.description}</p>}
        <p style={styles.layerVotes}>{pair.votes} {pair.votes === 1 ? 'vote' : 'votes'}</p>
      </div>
    </div>
  )
}

function Badge({ label, value }) {
  return (
    <div style={styles.badge}>
      <span style={styles.badgeLabel}>{label}</span>
      <span style={styles.badgeValue}>{value}</span>
    </div>
  )
}

function MiniTag({ children }) {
  return <span style={styles.miniTag}>{children}</span>
}

function StarRow({ score, small }) {
  const size = small ? 12 : 16
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 16 16">
          <path
            d="M8 1l1.85 3.75L14 5.5l-3 2.92.71 4.13L8 10.5l-3.71 1.95.71-4.13L2 5.5l4.15-.75z"
            fill={i <= Math.round(score / 2) ? '#C4845A' : '#E8DDD0'}
          />
        </svg>
      ))}
    </div>
  )
}

function RatingForm({ initial, onSubmit, onCancel, loading }) {
  const [values, setValues] = useState({
    score:    initial?.score    || 7,
    sillage:  initial?.sillage  || 'moderate',
    longevity:initial?.longevity|| 'moderate',
    gender:   initial?.gender   || 2,
    season:   initial?.season   || '',
    review:   initial?.review   || '',
  })
  const set = (k, v) => setValues(p => ({ ...p, [k]: v }))

  return (
    <div style={styles.ratingForm}>
      <p style={styles.ratingFormTitle}>Your rating</p>

      <div style={styles.ratingRow}>
        <label style={styles.ratingLabel}>Score: <strong>{values.score}/10</strong></label>
        <input type="range" min={1} max={10} step={1} value={values.score}
          onChange={e => set('score', parseInt(e.target.value))} style={{ flex: 1 }} />
      </div>

      <div style={styles.ratingGrid}>
        <div>
          <label style={styles.ratingLabel}>Sillage</label>
          <select value={values.sillage} onChange={e => set('sillage', e.target.value)} style={styles.ratingSelect}>
            {Object.entries(SILLAGE_MAP).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label style={styles.ratingLabel}>Longevity</label>
          <select value={values.longevity} onChange={e => set('longevity', e.target.value)} style={styles.ratingSelect}>
            {Object.entries(LONGEVITY_MAP).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label style={styles.ratingLabel}>Gender lean</label>
          <select value={values.gender} onChange={e => set('gender', parseInt(e.target.value))} style={styles.ratingSelect}>
            {Object.entries(GENDER_MAP).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label style={styles.ratingLabel}>Best season</label>
          <select value={values.season} onChange={e => set('season', parseInt(e.target.value))} style={styles.ratingSelect}>
            <option value="">–</option>
            {Object.entries(SEASON_MAP).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      <textarea
        placeholder="Write a review (optional)…"
        value={values.review}
        onChange={e => set('review', e.target.value)}
        rows={3}
        style={styles.reviewInput}
      />

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
        <button onClick={() => onSubmit(values)} disabled={loading} style={styles.submitRatingBtn}>
          {loading ? 'Saving…' : 'Save rating'}
        </button>
      </div>
    </div>
  )
}

function ImageFallback() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EDE4D8' }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#B8A898" strokeWidth="1">
        <path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8l-5-5z"/>
        <path d="M9 3v5h5"/><circle cx="12" cy="15" r="2"/>
      </svg>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: 1100, margin: '2rem auto', padding: '0 2.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '3rem' }}>
        <div style={{ background: '#EDE4D8', borderRadius: 16, aspectRatio: '3/4' }} className="skeleton" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: '1rem' }}>
          {[80, 200, 120, 160, 100].map((w, i) => (
            <div key={i} style={{ height: i === 1 ? 40 : 16, width: w, background: '#EDE4D8', borderRadius: 4 }} className="skeleton" />
          ))}
        </div>
      </div>
    </div>
  )
}

function ErrorState({ onBack }) {
  return (
    <div style={{ textAlign: 'center', padding: '6rem 2rem' }}>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: '#2C2018' }}>Perfume not found</p>
      <button onClick={onBack} style={{ marginTop: 16, padding: '8px 20px', background: '#C4845A', color: '#fff', border: 'none', borderRadius: 20, cursor: 'pointer' }}>
        Back to catalogue
      </button>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  page: { maxWidth: 1100, margin: '0 auto', padding: '1.5rem 2.5rem 4rem' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: '2rem' },
  breadLink: { fontSize: 13, color: '#9A8878', textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" },
  breadSep: { color: '#C4B8A8', fontSize: 13 },
  breadCurrent: { fontSize: 13, color: '#5C4A38', fontFamily: "'DM Sans', sans-serif" },
  hero: { display: 'grid', gridTemplateColumns: '340px 1fr', gap: '3.5rem', marginBottom: '3.5rem', alignItems: 'start' },
  imageCol: {},
  imageWrap: { borderRadius: 16, overflow: 'hidden', aspectRatio: '3/4', background: '#EDE4D8', position: 'relative' },
  image: { width: '100%', height: '100%', objectFit: 'cover' },
  concBadge: { position: 'absolute', top: 12, left: 12, background: 'rgba(253,250,246,.9)', color: '#7A6A58', fontSize: 10, fontWeight: 500, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: "'DM Sans', sans-serif" },
  infoCol: { paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: 14 },
  brandLink: { fontSize: 12, fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9A8878', textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" },
  title: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 400, color: '#2C2018', margin: 0, lineHeight: 1.1 },
  meta: { fontSize: 13, color: '#9A8878', margin: 0, fontFamily: "'DM Sans', sans-serif" },
  scoreRow: { display: 'flex', alignItems: 'center', gap: 14 },
  scoreBig: { fontFamily: "'Cormorant Garamond', serif", fontSize: 48, fontWeight: 300, color: '#C4845A', lineHeight: 1 },
  ratingCount: { fontSize: 12, color: '#9A8878', margin: '4px 0 0', fontFamily: "'DM Sans', sans-serif" },
  badgeRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  badge: { background: '#EDE4D8', borderRadius: 10, padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 2 },
  badgeLabel: { fontSize: 10, color: '#9A8878', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: "'DM Sans', sans-serif" },
  badgeValue: { fontSize: 13, fontWeight: 500, color: '#2C2018', fontFamily: "'DM Sans', sans-serif" },
  description: { fontSize: 14, color: '#5C4A38', lineHeight: 1.7, margin: 0, fontFamily: "'DM Sans', sans-serif" },
  actions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  primaryBtn: { padding: '10px 20px', background: '#C4845A', color: '#FDF8F2', border: 'none', borderRadius: 24, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textDecoration: 'none', display: 'inline-block' },
  secondaryBtn: { padding: '10px 20px', background: 'transparent', color: '#5C4A38', border: '0.5px solid #E0D4C4', borderRadius: 24, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  section: { marginBottom: '3rem' },
  sectionTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, color: '#2C2018', margin: '0 0 6px' },
  sectionSub: { fontSize: 13, color: '#9A8878', margin: '0 0 20px', fontFamily: "'DM Sans', sans-serif" },
  noteTiers: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  noteTierLabel: { fontSize: 11, fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9A8878', margin: '0 0 10px', fontFamily: "'DM Sans', sans-serif" },
  noteGrid: { display: 'flex', flexWrap: 'wrap', gap: 10 },
  noteCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 14px', background: '#FDFAF6', border: '0.5px solid #E8DDD0', borderRadius: 12, cursor: 'default', transition: 'border-color .15s, transform .15s', minWidth: 80 },
  noteImg: { width: 48, height: 48, borderRadius: 8, background: '#EDE4D8', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  noteName: { fontSize: 12, fontWeight: 500, color: '#2C2018', margin: 0, textAlign: 'center', fontFamily: "'DM Sans', sans-serif" },
  noteFamily: { fontSize: 10, color: '#9A8878', margin: 0, fontFamily: "'DM Sans', sans-serif" },
  layerGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' },
  layerCard: { display: 'flex', gap: 12, padding: '14px', background: '#FDFAF6', border: '0.5px solid #E8DDD0', borderRadius: 12, cursor: 'pointer', transition: 'border-color .15s', alignItems: 'flex-start' },
  layerImg: { width: 56, height: 56, borderRadius: 8, background: '#EDE4D8', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  layerInfo: { flex: 1, minWidth: 0 },
  layerBrand: { fontSize: 10, color: '#9A8878', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: "'DM Sans', sans-serif" },
  layerName: { fontSize: 13, fontWeight: 500, color: '#2C2018', margin: '0 0 4px', fontFamily: "'Cormorant Garamond', serif" },
  layerDesc: { fontSize: 12, color: '#7A6A58', margin: '0 0 4px', fontFamily: "'DM Sans', sans-serif" },
  layerVotes: { fontSize: 11, color: '#9A8878', margin: 0, fontFamily: "'DM Sans', sans-serif" },
  reviewList: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  reviewCard: { padding: '16px 20px', background: '#FDFAF6', border: '0.5px solid #E8DDD0', borderRadius: 12 },
  reviewMeta: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' },
  reviewBadges: { display: 'flex', gap: 6 },
  reviewText: { fontSize: 14, color: '#5C4A38', margin: 0, lineHeight: 1.65, fontFamily: "'DM Sans', sans-serif" },
  miniTag: { fontSize: 11, padding: '2px 8px', background: '#EDE4D8', color: '#7A6A58', borderRadius: 20, fontFamily: "'DM Sans', sans-serif" },
  ratingForm: { background: '#FDFAF6', border: '0.5px solid #E0D4C4', borderRadius: 12, padding: '16px', marginTop: 4 },
  ratingFormTitle: { fontSize: 13, fontWeight: 500, color: '#2C2018', margin: '0 0 14px', fontFamily: "'DM Sans', sans-serif" },
  ratingRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  ratingLabel: { fontSize: 12, color: '#7A6A58', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' },
  ratingGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 },
  ratingSelect: { width: '100%', padding: '6px 8px', border: '0.5px solid #E0D4C4', borderRadius: 8, background: '#FDFAF6', color: '#2C2018', fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginTop: 4 },
  reviewInput: { width: '100%', padding: '8px 10px', border: '0.5px solid #E0D4C4', borderRadius: 8, background: '#FDFAF6', color: '#2C2018', fontSize: 13, fontFamily: "'DM Sans', sans-serif", resize: 'vertical' },
  cancelBtn: { padding: '7px 16px', border: '0.5px solid #E0D4C4', borderRadius: 20, background: 'none', color: '#5C4A38', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  submitRatingBtn: { padding: '7px 16px', border: 'none', borderRadius: 20, background: '#C4845A', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
}