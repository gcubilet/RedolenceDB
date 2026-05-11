import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'

async function fetchCollection(userId) {
  const { data, error } = await supabase
    .from('user_perfumes')
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

export default function MyCollection() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editItem, setEditItem] = useState(null)
  const [search, setSearch] = useState('')

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['collection', user?.id],
    queryFn: () => fetchCollection(user.id),
    enabled: !!user,
  })

  const removeMutation = useMutation({
    mutationFn: async (perfumeId) => {
      const { error } = await supabase
        .from('user_perfumes')
        .delete()
        .eq('user_id', user.id)
        .eq('perfume_id', perfumeId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries(['collection', user?.id]),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ perfumeId, values }) => {
      const { error } = await supabase
        .from('user_perfumes')
        .update({
          purchase_date:  values.purchase_date  || null,
          bottle_size_ml: values.bottle_size_ml ? parseInt(values.bottle_size_ml)    : null,
          purchase_price: values.purchase_price ? parseFloat(values.purchase_price)  : null,
          personal_notes: values.personal_notes || null,
        })
        .eq('user_id', user.id)
        .eq('perfume_id', perfumeId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['collection', user?.id])
      setEditItem(null)
    },
  })

  const filtered = items.filter(item =>
    item.perfumes?.name?.toLowerCase().includes(search.toLowerCase()) ||
    item.perfumes?.brands?.brand_name?.toLowerCase().includes(search.toLowerCase())
  )

  const totalValue = items.reduce((sum, i) => sum + (parseFloat(i.purchase_price) || 0), 0)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        body { background: #F7F2EC; font-family: 'DM Sans', sans-serif; }
        .collection-row:hover { background: #F5EFE6 !important; }
        .remove-btn:hover { color: #C05A3A !important; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div style={styles.page}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Your collection</p>
            <h1 style={styles.title}>My fragrances</h1>
          </div>
          <Link to="/" style={styles.addBtn}>+ Add perfumes</Link>
        </div>

        {/* Stats */}
        {items.length > 0 && (
          <div style={styles.statsRow}>
            <StatCard label="Total bottles" value={items.length} />
            <StatCard label="Brands" value={new Set(items.map(i => i.perfumes?.brands?.brand_id)).size} />
            <StatCard label="Collection value" value={totalValue > 0 ? `$${totalValue.toFixed(0)}` : '—'} />
          </div>
        )}

        {/* Search */}
        {items.length > 0 && (
          <div style={styles.searchWrap}>
            <svg style={styles.searchIcon} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l3.5 3.5" strokeLinecap="round"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search your collection…"
              style={styles.searchInput}
            />
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div style={styles.tableWrap}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ height: 64, background: '#EDE4D8', borderRadius: 8, marginBottom: 8, opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && items.length === 0 && (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C4B8A8" strokeWidth="1">
                <path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8l-5-5z"/>
                <path d="M9 3v5h5"/><circle cx="12" cy="15" r="2"/>
              </svg>
            </div>
            <p style={styles.emptyTitle}>Your collection is empty</p>
            <p style={styles.emptySub}>Browse the catalogue and add perfumes you own.</p>
            <Link to="/" style={styles.addBtn}>Browse catalogue</Link>
          </div>
        )}

        {/* Table */}
        {!isLoading && filtered.length > 0 && (
          <div style={styles.tableWrap}>
            <div style={styles.tableHeader}>
              <span style={{ flex: 3 }}>Perfume</span>
              <span style={{ flex: 1.5, textAlign: 'center' }}>Purchase date</span>
              <span style={{ flex: 1, textAlign: 'center' }}>Size</span>
              <span style={{ flex: 1, textAlign: 'center' }}>Price</span>
              <span style={{ flex: 1, textAlign: 'center' }}>Score</span>
              <span style={{ flex: 1.5, textAlign: 'right' }}>Actions</span>
            </div>

            {filtered.map((item, i) => {
              const p = item.perfumes
              const score = avgScore(p?.user_ratings)
              return (
                <div key={`${item.user_id}-${item.perfume_id}`} className="collection-row" style={styles.tableRow}>
                  {/* Perfume info */}
                  <div style={{ flex: 3, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={styles.thumb}>
                      {p?.image_url
                        ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                        : <span style={{ fontSize: 16 }}>🫧</span>
                      }
                    </div>
                    <div>
                      <p
                        onClick={() => navigate(`/perfume/${p?.perfume_id}`)}
                        style={styles.perfumeName}
                      >
                        {p?.name}
                      </p>
                      <p style={styles.brandName}>{p?.brands?.brand_name}</p>
                      {item.personal_notes && (
                        <p style={styles.personalNotes}>{item.personal_notes}</p>
                      )}
                    </div>
                  </div>

                  <span style={{ flex: 1.5, textAlign: 'center', fontSize: 13, color: '#7A6A58' }}>
                    {item.purchase_date ? new Date(item.purchase_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </span>
                  <span style={{ flex: 1, textAlign: 'center', fontSize: 13, color: '#7A6A58' }}>
                    {item.bottle_size_ml ? `${item.bottle_size_ml}ml` : '—'}
                  </span>
                  <span style={{ flex: 1, textAlign: 'center', fontSize: 13, color: '#7A6A58' }}>
                    {item.purchase_price ? `$${parseFloat(item.purchase_price).toFixed(0)}` : '—'}
                  </span>
                  <span style={{ flex: 1, textAlign: 'center', fontSize: 13, color: '#C4845A', fontWeight: 500 }}>
                    {score || '—'}
                  </span>

                  <div style={{ flex: 1.5, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => setEditItem(item)} style={styles.editBtn}>Edit</button>
                    <button
                      className="remove-btn"
                      onClick={() => removeMutation.mutate(p?.perfume_id)}
                      style={styles.removeBtn}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* No search results */}
        {!isLoading && items.length > 0 && filtered.length === 0 && (
          <p style={{ color: '#9A8878', fontSize: 14, textAlign: 'center', padding: '2rem' }}>
            No perfumes match "{search}"
          </p>
        )}
      </div>

      {/* Edit modal */}
      {editItem && (
        <EditModal
          item={editItem}
          onSave={(values) => updateMutation.mutate({ perfumeId: editItem.perfumes?.perfume_id, values })}
          onClose={() => setEditItem(null)}
          loading={updateMutation.isPending}
        />
      )}
    </>
  )
}

function StatCard({ label, value }) {
  return (
    <div style={styles.statCard}>
      <p style={styles.statLabel}>{label}</p>
      <p style={styles.statValue}>{value}</p>
    </div>
  )
}

function EditModal({ item, onSave, onClose, loading }) {
  const [form, setForm] = useState({
    purchase_date:  item.purchase_date  || '',
    bottle_size_ml: item.bottle_size_ml || '',
    purchase_price: item.purchase_price || '',
    personal_notes: item.personal_notes || '',
  })
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <h3 style={styles.modalTitle}>Edit — {item.perfumes?.name}</h3>
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Purchase date</label>
            <input type="date" value={form.purchase_date} onChange={f('purchase_date')} style={styles.formInput} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Bottle size (ml)</label>
            <input type="number" value={form.bottle_size_ml} onChange={f('bottle_size_ml')} placeholder="50" style={styles.formInput} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Purchase price ($)</label>
            <input type="number" value={form.purchase_price} onChange={f('purchase_price')} placeholder="0.00" step="0.01" style={styles.formInput} />
          </div>
          <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
            <label style={styles.formLabel}>Personal notes</label>
            <textarea value={form.personal_notes} onChange={f('personal_notes')} rows={3} placeholder="Any notes about this bottle…" style={{ ...styles.formInput, resize: 'vertical' }} />
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button onClick={() => onSave(form)} disabled={loading} style={styles.saveBtn}>
            {loading ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: { maxWidth: 1100, margin: '0 auto', padding: '2rem 2.5rem 4rem' },
  header: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '2rem' },
  eyebrow: { fontSize: 11, fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A8878', margin: '0 0 8px', fontFamily: "'DM Sans', sans-serif" },
  title: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 40, fontWeight: 300, color: '#2C2018', margin: 0 },
  addBtn: { padding: '9px 20px', background: '#7F77DD', color: '#FDF8F2', borderRadius: 24, fontSize: 13, fontWeight: 500, textDecoration: 'none', fontFamily: "'DM Sans', sans-serif", border: 'none', cursor: 'pointer', display: 'inline-block' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '1.5rem' },
  statCard: { background: '#FDFAF6', border: '0.5px solid #E8DDD0', borderRadius: 12, padding: '16px 20px' },
  statLabel: { fontSize: 11, color: '#9A8878', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 6px', fontFamily: "'DM Sans', sans-serif" },
  statValue: { fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 400, color: '#C4845A', margin: 0, lineHeight: 1 },
  searchWrap: { position: 'relative', marginBottom: '1.25rem', maxWidth: 360 },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#9A8878' },
  searchInput: { width: '100%', padding: '8px 12px 8px 36px', border: '0.5px solid #E0D4C4', borderRadius: 10, background: '#FDFAF6', color: '#2C2018', fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: 'none' },
  tableWrap: { background: '#FDFAF6', border: '0.5px solid #E8DDD0', borderRadius: 14, overflow: 'hidden' },
  tableHeader: { display: 'flex', alignItems: 'center', padding: '10px 20px', background: '#F0E8DC', borderBottom: '0.5px solid #E8DDD0', fontSize: 11, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9A8878', fontFamily: "'DM Sans', sans-serif" },
  tableRow: { display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '0.5px solid #EDE4D8', transition: 'background .15s', cursor: 'default' },
  thumb: { width: 40, height: 40, borderRadius: 6, background: '#EDE4D8', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  perfumeName: { fontSize: 14, fontWeight: 500, color: '#2C2018', margin: '0 0 2px', fontFamily: "'Cormorant Garamond', serif", cursor: 'pointer', lineHeight: 1.2 },
  brandName: { fontSize: 11, color: '#9A8878', margin: 0, fontFamily: "'DM Sans', sans-serif" },
  personalNotes: { fontSize: 11, color: '#7A6A58', margin: '4px 0 0', fontFamily: "'DM Sans', sans-serif", fontStyle: 'italic', lineHeight: 1.4, maxWidth: 260, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' },
  editBtn: { padding: '4px 12px', border: '0.5px solid #E0D4C4', borderRadius: 20, background: 'none', color: '#5C4A38', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  removeBtn: { padding: '4px 12px', border: 'none', borderRadius: 20, background: 'none', color: '#9A8878', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'color .15s' },
  empty: { textAlign: 'center', padding: '5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  emptyIcon: { marginBottom: 4 },
  emptyTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: '#2C2018', margin: 0 },
  emptySub: { fontSize: 14, color: '#9A8878', margin: 0, fontFamily: "'DM Sans', sans-serif" },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(44,32,24,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' },
  modal: { background: '#FDFAF6', border: '0.5px solid #E0D4C4', borderRadius: 16, padding: '24px', width: '100%', maxWidth: 460 },
  modalTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 400, color: '#2C2018', margin: '0 0 20px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  formGroup: { display: 'flex', flexDirection: 'column', gap: 5 },
  formLabel: { fontSize: 12, color: '#7A6A58', fontWeight: 500, fontFamily: "'DM Sans', sans-serif" },
  formInput: { padding: '7px 10px', border: '0.5px solid #E0D4C4', borderRadius: 8, background: '#fff', color: '#2C2018', fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: 'none', width: '100%' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '0.5px solid #E8DDD0' },
  cancelBtn: { padding: '8px 18px', border: '0.5px solid #E0D4C4', borderRadius: 20, background: 'none', color: '#5C4A38', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  saveBtn: { padding: '8px 18px', border: 'none', borderRadius: 20, background: '#C4845A', color: '#FDF8F2', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 },
}