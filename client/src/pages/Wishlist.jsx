import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'

async function fetchWishlist(userId) {
  const { data, error } = await supabase
    .from('wishlists')
    .select(`
      *,
      perfumes (
        perfume_id, name, image_url, concentration, release_date,
        brands ( brand_id, brand_name ),
        perfume_notes ( note_type, notes ( name, scent_family ) ),
        user_ratings ( score )
      )
    `)
    .eq('user_id', userId)
    .order('added_at', { ascending: false })
  if (error) throw error
  return data || []
}

function avgScore(ratings) {
  const scores = (ratings || []).filter(r => r.score).map(r => r.score)
  if (!scores.length) return null
  return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
}

export default function Wishlist() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['wishlist', user?.id],
    queryFn: () => fetchWishlist(user.id),
    enabled: !!user,
  })

  const removeMutation = useMutation({
    mutationFn: async (perfumeId) => {
      const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', user.id)
        .eq('perfume_id', perfumeId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries(['wishlist', user?.id]),
  })

  const moveToCollectionMutation = useMutation({
    mutationFn: async (perfumeId) => {
      await supabase
        .from('user_perfumes')
        .upsert({ user_id: user.id, perfume_id: perfumeId }, { onConflict: 'user_id,perfume_id' })
      await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', user.id)
        .eq('perfume_id', perfumeId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['wishlist', user?.id])
      queryClient.invalidateQueries(['collection', user?.id])
    },
  })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        body { background: #F7F2EC; font-family: 'DM Sans', sans-serif; }
        .wish-card:hover { border-color: #D4B89A !important; transform: translateY(-2px); }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div style={styles.page}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Saved for later</p>
            <h1 style={styles.title}>My wishlist</h1>
          </div>
          <Link to="/" style={styles.browseBtn}>Browse catalogue</Link>
        </div>

        {isLoading && (
          <div style={styles.grid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ background: '#EDE4D8', borderRadius: 14, aspectRatio: '3/4' }} />
            ))}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div style={styles.empty}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C4B8A8" strokeWidth="1">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
            <p style={styles.emptyTitle}>Your wishlist is empty</p>
            <p style={styles.emptySub}>Save perfumes you want to try or buy.</p>
            <Link to="/" style={styles.browseBtn}>Browse catalogue</Link>
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <>
            <p style={styles.count}>{items.length} {items.length === 1 ? 'fragrance' : 'fragrances'}</p>
            <div style={styles.grid}>
              {items.map((item, i) => {
                const p = item.perfumes
                const score = avgScore(p?.user_ratings)
                return (
                  <div
                    key={item.perfume_id || i}
                    className="wish-card"
                    style={{ ...styles.card, animationDelay: `${i * 40}ms` }}
                  >
                    {/* Image */}
                    <div
                      style={styles.imageWrap}
                      onClick={() => navigate(`/perfume/${p?.perfume_id}`)}
                    >
                      {p?.image_url
                        ? <img src={p.image_url} alt={p.name} style={styles.image} />
                        : <div style={styles.imageFallback}><span style={{ fontSize: 28 }}>🫧</span></div>
                      }
                      {score && <div style={styles.scoreBadge}>{score}</div>}
                      {p?.concentration && <div style={styles.concBadge}>{p.concentration}</div>}
                    </div>

                    {/* Info */}
                    <div style={styles.cardBody}>
                      <p style={styles.brandName}>{p?.brands?.brand_name}</p>
                      <p
                        style={styles.perfumeName}
                        onClick={() => navigate(`/perfume/${p?.perfume_id}`)}
                      >
                        {p?.name}
                      </p>

                      {/* Note chips */}
                      <div style={styles.notes}>
                        {(p?.perfume_notes || []).slice(0, 3).map((pn, j) => (
                          <span key={j} style={styles.noteChip}>{pn.notes?.name}</span>
                        ))}
                      </div>

                      {/* Added date */}
                      <p style={styles.addedDate}>
                        Added {new Date(item.added_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>

                      {/* Actions */}
                      <div style={styles.cardActions}>
                        <button
                          onClick={() => moveToCollectionMutation.mutate(p?.perfume_id)}
                          style={styles.moveBtn}
                          disabled={moveToCollectionMutation.isPending}
                        >
                          Move to collection
                        </button>
                        <button
                          onClick={() => removeMutation.mutate(p?.perfume_id)}
                          style={styles.removeBtn}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </>
  )
}

const styles = {
  page: { maxWidth: 1100, margin: '0 auto', padding: '2rem 2.5rem 4rem' },
  header: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '2rem' },
  eyebrow: { fontSize: 11, fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A8878', margin: '0 0 8px', fontFamily: "'DM Sans', sans-serif" },
  title: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 40, fontWeight: 300, color: '#2C2018', margin: 0 },
  browseBtn: { padding: '9px 20px', background: '#C4845A', color: '#FDF8F2', borderRadius: 24, fontSize: 13, fontWeight: 500, textDecoration: 'none', fontFamily: "'DM Sans', sans-serif", display: 'inline-block' },
  count: { fontSize: 12, color: '#9A8878', margin: '0 0 16px', fontFamily: "'DM Sans', sans-serif" },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' },
  card: { background: '#FDFAF6', border: '0.5px solid #E8DDD0', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform .2s, border-color .2s', animation: 'fadeUp .3s ease both' },
  imageWrap: { position: 'relative', aspectRatio: '3/4', background: '#EDE4D8', cursor: 'pointer', overflow: 'hidden' },
  image: { width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .4s ease' },
  imageFallback: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  scoreBadge: { position: 'absolute', top: 10, right: 10, background: 'rgba(40,30,20,.75)', color: '#F5EFE6', fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 20, fontFamily: "'DM Sans', sans-serif" },
  concBadge: { position: 'absolute', top: 10, left: 10, background: 'rgba(253,250,246,.9)', color: '#7A6A58', fontSize: 10, padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: "'DM Sans', sans-serif" },
  cardBody: { padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 },
  brandName: { fontSize: 11, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9A8878', margin: 0, fontFamily: "'DM Sans', sans-serif" },
  perfumeName: { fontSize: 15, fontWeight: 500, color: '#2C2018', margin: 0, lineHeight: 1.3, cursor: 'pointer', fontFamily: "'Cormorant Garamond', serif" },
  notes: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  noteChip: { fontSize: 11, color: '#7A6A58', background: '#EDE4D8', padding: '2px 8px', borderRadius: 20, fontFamily: "'DM Sans', sans-serif" },
  addedDate: { fontSize: 11, color: '#B8A898', margin: 0, fontFamily: "'DM Sans', sans-serif" },
  cardActions: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 },
  moveBtn: { padding: '7px 0', background: '#C4845A', color: '#FDF8F2', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  removeBtn: { padding: '7px 0', background: 'none', color: '#9A8878', border: '0.5px solid #E0D4C4', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  empty: { textAlign: 'center', padding: '5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  emptyTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: '#2C2018', margin: 0 },
  emptySub: { fontSize: 14, color: '#9A8878', margin: 0, fontFamily: "'DM Sans', sans-serif" },
}
