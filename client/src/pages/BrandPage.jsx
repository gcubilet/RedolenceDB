import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import PerfumeCard from '../components/perfume/PerfumeCard'

async function fetchBrand(id) {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('brand_id', id)
    .single()
  if (error) throw error
  return data
}

async function fetchBrandPerfumes(id) {
  const { data, error } = await supabase
    .from('perfumes')
    .select(`
      perfume_id, name, image_url, concentration, release_date,
      brands ( brand_id, brand_name ),
      perfume_notes ( note_type, notes ( name, scent_family ) ),
      user_ratings ( score )
    `)
    .eq('brand_id', id)
    .order('release_date', { ascending: false })
  if (error) throw error
  return data || []
}

export default function BrandPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: brand, isLoading: brandLoading } = useQuery({
    queryKey: ['brand', id],
    queryFn: () => fetchBrand(id),
  })

  const { data: perfumes = [], isLoading: perfumesLoading } = useQuery({
    queryKey: ['brand-perfumes', id],
    queryFn: () => fetchBrandPerfumes(id),
    enabled: !!id,
  })

  const isLoading = brandLoading || perfumesLoading

  if (isLoading) return <LoadingSkeleton />
  if (!brand) return (
    <div style={{ textAlign: 'center', padding: '6rem 2rem' }}>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: '#2C2018' }}>Brand not found</p>
      <button onClick={() => navigate('/')} style={styles.backBtn}>Back to catalogue</button>
    </div>
  )

  const avgScore = (() => {
    const scores = perfumes.flatMap(p => p.user_ratings?.filter(r => r.score).map(r => r.score) || [])
    if (!scores.length) return null
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
  })()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        body { background: #F7F2EC; font-family: 'DM Sans', sans-serif; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div style={styles.page}>
        {/* Breadcrumb */}
        <div style={styles.breadcrumb}>
          <Link to="/" style={styles.breadLink}>Catalogue</Link>
          <span style={styles.breadSep}>/</span>
          <span style={styles.breadCurrent}>{brand.brand_name}</span>
        </div>

        {/* Brand hero */}
        <div style={styles.hero}>
          <div style={styles.logoWrap}>
            {brand.logo_url
              ? <img src={brand.logo_url} alt={brand.brand_name} style={styles.logo} />
              : <div style={styles.logoFallback}>{brand.brand_name.slice(0, 2).toUpperCase()}</div>
            }
          </div>

          <div style={styles.heroInfo}>
            <h1 style={styles.brandName}>{brand.brand_name}</h1>
            {brand.country && <p style={styles.country}>{brand.country}</p>}
            {brand.description && <p style={styles.description}>{brand.description}</p>}

            <div style={styles.statsRow}>
              <Stat label="Fragrances" value={perfumes.length} />
              {avgScore && <Stat label="Avg. score" value={avgScore} />}
            </div>
          </div>
        </div>

        {/* Perfumes grid */}
        <div style={styles.gridSection}>
          <h2 style={styles.gridTitle}>
            {perfumes.length === 1 ? '1 fragrance' : `${perfumes.length} fragrances`}
          </h2>

          {perfumes.length === 0 ? (
            <div style={styles.empty}>
              <p style={styles.emptyText}>No perfumes listed for this brand yet.</p>
            </div>
          ) : (
            <div style={styles.grid}>
              {perfumes.map((p, i) => (
                <PerfumeCard key={p.perfume_id} perfume={p} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Stat({ label, value }) {
  return (
    <div style={styles.stat}>
      <span style={styles.statValue}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: 1100, margin: '2rem auto', padding: '0 2.5rem' }}>
      <div style={{ display: 'flex', gap: '2rem', marginBottom: '3rem', alignItems: 'center' }}>
        <div style={{ width: 100, height: 100, borderRadius: 16, background: '#EDE4D8' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ height: 36, width: 200, background: '#EDE4D8', borderRadius: 4 }} />
          <div style={{ height: 14, width: 120, background: '#EDE4D8', borderRadius: 4 }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ background: '#EDE4D8', borderRadius: 12, aspectRatio: '3/4' }} />
        ))}
      </div>
    </div>
  )
}

const styles = {
  page: { maxWidth: 1100, margin: '0 auto', padding: '1.5rem 2.5rem 4rem' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: '2rem' },
  breadLink: { fontSize: 13, color: '#9A8878', textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" },
  breadSep: { color: '#C4B8A8', fontSize: 13 },
  breadCurrent: { fontSize: 13, color: '#5C4A38', fontFamily: "'DM Sans', sans-serif" },
  hero: { display: 'flex', gap: '2rem', alignItems: 'flex-start', marginBottom: '3rem', padding: '2rem', background: '#FDFAF6', border: '0.5px solid #E8DDD0', borderRadius: 16 },
  logoWrap: { flexShrink: 0 },
  logo: { width: 100, height: 100, objectFit: 'contain', borderRadius: 12, border: '0.5px solid #E8DDD0' },
  logoFallback: { width: 100, height: 100, borderRadius: 12, background: '#EDE4D8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: '#7A6A58' },
  heroInfo: { flex: 1 },
  brandName: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 400, color: '#2C2018', margin: '0 0 4px', lineHeight: 1.1 },
  country: { fontSize: 13, color: '#9A8878', margin: '0 0 12px', fontFamily: "'DM Sans', sans-serif" },
  description: { fontSize: 14, color: '#5C4A38', lineHeight: 1.7, margin: '0 0 16px', maxWidth: 600, fontFamily: "'DM Sans', sans-serif" },
  statsRow: { display: 'flex', gap: '1.5rem' },
  stat: { display: 'flex', flexDirection: 'column', gap: 2 },
  statValue: { fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, color: '#C4845A', lineHeight: 1 },
  statLabel: { fontSize: 11, color: '#9A8878', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: "'DM Sans', sans-serif" },
  gridSection: {},
  gridTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 400, color: '#2C2018', margin: '0 0 1.25rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem' },
  empty: { padding: '3rem', textAlign: 'center' },
  emptyText: { color: '#9A8878', fontSize: 14, fontFamily: "'DM Sans', sans-serif" },
  backBtn: { marginTop: 16, padding: '8px 20px', background: '#C4845A', color: '#fff', border: 'none', borderRadius: 20, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
}
