import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'

async function fetchStats() {
  const [perfumes, brands, users, ratings] = await Promise.all([
    supabase.from('perfumes').select('perfume_id', { count: 'exact', head: true }),
    supabase.from('brands').select('brand_id', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('user_ratings').select('user_id', { count: 'exact', head: true }),
  ])
  return {
    perfumes: perfumes.count || 0,
    brands:   brands.count   || 0,
    users:    users.count    || 0,
    ratings:  ratings.count  || 0,
  }
}

async function fetchPerfumes(search = '') {
  let q = supabase
    .from('perfumes')
    .select(`
      perfume_id, name, concentration, release_date, discontinued, description, image_url, tags,
      brands(brand_id, country, brand_name),
      perfume_notes (
        note_type,
        notes!perfume_notes_note_name_fkey ( name )
      )
    `)
    .order('name')
  if (search) q = q.ilike('name', `%${search}%`)
  const { data } = await q
  return data || []
}

async function fetchBrands() {
  const { data } = await supabase.from('brands').select('*').order('brand_name')
  return data || []
}

async function fetchReviews() {
  const { data } = await supabase
    .from('user_ratings')
    .select(`
      user_id, perfume_id, review, score, created_at,
      perfumes ( name ),
      profiles ( name )
    `)
    .not('review', 'is', null)
    .order('created_at', { ascending: false })
  return data || []
}

async function fetchNotes(search = '') {
  let q = supabase
    .from('notes')
    .select('name, scent_family, photo_url, description')
    .order('name')
  if (search) q = q.ilike('name', `%${search}%`)
  const { data } = await q
  return data || []
}

async function fetchAdminLayeringPairs() {
  const { data } = await supabase
    .from('layering_pairs')
    .select(`
      id, votes, description, created_at,
      perfume_a:perfumes!layering_pairs_perfume_a_id_fkey ( perfume_id, name, brands(brand_name) ),
      perfume_b:perfumes!layering_pairs_perfume_b_id_fkey ( perfume_id, name, brands(brand_name) )
    `)
    .order('votes', { ascending: false })
  return data || []
}

const SCENT_FAMILIES = [
  'Floral', 'Woody', 'Oriental', 'Fresh', 'Citrus', 'Fougère',
  'Chypre', 'Gourmand', 'Aquatic', 'Spicy', 'Aromatic', 'Green',
  'Powdery', 'Fruity', 'Leather', 'Musk', 'Resinous', 'Earthy',
]

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const [isAdmin, setIsAdmin] = useState(null)
  const [activeTab, setActiveTab] = useState('perfumes')

  useEffect(() => {
    if (!user) return
    supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => setIsAdmin(!!data))
  }, [user])

  if (isAdmin === null) return <div style={styles.loading}>Checking access…</div>
  if (isAdmin === false) return <Navigate to="/" replace />

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        body { background: #F7F2EC; font-family: 'DM Sans', sans-serif; }
        .tab-btn:hover:not(.active-tab) { color: #5C4A38 !important; }
        .table-row:hover td { background: #F5EFE6 !important; }
        .action-link:hover { color: #7F77DD !important; }
        .danger-link:hover { color: #C05A3A !important; }
      `}</style>

      <div style={styles.page}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Admin</p>
            <h1 style={styles.title}>Dashboard</h1>
          </div>
          <StatsRow />
        </div>

        <div style={styles.tabs}>
          {[
            { key: 'perfumes', label: 'Perfumes' },
            { key: 'brands',   label: 'Brands' },
            { key: 'notes',    label: 'Notes' },
            { key: 'layering', label: 'Layering pairs' },
            { key: 'reviews',  label: 'Review moderation' },
          ].map(tab => (
            <button
              key={tab.key}
              className={`tab-btn${activeTab === tab.key ? ' active-tab' : ''}`}
              onClick={() => setActiveTab(tab.key)}
              style={{ ...styles.tab, ...(activeTab === tab.key ? styles.tabActive : {}) }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={styles.tabContent}>
          {activeTab === 'perfumes' && <PerfumesTab />}
          {activeTab === 'brands'   && <BrandsTab />}
          {activeTab === 'notes'    && <NotesTab />}
          {activeTab === 'layering' && <LayeringTab />}
          {activeTab === 'reviews'  && <ReviewsTab />}
        </div>
      </div>
    </>
  )
}

function StatsRow() {
  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: fetchStats })
  return (
    <div style={styles.statsRow}>
      {[
        { label: 'Perfumes', value: stats?.perfumes },
        { label: 'Brands',   value: stats?.brands },
        { label: 'Users',    value: stats?.users },
        { label: 'Ratings',  value: stats?.ratings },
      ].map(s => (
        <div key={s.label} style={styles.statCard}>
          <p style={styles.statLabel}>{s.label}</p>
          <p style={styles.statValue}>{s.value ?? '…'}</p>
        </div>
      ))}
    </div>
  )
}

function PerfumesTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)

  const { data: perfumes = [], isLoading } = useQuery({
    queryKey: ['admin-perfumes', search],
    queryFn: () => fetchPerfumes(search),
  })
  const { data: brands = [] } = useQuery({ queryKey: ['brands'], queryFn: fetchBrands })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('perfumes').delete().eq('perfume_id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-perfumes'] }),
  })

  return (
    <div>
      <div style={styles.toolbar}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search perfumes…" />
        <button onClick={() => setModal({ mode: 'add' })} style={styles.primaryBtn}>
          + Add perfume
        </button>
      </div>

      {isLoading ? <TableSkeleton /> : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <Th>Name</Th><Th>Brand</Th><Th>Concentration</Th><Th>Year</Th>
                <Th>Status</Th><Th>Tags</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {perfumes.length === 0 && (
                <tr><td colSpan={7} style={styles.emptyCell}>No perfumes found.</td></tr>
              )}
              {perfumes.map(p => (
                <tr key={p.perfume_id} className="table-row">
                  <Td bold>{p.name}</Td>
                  <Td muted>{p.brands?.brand_name}</Td>
                  <Td>{p.concentration && <ConcentrationBadge c={p.concentration} />}</Td>
                  <Td muted>{p.release_date ? new Date(p.release_date).getFullYear() : '—'}</Td>
                  <td style={styles.td}>
                    {p.discontinued
                      ? <span style={styles.discontinuedPill}>Discontinued {new Date(p.discontinued).getFullYear()}</span>
                      : <span style={styles.activePill}>Active</span>
                    }
                  </td>
                  <td style={styles.td}>
                    {(p.tags || []).map(tag => (
                      <span key={tag} style={styles.tagPill}>{tag}</span>
                    ))}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <button className="action-link" onClick={() => setModal({ mode: 'edit', data: p })} style={styles.tableAction}>Edit</button>
                    <button className="danger-link" onClick={() => {
                      if (window.confirm(`Delete "${p.name}"? This cannot be undone.`)) deleteMutation.mutate(p.perfume_id)
                    }} style={{ ...styles.tableAction, color: '#9A8878' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <PerfumeModal
          mode={modal.mode}
          initial={modal.data}
          brands={brands}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            queryClient.invalidateQueries({ queryKey: ['admin-perfumes'] })
            queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
          }}
        />
      )}
    </div>
  )
}

const CONCENTRATION_OPTIONS = [
  { value: 'Extrait de parfum', short: 'Parfum' },
  { value: 'Eau de parfum',     short: 'EDP' },
  { value: 'Eau de toilette',   short: 'EDT' },
  { value: 'Eau friche',        short: 'Fraîche' },
]

function PerfumeModal({ mode, initial, brands, onClose, onSaved }) {
  const initialNotesByTier = { top: [], middle: [], base: [] }
  ;(initial?.perfume_notes || []).forEach(pn => {
    const tier = pn.note_type
    const name = pn.notes?.name
    if (tier && name && initialNotesByTier[tier]) initialNotesByTier[tier].push(name)
  })

  const [form, setForm] = useState({
    name:          initial?.name                || '',
    brand_id:      initial?.brands?.brand_id    || '',
    concentration: initial?.concentration       || 'Eau de parfum',
    release_date:  initial?.release_date        || '',
    discontinued:  initial?.discontinued        || '',
    description:   initial?.description         || '',
    image_url:     initial?.image_url           || '',
    tags:          (initial?.tags || []).join(', '),
    top_notes:     initialNotesByTier.top.join(', '),
    middle_notes:  initialNotesByTier.middle.join(', '),
    base_notes:    initialNotesByTier.base.join(', '),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function save() {
    if (!form.name.trim())  return setError('Name is required.')
    if (!form.brand_id)     return setError('Brand is required.')
    setSaving(true)
    setError('')

    try {
      const payload = {
        name:          form.name.trim(),
        brand_id:      parseInt(form.brand_id),
        concentration: form.concentration || null,
        release_date:  form.release_date  || null,
        discontinued:  form.discontinued  || null,
        description:   form.description   || null,
        image_url:     form.image_url     || null,
        tags:          form.tags
          ? form.tags.split(',').map(t => t.trim()).filter(Boolean)
          : [],
      }

      if (mode === 'edit') {
        const { data, error } = await supabase
          .from('perfumes')
          .update(payload)
          .eq('perfume_id', initial.perfume_id)
          .select()
        console.log('perfume edit:', data, error)
        if (error) throw error

        const { error: notesError } = await saveNotes(initial.perfume_id, form, true)
        if (notesError) throw notesError

      } else {
        const { data, error } = await supabase
          .from('perfumes')
          .insert(payload)
          .select('perfume_id')
          .single()
        console.log('perfume insert:', data, error)
        if (error) throw error

        const { error: notesError } = await saveNotes(data.perfume_id, form, false)
        if (notesError) throw notesError
      }

      onSaved()
    } catch (err) {
      console.error('Perfume save failed:', err)
      setError(err.message || 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={mode === 'edit' ? `Edit — ${initial?.name}` : 'Add new perfume'} onClose={onClose}>
      <div style={styles.formGrid}>
        <FormField label="Perfume name" full>
          <input value={form.name} onChange={f('name')} placeholder="e.g. Baccarat Rouge 540" style={styles.input} />
        </FormField>
        <FormField label="Brand">
          <select value={form.brand_id} onChange={f('brand_id')} style={styles.input}>
            <option value="">Select brand…</option>
            {brands.map(b => <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>)}
          </select>
        </FormField>
        <FormField label="Concentration">
          <select value={form.concentration} onChange={f('concentration')} style={styles.input}>
            {CONCENTRATION_OPTIONS.map(c => (
              <option key={c.value} value={c.value}>{c.short} — {c.value}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Release date">
          <input type="date" value={form.release_date} onChange={f('release_date')} style={styles.input} />
        </FormField>
        <FormField label="Discontinued date">
          <input type="date" value={form.discontinued} onChange={f('discontinued')} style={styles.input} />
        </FormField>
        <FormField label="Image URL" full>
          <input value={form.image_url} onChange={f('image_url')} placeholder="https://…" style={styles.input} />
        </FormField>
        <FormField label="Tags" full>
          <input value={form.tags} onChange={f('tags')} placeholder="e.g. woody, fresh, summer, unisex…" style={styles.input} />
        </FormField>
        <FormField label="Description" full>
          <textarea value={form.description} onChange={f('description')} rows={3} placeholder="Short description…" style={{ ...styles.input, resize: 'vertical' }} />
        </FormField>
        <FormField label="Top notes">
          <input value={form.top_notes} onChange={f('top_notes')} placeholder="Bergamot, Saffron…" style={styles.input} />
        </FormField>
        <FormField label="Middle notes">
          <input value={form.middle_notes} onChange={f('middle_notes')} placeholder="Jasmine, Rose…" style={styles.input} />
        </FormField>
        <FormField label="Base notes" full>
          <input value={form.base_notes} onChange={f('base_notes')} placeholder="Cedarwood, Musk…" style={styles.input} />
        </FormField>
      </div>
      {error && <p style={styles.fieldError}>{error}</p>}
      <ModalFooter onClose={onClose} onSave={save} saving={saving} label={mode === 'edit' ? 'Save changes' : 'Add perfume'} />
    </Modal>
  )
}

async function saveNotes(perfumeId, form, replaceExisting = false) {
  if (replaceExisting) {
    const { error } = await supabase.from('perfume_notes').delete().eq('perfume_id', perfumeId)
    if (error) return { error }
  }
  const rows = []
  for (const [pos, raw] of [['top', form.top_notes], ['middle', form.middle_notes], ['base', form.base_notes]]) {
    for (const name of (raw || '').split(',').map(s => s.trim()).filter(Boolean)) {
      const { data: note, error: noteErr } = await supabase
        .from('notes')
        .upsert({ name }, { onConflict: 'name' })
        .select('name')
        .single()
      if (noteErr) return { error: noteErr }
      if (note) rows.push({ perfume_id: perfumeId, note_name: note.name, note_type: pos })
    }
  }
  if (rows.length) {
    // Deduplicate by perfume_id + note_name to avoid ON CONFLICT errors
    const seen = new Set()
    const uniqueRows = rows.filter(r => {
      const key = `${r.perfume_id}:${r.note_name}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    const { error } = await supabase
      .from('perfume_notes')
      .upsert(uniqueRows, { onConflict: 'perfume_id,note_name' })
    if (error) return { error }
  }
  return { error: null }
}

function BrandsTab() {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState(null)

  const { data: brands = [], isLoading } = useQuery({ queryKey: ['brands'], queryFn: fetchBrands })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('brands').delete().eq('brand_id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    },
  })

  return (
    <div>
      <div style={styles.toolbar}>
        <span style={{ fontSize: 13, color: '#9A8878', fontFamily: "'DM Sans', sans-serif" }}>
          {brands.length} brands
        </span>
        <button onClick={() => setModal({ mode: 'add' })} style={styles.primaryBtn}>
          + Add brand
        </button>
      </div>

      {isLoading ? <TableSkeleton /> : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <Th>Brand name</Th><Th>Country</Th><Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {brands.length === 0 && (
                <tr><td colSpan={3} style={styles.emptyCell}>No brands yet.</td></tr>
              )}
              {brands.map(b => (
                <tr key={b.brand_id} className="table-row">
                  <Td bold>{b.brand_name}</Td>
                  <Td muted>{b.country || '—'}</Td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <button className="action-link" onClick={() => setModal({ mode: 'edit', data: b })} style={styles.tableAction}>Edit</button>
                    <button className="danger-link" onClick={() => {
                      if (window.confirm(`Delete "${b.brand_name}"? All its perfumes will also be deleted.`)) deleteMutation.mutate(b.brand_id)
                    }} style={{ ...styles.tableAction, color: '#9A8878' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <BrandModal
          mode={modal.mode}
          initial={modal.data}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            queryClient.invalidateQueries({ queryKey: ['brands'] })
            queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
          }}
        />
      )}
    </div>
  )
}

function BrandModal({ mode, initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    brand_name:  initial?.brand_name  || '',
    country:     initial?.country     || '',
    description: initial?.description || '',
    logo_url:    initial?.logo_url    || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function save() {
    if (!form.brand_name.trim()) return setError('Brand name is required.')
    setSaving(true)
    setError('')

    try {
      const payload = {
        brand_name:  form.brand_name.trim(),
        country:     form.country     || null,
        description: form.description || null,
        logo_url:    form.logo_url    || null,
      }

      if (mode === 'edit') {
        const { data, error } = await supabase
          .from('brands')
          .update(payload)
          .eq('brand_id', initial.brand_id)
          .select()
        console.log('brand edit:', data, error)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('brands')
          .insert(payload)
          .select()
          .single()
        console.log('brand insert:', data, error)
        if (error) throw error
      }

      onSaved()
    } catch (err) {
      console.error('Brand save failed:', err)
      setError(err.message || 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={mode === 'edit' ? `Edit — ${initial?.brand_name}` : 'Add new brand'} onClose={onClose}>
      <div style={styles.formGrid}>
        <FormField label="Brand name" full>
          <input value={form.brand_name} onChange={f('brand_name')} placeholder="e.g. Chanel" style={styles.input} />
        </FormField>
        <FormField label="Country">
          <input value={form.country} onChange={f('country')} placeholder="e.g. France" style={styles.input} />
        </FormField>
        <FormField label="Logo URL">
          <input value={form.logo_url} onChange={f('logo_url')} placeholder="https://…" style={styles.input} />
        </FormField>
        <FormField label="Description" full>
          <textarea value={form.description} onChange={f('description')} rows={3} placeholder="About this brand…" style={{ ...styles.input, resize: 'vertical' }} />
        </FormField>
      </div>
      {error && <p style={styles.fieldError}>{error}</p>}
      <ModalFooter onClose={onClose} onSave={save} saving={saving} label={mode === 'edit' ? 'Save changes' : 'Add brand'} />
    </Modal>
  )
}

function NotesTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['admin-notes', search],
    queryFn: () => fetchNotes(search),
  })

  const deleteMutation = useMutation({
    mutationFn: async (name) => {
      const { error } = await supabase.from('notes').delete().eq('name', name)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-notes'] }),
  })

  return (
    <div>
      <div style={styles.toolbar}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search notes…" />
        <button onClick={() => setModal({ mode: 'add' })} style={styles.primaryBtn}>
          + Add note
        </button>
      </div>

      {isLoading ? <TableSkeleton /> : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <Th>Name</Th><Th>Scent family</Th><Th>Photo</Th><Th>Description</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {notes.length === 0 && (
                <tr><td colSpan={5} style={styles.emptyCell}>No notes found.</td></tr>
              )}
              {notes.map(n => (
                <tr key={n.name} className="table-row">
                  <Td bold>{n.name}</Td>
                  <Td>
                    {n.scent_family && (
                      <span style={styles.familyPill}>{n.scent_family}</span>
                    )}
                  </Td>
                  <td style={styles.td}>
                    {n.photo_url
                      ? <img src={n.photo_url} alt={n.name} style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', display: 'block' }} />
                      : <span style={{ color: '#C4B8A8', fontSize: 12 }}>—</span>
                    }
                  </td>
                  <td style={{ ...styles.td, maxWidth: 280 }}>
                    <p style={styles.reviewText}>{n.description || <span style={{ color: '#C4B8A8' }}>—</span>}</p>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <button className="action-link" onClick={() => setModal({ mode: 'edit', data: n })} style={styles.tableAction}>Edit</button>
                    <button className="danger-link" onClick={() => {
                      if (window.confirm(`Delete note "${n.name}"? It will be removed from all perfumes.`)) deleteMutation.mutate(n.name)
                    }} style={{ ...styles.tableAction, color: '#9A8878' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <NoteModal
          mode={modal.mode}
          initial={modal.data}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            queryClient.invalidateQueries({ queryKey: ['admin-notes'] })
          }}
        />
      )}
    </div>
  )
}

function NoteModal({ mode, initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:         initial?.name         || '',
    scent_family: initial?.scent_family || '',
    photo_url:    initial?.photo_url    || '',
    description:  initial?.description  || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function save() {
    if (!form.name.trim()) return setError('Name is required.')
    setSaving(true)
    setError('')

    try {
      const payload = {
        name:         form.name.trim(),
        scent_family: form.scent_family || null,
        photo_url:    form.photo_url    || null,
        description:  form.description  || null,
      }

      if (mode === 'edit') {
        // name is the PK — if the name changed we need to handle rename carefully
        if (form.name.trim() !== initial.name) {
          // Insert new, delete old (FK in perfume_notes uses note_name)
          const { error: insErr } = await supabase.from('notes').insert(payload)
          if (insErr) throw insErr
          // Update perfume_notes references
          const { error: refErr } = await supabase
            .from('perfume_notes')
            .update({ note_name: form.name.trim() })
            .eq('note_name', initial.name)
          if (refErr) throw refErr
          const { error: delErr } = await supabase.from('notes').delete().eq('name', initial.name)
          if (delErr) throw delErr
        } else {
          const { error } = await supabase
            .from('notes')
            .update({ scent_family: payload.scent_family, photo_url: payload.photo_url, description: payload.description })
            .eq('name', initial.name)
          if (error) throw error
        }
      } else {
        const { error } = await supabase.from('notes').insert(payload)
        if (error) throw error
      }

      onSaved()
    } catch (err) {
      console.error('Note save failed:', err)
      setError(err.message || 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={mode === 'edit' ? `Edit — ${initial?.name}` : 'Add new note'} onClose={onClose}>
      <div style={styles.formGrid}>
        <FormField label="Note name" full>
          <input value={form.name} onChange={f('name')} placeholder="e.g. Bergamot" style={styles.input} />
        </FormField>
        <FormField label="Scent family">
          <select value={form.scent_family} onChange={f('scent_family')} style={styles.input}>
            <option value="">Select family…</option>
            {SCENT_FAMILIES.map(fam => (
              <option key={fam} value={fam}>{fam}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Photo URL">
          <input value={form.photo_url} onChange={f('photo_url')} placeholder="https://…" style={styles.input} />
        </FormField>
        <FormField label="Description" full>
          <textarea value={form.description} onChange={f('description')} rows={3} placeholder="Describe the scent…" style={{ ...styles.input, resize: 'vertical' }} />
        </FormField>
      </div>
      {error && <p style={styles.fieldError}>{error}</p>}
      <ModalFooter onClose={onClose} onSave={save} saving={saving} label={mode === 'edit' ? 'Save changes' : 'Add note'} />
    </Modal>
  )
}

function LayeringTab() {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState(null)

  const { data: pairs = [], isLoading } = useQuery({
    queryKey: ['admin-layering'],
    queryFn: fetchAdminLayeringPairs,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('layering_pairs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-layering'] }),
  })

  return (
    <div>
      <div style={styles.toolbar}>
        <span style={{ fontSize: 13, color: '#9A8878', fontFamily: "'DM Sans', sans-serif" }}>
          {pairs.length} pairs
        </span>
      </div>

      {isLoading ? <TableSkeleton /> : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <Th>Perfume A</Th>
                <Th>Perfume B</Th>
                <Th>Votes</Th>
                <Th>Description</Th>
                <Th>Added</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {pairs.length === 0 && (
                <tr><td colSpan={6} style={styles.emptyCell}>No layering pairs yet.</td></tr>
              )}
              {pairs.map(pair => (
                <tr key={pair.id} className="table-row">
                  <td style={styles.td}>
                    <p style={{ margin: '0 0 1px', fontWeight: 500, color: '#2C2018', fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{pair.perfume_a?.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#9A8878', fontFamily: "'DM Sans', sans-serif" }}>{pair.perfume_a?.brands?.brand_name}</p>
                  </td>
                  <td style={styles.td}>
                    <p style={{ margin: '0 0 1px', fontWeight: 500, color: '#2C2018', fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>{pair.perfume_b?.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#9A8878', fontFamily: "'DM Sans', sans-serif" }}>{pair.perfume_b?.brands?.brand_name}</p>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.votesPill}>{pair.votes}</span>
                  </td>
                  <td style={{ ...styles.td, maxWidth: 260 }}>
                    <p style={styles.reviewText}>{pair.description || <span style={{ color: '#C4B8A8' }}>—</span>}</p>
                  </td>
                  <Td muted>
                    {pair.created_at ? new Date(pair.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </Td>
                  <td style={{ ...styles.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="action-link" onClick={() => setModal({ data: pair })} style={styles.tableAction}>Edit</button>
                    <button className="danger-link" onClick={() => {
                      if (window.confirm('Delete this layering pair? This cannot be undone.')) deleteMutation.mutate(pair.id)
                    }} style={{ ...styles.tableAction, color: '#9A8878' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <LayeringPairModal
          pair={modal.data}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            queryClient.invalidateQueries({ queryKey: ['admin-layering'] })
          }}
        />
      )}
    </div>
  )
}

function LayeringPairModal({ pair, onClose, onSaved }) {
  const [form, setForm] = useState({
    description: pair.description || '',
    votes:       pair.votes       || 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function save() {
    setSaving(true)
    setError('')
    try {
      const { error } = await supabase
        .from('layering_pairs')
        .update({
          description: form.description || null,
          votes:       parseInt(form.votes) || 0,
        })
        .eq('id', pair.id)
      if (error) throw error
      onSaved()
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const nameA = `${pair.perfume_a?.brands?.brand_name} — ${pair.perfume_a?.name}`
  const nameB = `${pair.perfume_b?.brands?.brand_name} — ${pair.perfume_b?.name}`

  return (
    <Modal title="Edit layering pair" onClose={onClose}>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: '#9A8878', margin: '0 0 6px', fontFamily: "'DM Sans', sans-serif", textTransform: 'uppercase', letterSpacing: '.05em' }}>Pair</p>
        <p style={{ fontSize: 13, color: '#2C2018', margin: '0 0 2px', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{nameA}</p>
        <p style={{ fontSize: 12, color: '#9A8878', margin: '0 0 2px', fontFamily: "'DM Sans', sans-serif" }}>+ {nameB}</p>
      </div>
      <div style={styles.formGrid}>
        <FormField label="Votes">
          <input
            type="number"
            min="0"
            value={form.votes}
            onChange={e => setForm(p => ({ ...p, votes: e.target.value }))}
            style={styles.input}
          />
        </FormField>
        <FormField label="Description" full>
          <textarea
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            rows={3}
            placeholder="Why do these layer well?"
            style={{ ...styles.input, resize: 'vertical' }}
          />
        </FormField>
      </div>
      {error && <p style={styles.fieldError}>{error}</p>}
      <ModalFooter onClose={onClose} onSave={save} saving={saving} label="Save changes" />
    </Modal>
  )
}

function ReviewsTab() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('')

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['admin-reviews'],
    queryFn: fetchReviews,
  })

  const removeReviewMutation = useMutation({
    mutationFn: async ({ userId, perfumeId }) => {
      const { error } = await supabase
        .from('user_ratings')
        .update({ review: null })
        .eq('user_id', userId)
        .eq('perfume_id', perfumeId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reviews'] }),
  })

  const deleteRatingMutation = useMutation({
    mutationFn: async ({ userId, perfumeId }) => {
      const { error } = await supabase
        .from('user_ratings')
        .delete()
        .eq('user_id', userId)
        .eq('perfume_id', perfumeId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    },
  })

  const filtered = reviews.filter(r =>
    !filter ||
    r.perfumes?.name?.toLowerCase().includes(filter.toLowerCase()) ||
    r.profiles?.name?.toLowerCase().includes(filter.toLowerCase()) ||
    r.review?.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div>
      <div style={styles.toolbar}>
        <SearchInput value={filter} onChange={setFilter} placeholder="Filter by perfume, user or text…" />
        <span style={{ fontSize: 13, color: '#9A8878', fontFamily: "'DM Sans', sans-serif" }}>
          {reviews.length} reviews
        </span>
      </div>

      {isLoading ? <TableSkeleton /> : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <Th>Perfume</Th><Th>User</Th><Th>Score</Th>
                <Th>Review</Th><Th>Date</Th><Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={styles.emptyCell}>No reviews found.</td></tr>
              )}
              {filtered.map((r, i) => (
                <tr key={i} className="table-row">
                  <Td bold>{r.perfumes?.name}</Td>
                  <Td muted>{r.profiles?.name || 'Unknown'}</Td>
                  <td style={styles.td}>
                    {r.score && <span style={styles.scorePill}>{r.score}/5</span>}
                  </td>
                  <td style={{ ...styles.td, maxWidth: 320 }}>
                    <p style={styles.reviewText}>{r.review}</p>
                  </td>
                  <Td muted>
                    {r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </Td>
                  <td style={{ ...styles.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="action-link" onClick={() => {
                      if (window.confirm('Remove review text? The score will be kept.')) {
                        removeReviewMutation.mutate({ userId: r.user_id, perfumeId: r.perfume_id })
                      }
                    }} style={styles.tableAction}>Remove review</button>
                    <button className="danger-link" onClick={() => {
                      if (window.confirm('Delete entire rating including score? Cannot be undone.')) {
                        deleteRatingMutation.mutate({ userId: r.user_id, perfumeId: r.perfume_id })
                      }
                    }} style={{ ...styles.tableAction, color: '#9A8878' }}>Delete rating</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>{title}</h3>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalFooter({ onClose, onSave, saving, label }) {
  return (
    <div style={styles.modalFooter}>
      <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
      <button onClick={onSave} disabled={saving} style={styles.saveBtn}>
        {saving ? 'Saving…' : label}
      </button>
    </div>
  )
}

function FormField({ label, children, full }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...(full ? { gridColumn: '1 / -1' } : {}) }}>
      <label style={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
      <svg style={styles.searchIcon} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l3.5 3.5" strokeLinecap="round"/>
      </svg>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={styles.searchInput} />
    </div>
  )
}

function Th({ children, align }) {
  return <th style={{ ...styles.th, textAlign: align || 'left' }}>{children}</th>
}

function Td({ children, bold, muted }) {
  return (
    <td style={{ ...styles.td, ...(bold ? { fontWeight: 500, color: '#2C2018' } : {}), ...(muted ? { color: '#9A8878' } : {}) }}>
      {children}
    </td>
  )
}

function ConcentrationBadge({ c }) {
  const map = {
    'Eau de parfum':     { bg: '#EEEDFE', color: '#3C3489', short: 'EDP' },
    'Eau de toilette':   { bg: '#E1F5EE', color: '#085041', short: 'EDT' },
    'Extrait de parfum': { bg: '#FAECE7', color: '#712B13', short: 'Parfum' },
    'Eau friche':        { bg: '#FAEEDA', color: '#633806', short: 'Fraîche' },
  }
  const s = map[c] || { bg: '#EDE4D8', color: '#5C4A38', short: c }
  return <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{s.short}</span>
}

function TableSkeleton() {
  return (
    <div style={styles.tableWrap}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ height: 48, background: i % 2 === 0 ? '#EDE4D8' : '#E8E0D4', opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  )
}

const styles = {
  page: { maxWidth: 1200, margin: '0 auto', padding: '2rem 2.5rem 4rem' },
  loading: { textAlign: 'center', padding: '4rem', color: '#9A8878', fontFamily: "'DM Sans', sans-serif" },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: 20 },
  eyebrow: { fontSize: 11, fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A8878', margin: '0 0 8px', fontFamily: "'DM Sans', sans-serif" },
  title: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 40, fontWeight: 300, color: '#2C2018', margin: 0 },
  statsRow: { display: 'flex', gap: 10 },
  statCard: { background: '#FDFAF6', border: '0.5px solid #E8DDD0', borderRadius: 10, padding: '12px 18px', minWidth: 90, textAlign: 'center' },
  statLabel: { fontSize: 10, color: '#9A8878', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 4px', fontFamily: "'DM Sans', sans-serif" },
  statValue: { fontFamily: "'Cormorant Garamond', serif", fontSize: 26, color: '#7F77DD', margin: 0, lineHeight: 1 },
  tabs: { display: 'flex', borderBottom: '0.5px solid #E8DDD0', marginBottom: '1.5rem' },
  tab: { padding: '10px 20px', fontSize: 13, fontWeight: 400, color: '#9A8878', cursor: 'pointer', background: 'none', border: 'none', borderBottom: '2px solid transparent', fontFamily: "'DM Sans', sans-serif", transition: 'color .15s, border-color .15s' },
  tabActive: { color: '#7F77DD', borderBottomColor: '#7F77DD', fontWeight: 500 },
  tabContent: {},
  toolbar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem', flexWrap: 'wrap' },
  primaryBtn: { padding: '8px 18px', background: '#7F77DD', color: '#FDF8F2', border: 'none', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 },
  searchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#9A8878' },
  searchInput: { width: '100%', padding: '7px 12px 7px 32px', border: '0.5px solid #E0D4C4', borderRadius: 8, background: '#FDFAF6', color: '#2C2018', fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: 'none' },
  tableWrap: { background: '#FDFAF6', border: '0.5px solid #E8DDD0', borderRadius: 12, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { padding: '9px 14px', background: '#F0E8DC', color: '#9A8878', fontSize: 11, fontWeight: 500, letterSpacing: '.05em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif", borderBottom: '0.5px solid #E8DDD0', whiteSpace: 'nowrap' },
  td: { padding: '11px 14px', borderBottom: '0.5px solid #EDE4D8', color: '#5C4A38', fontFamily: "'DM Sans', sans-serif", transition: 'background .12s' },
  emptyCell: { padding: '2rem', textAlign: 'center', color: '#9A8878', fontSize: 13, fontFamily: "'DM Sans', sans-serif" },
  tableAction: { background: 'none', border: 'none', fontSize: 12, color: '#7A6A58', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", padding: '2px 8px', transition: 'color .15s' },
  scorePill: { fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#EDE4D8', color: '#7F77DD', fontWeight: 500, fontFamily: "'DM Sans', sans-serif" },
  votesPill: { fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#EEEDFE', color: '#5C56B8', fontWeight: 500, fontFamily: "'DM Sans', sans-serif" },
  tagPill: { display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#EDE4D8', color: '#5C4A38', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, marginRight: 4, marginBottom: 2 },
  familyPill: { fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#E1F5EE', color: '#085041', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 },
  discontinuedPill: { fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#FAECE7', color: '#7A3020', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 },
  activePill: { fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#E1F5EE', color: '#085041', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 },
  reviewText: { fontSize: 13, color: '#5C4A38', margin: 0, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif", overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(44,32,24,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' },
  modal: { background: '#FDFAF6', border: '0.5px solid #E0D4C4', borderRadius: 16, padding: '24px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 400, color: '#2C2018', margin: 0 },
  closeBtn: { background: 'none', border: 'none', fontSize: 14, color: '#9A8878', cursor: 'pointer', padding: 4 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 },
  fieldLabel: { fontSize: 12, color: '#7A6A58', fontWeight: 500, fontFamily: "'DM Sans', sans-serif" },
  input: { padding: '7px 10px', border: '0.5px solid #E0D4C4', borderRadius: 8, background: '#fff', color: '#2C2018', fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: 'none', width: '100%' },
  fieldError: { fontSize: 13, color: 'var(--color-text-danger)', background: 'var(--color-background-danger)', padding: '8px 12px', borderRadius: 8, margin: '0 0 12px', fontFamily: "'DM Sans', sans-serif" },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '0.5px solid #E8DDD0' },
  cancelBtn: { padding: '8px 18px', border: '0.5px solid #E0D4C4', borderRadius: 20, background: 'none', color: '#5C4A38', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  saveBtn: { padding: '8px 18px', border: 'none', borderRadius: 20, background: '#7F77DD', color: '#FDF8F2', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 },
}