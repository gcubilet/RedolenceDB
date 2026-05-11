import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'

const SEASON_MAP  = { Spring: 'Spring', Summer: 'Summer', Autumn: 'Autumn', Winter: 'Winter' }
const GENDER_MAP  = {
  feminine: 'Feminine', slightly_feminine: 'Slightly feminine',
  unisex: 'Unisex', slightly_masculine: 'Slightly masculine', masculine: 'Masculine',
}
const SILLAGE_MAP = { intimate: 'Intimate', moderate: 'Moderate', strong: 'Strong', enormous: 'Enormous' }

async function fetchProfileData(userId) {
  const [profileRes, collectionRes, ratingsRes, ratingsCountRes, wishlistRes, quizRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).single(),
    supabase.from('user_perfumes').select(`
      perfume_id, purchase_date, added_at,
      perfumes ( perfume_id, name, image_url, brands ( brand_name ) )
    `).eq('user_id', userId).order('added_at', { ascending: false }),
    // ✓ correct column names: gender_lean, best_season; include review
    supabase.from('user_ratings').select(`
      score, sillage, longevity, gender_lean, best_season, review, created_at,
      perfumes ( perfume_id, name, image_url, brands ( brand_name ) )
    `).eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
    // separate count query so the stat isn't capped at 5
    supabase.from('user_ratings').select('user_id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('wishlists').select('perfume_id').eq('user_id', userId),
    supabase.from('quiz_responses').select('profile_tags, completed_at').eq('user_id', userId).single(),
  ])

  return {
    profile:      profileRes.data,
    collection:   collectionRes.data    || [],
    ratings:      ratingsRes.data       || [],
    ratingsCount: ratingsCountRes.count ?? 0,
    wishlistCount: (wishlistRes.data    || []).length,
    quiz:         quizRes.data,
  }
}

export default function Profile() {
  const { user, setProfile } = useAuthStore()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', age: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['profile-page', user?.id],
    queryFn: () => fetchProfileData(user.id),
    enabled: !!user,
    onSuccess: (d) => {
      setForm({ name: d.profile?.name || '', age: d.profile?.age || '' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (values) => {
      const { data: updated, error } = await supabase
        .from('profiles')
        .update({ name: values.name, age: parseInt(values.age) || null })
        .eq('user_id', user.id)
        .select()
        .single()
      if (error) throw error
      return updated
    },
    onSuccess: (updated) => {
      setProfile(updated)
      queryClient.invalidateQueries(['profile-page', user?.id])
      setEditing(false)
    },
  })

  if (isLoading) return <LoadingSkeleton />

  const { profile, collection, ratings, ratingsCount, wishlistCount, quiz } = data || {}
  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?'

  // Stats — use the full count, and all 5 recent ratings for averages
  const avgScore = (() => {
    const scores = (ratings || []).filter(r => r.score).map(r => r.score)
    if (!scores.length) return null
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
  })()

  const favSeason = (() => {
    const freq = {}
    ;(ratings || []).forEach(r => {
      const seasons = Array.isArray(r.best_season) ? r.best_season : []
      seasons.forEach(s => { if (s) freq[s] = (freq[s] || 0) + 1 })
    })
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]
    return top ? SEASON_MAP[top[0]] ?? top[0] : null
  })()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        body { background: #F7F2EC; font-family: 'DM Sans', sans-serif; }
        .recent-row:hover { background: #F5EFE6 !important; }
      `}</style>

      <div style={styles.page}>

        {/* Profile card */}
        <div style={styles.profileCard}>
          <div style={styles.avatarLarge}>{initials}</div>
          <div style={styles.profileInfo}>
            {editing ? (
              <div style={styles.editForm}>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Your name"
                  style={styles.editInput}
                />
                <input
                  value={form.age}
                  onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                  placeholder="Age"
                  type="number"
                  style={{ ...styles.editInput, width: 80 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => updateMutation.mutate(form)} style={styles.saveBtn} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(false)} style={styles.cancelBtn}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <h1 style={styles.profileName}>{profile?.name || 'Your profile'}</h1>
                <p style={styles.profileMeta}>
                  {user?.email}
                  {profile?.age ? ` · Age ${profile.age}` : ''}
                </p>
                <button
                  onClick={() => { setEditing(true); setForm({ name: profile?.name || '', age: profile?.age || '' }) }}
                  style={styles.editBtn}
                >
                  Edit profile
                </button>
              </>
            )}
          </div>

          {/* Quick stats — ratingsCount is the real total */}
          <div style={styles.quickStats}>
            <QuickStat label="In collection"    value={collection.length} to="/my-collection" />
            <QuickStat label="On wishlist"       value={wishlistCount}     to="/wishlist" />
            <QuickStat label="Ratings given"     value={ratingsCount}      />
            {avgScore  && <QuickStat label="Avg score given"  value={avgScore} />}
            {favSeason && <QuickStat label="Favourite season" value={favSeason} />}
          </div>
        </div>

        <div style={styles.columns}>

          {/* Left: recent ratings + reviews */}
          <div style={styles.leftCol}>
            <SectionHeader title="Recent ratings" action={{ label: 'View collection', to: '/my-collection' }} />
            {ratings.length === 0 ? (
              <EmptyBlock text="You haven't rated any perfumes yet." />
            ) : (
              <div style={styles.ratingList}>
                {ratings.map((r, i) => {
                  // best_season is text[] — grab the first entry for display
                  const season = Array.isArray(r.best_season) ? r.best_season[0] : r.best_season
                  return (
                    <Link
                      key={i}
                      to={`/perfume/${r.perfumes?.perfume_id}`}
                      className="recent-row"
                      style={styles.ratingRow}
                    >
                      <div style={styles.ratingThumb}>
                        {r.perfumes?.image_url
                          ? <img src={r.perfumes.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                          : <span style={{ fontSize: 14 }}>🫧</span>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={styles.ratingPerfume}>{r.perfumes?.name}</p>
                        <p style={styles.ratingBrand}>{r.perfumes?.brands?.brand_name}</p>
                        {r.review && (
                          <p style={styles.ratingReview}>"{r.review}"</p>
                        )}
                      </div>
                      <div style={styles.ratingMeta}>
                        {r.score   && <span style={styles.scoreChip}>{r.score}/5</span>}
                        {season    && <span style={styles.metaChip}>{SEASON_MAP[season] ?? season}</span>}
                        {r.sillage && <span style={styles.metaChip}>{SILLAGE_MAP[r.sillage]}</span>}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right: scent profile + recent collection */}
          <div style={styles.rightCol}>

            {/* Scent profile from quiz */}
            <div style={styles.block}>
              <SectionHeader title="Scent profile" action={{ label: quiz ? 'Retake quiz' : 'Take quiz', to: '/onboarding' }} />
              {quiz?.profile_tags?.length > 0 ? (
                <>
                  <div style={styles.tagCloud}>
                    {quiz.profile_tags.map(tag => (
                      <span key={tag} style={styles.profileTag}>{tag}</span>
                    ))}
                  </div>
                  <p style={styles.quizDate}>
                    Last updated {new Date(quiz.completed_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </p>
                  <Link to="/recommendations" style={styles.recLink}>
                    View your matches →
                  </Link>
                </>
              ) : (
                <EmptyBlock text="Complete the quiz to build your scent profile." />
              )}
            </div>

            {/* Recently added to collection */}
            <div style={styles.block}>
              <SectionHeader title="Recently added" action={{ label: 'View all', to: '/my-collection' }} />
              {collection.length === 0 ? (
                <EmptyBlock text="No perfumes in your collection yet." />
              ) : (
                <div style={styles.recentGrid}>
                  {collection.slice(0, 6).map((item, i) => (
                    <Link
                      key={i}
                      to={`/perfume/${item.perfumes?.perfume_id}`}
                      style={styles.recentCard}
                    >
                      <div style={styles.recentImg}>
                        {item.perfumes?.image_url
                          ? <img src={item.perfumes.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                          : <span style={{ fontSize: 18 }}>🫧</span>
                        }
                      </div>
                      <p style={styles.recentName}>{item.perfumes?.name}</p>
                      <p style={styles.recentBrand}>{item.perfumes?.brands?.brand_name}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function SectionHeader({ title, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 400, color: '#2C2018', margin: 0 }}>{title}</h2>
      {action && <Link to={action.to} style={{ fontSize: 12, color: '#7F77DD', textDecoration: 'none', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{action.label}</Link>}
    </div>
  )
}

function QuickStat({ label, value, to }) {
  const inner = (
    <div style={styles.qStat}>
      <p style={styles.qStatVal}>{value}</p>
      <p style={styles.qStatLabel}>{label}</p>
    </div>
  )
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{inner}</Link> : inner
}

function EmptyBlock({ text }) {
  return <p style={{ fontSize: 13, color: '#9A8878', fontFamily: "'DM Sans', sans-serif", margin: 0 }}>{text}</p>
}

function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: 1000, margin: '2rem auto', padding: '0 2.5rem' }}>
      <div style={{ height: 140, background: '#EDE4D8', borderRadius: 16, marginBottom: '2rem' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div style={{ height: 300, background: '#EDE4D8', borderRadius: 14 }} />
        <div style={{ height: 300, background: '#EDE4D8', borderRadius: 14 }} />
      </div>
    </div>
  )
}

const styles = {
  page: { maxWidth: 1000, margin: '0 auto', padding: '2rem 2.5rem 4rem' },
  profileCard: { background: '#FDFAF6', border: '0.5px solid #E8DDD0', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem', flexWrap: 'wrap' },
  avatarLarge: { width: 48, height: 48, borderRadius: '50%', background: '#7F77DD', color: '#FDF8F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", flexShrink: 0 },
  profileInfo: { flex: 1, minWidth: 160 },
  profileName: { fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 400, color: '#2C2018', margin: '0 0 2px' },
  profileMeta: { fontSize: 12, color: '#9A8878', margin: '0 0 6px', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  editBtn: { padding: '3px 12px', border: '0.5px solid #E0D4C4', borderRadius: 20, background: 'none', color: '#5C4A38', fontSize: 11, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  editForm: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  editInput: { padding: '6px 10px', border: '0.5px solid #E0D4C4', borderRadius: 8, background: '#fff', color: '#2C2018', fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: 'none', width: 180 },
  saveBtn: { padding: '6px 14px', border: 'none', borderRadius: 20, background: '#7F77DD', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  cancelBtn: { padding: '6px 14px', border: '0.5px solid #E0D4C4', borderRadius: 20, background: 'none', color: '#5C4A38', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  quickStats: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  qStat: { background: '#F0E8DC', borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'baseline', gap: 6 },
  qStatVal: { fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: '#7F77DD', margin: 0, lineHeight: 1 },
  qStatLabel: { fontSize: 10, color: '#9A8878', margin: 0, textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: "'DM Sans', sans-serif" },
  columns: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' },
  leftCol: { background: '#FDFAF6', border: '0.5px solid #E8DDD0', borderRadius: 14, padding: '20px' },
  rightCol: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  block: { background: '#FDFAF6', border: '0.5px solid #E8DDD0', borderRadius: 14, padding: '20px' },
  ratingList: { display: 'flex', flexDirection: 'column', gap: 2 },
  ratingRow: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 8px', borderRadius: 8, textDecoration: 'none', transition: 'background .15s' },
  ratingThumb: { width: 36, height: 36, borderRadius: 6, background: '#EDE4D8', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: 2 },
  ratingPerfume: { fontSize: 13, fontWeight: 500, color: '#2C2018', margin: '0 0 2px', fontFamily: "'Cormorant Garamond', serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  ratingBrand: { fontSize: 11, color: '#9A8878', margin: '0 0 4px', fontFamily: "'DM Sans', sans-serif" },
  ratingReview: { fontSize: 12, color: '#7A6A58', margin: 0, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  ratingMeta: { display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 },
  scoreChip: { fontSize: 11, padding: '2px 7px', background: '#EDE4D8', color: '#7F77DD', borderRadius: 20, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" },
  metaChip: { fontSize: 11, padding: '2px 7px', background: '#EDE4D8', color: '#7A6A58', borderRadius: 20, fontFamily: "'DM Sans', sans-serif" },
  tagCloud: { display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 },
  profileTag: { background: '#EDE4D8', color: '#5C4A38', fontSize: 12, padding: '4px 12px', borderRadius: 20, fontFamily: "'DM Sans', sans-serif" },
  quizDate: { fontSize: 11, color: '#B8A898', margin: '0 0 10px', fontFamily: "'DM Sans', sans-serif" },
  recLink: { fontSize: 12, color: '#7F77DD', textDecoration: 'none', fontWeight: 500, fontFamily: "'DM Sans', sans-serif" },
  recentGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  recentCard: { textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 5 },
  recentImg: { aspectRatio: '1', background: '#EDE4D8', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  recentName: { fontSize: 11, fontWeight: 500, color: '#2C2018', margin: 0, lineHeight: 1.2, fontFamily: "'Cormorant Garamond', serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  recentBrand: { fontSize: 10, color: '#9A8878', margin: 0, fontFamily: "'DM Sans', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
}