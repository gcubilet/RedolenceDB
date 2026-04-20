import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'
import { Navigate } from 'react-router-dom'

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const [isAdmin, setIsAdmin] = useState(null)
  const [perfumes, setPerfumes] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(defaultForm())

  function defaultForm() {
    return { name: '', brand_id: '', year: '', concentration: 'EDP',
             description: '', image_url: '', top_notes: '',
             middle_notes: '', base_notes: '' }
  }

  useEffect(() => {
    checkAdmin()
    fetchPerfumes()
  }, [])

  async function checkAdmin() {
    const { data } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .single()
    setIsAdmin(!!data)
  }

  async function fetchPerfumes() {
    const { data } = await supabase
      .from('perfumes')
      .select('*, brands(name)')
      .ilike('name', `%${search}%`)
      .order('created_at', { ascending: false })
    setPerfumes(data || [])
  }

  async function savePerfume() {
    const payload = {
      name: form.name,
      brand_id: form.brand_id,
      year: parseInt(form.year) || null,
      concentration: form.concentration,
      description: form.description,
      image_url: form.image_url,
    }

    if (editTarget) {
      await supabase.from('perfumes').update(payload).eq('id', editTarget.id)
    } else {
      const { data: perf } = await supabase.from('perfumes').insert(payload).select().single()
      // Save notes as separate rows in perfume_notes
      await saveNotes(perf.id)
    }
    setModalOpen(false)
    setEditTarget(null)
    setForm(defaultForm())
    fetchPerfumes()
  }

  async function saveNotes(perfumeId) {
    const noteRows = []
    for (const [pos, raw] of [['top', form.top_notes], ['middle', form.middle_notes], ['base', form.base_notes]]) {
      for (const name of raw.split(',').map(s => s.trim()).filter(Boolean)) {
        // Upsert note, then create perfume_notes row
        const { data: note } = await supabase
          .from('notes')
          .upsert({ name }, { onConflict: 'name' })
          .select('id')
          .single()
        noteRows.push({ perfume_id: perfumeId, note_id: note.id, position: pos })
      }
    }
    if (noteRows.length) await supabase.from('perfume_notes').insert(noteRows)
  }

  async function deletePerfume(id) {
    if (!confirm('Delete this perfume?')) return
    await supabase.from('perfumes').delete().eq('id', id)
    fetchPerfumes()
  }

  function openEdit(p) {
    setEditTarget(p)
    setForm({ name: p.name, brand_id: p.brand_id, year: p.year,
              concentration: p.concentration, description: p.description,
              image_url: p.image_url, top_notes: '', middle_notes: '', base_notes: '' })
    setModalOpen(true)
  }

  if (isAdmin === false) return <Navigate to="/" />
  if (isAdmin === null) return <div>Checking access…</div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>Admin — Perfume management</h1>

      <div style={{ display: 'flex', gap: 12, margin: '1.5rem 0' }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); fetchPerfumes() }}
          placeholder="Search perfumes…"
          style={{ flex: 1 }}
        />
        <button onClick={() => { setEditTarget(null); setForm(defaultForm()); setModalOpen(true) }}>
          + Add perfume
        </button>
      </div>

      <table style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Name</th><th>Brand</th><th>Year</th>
            <th>Concentration</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {perfumes.map(p => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.brands?.name}</td>
              <td>{p.year}</td>
              <td>{p.concentration}</td>
              <td>
                <button onClick={() => openEdit(p)}>Edit</button>
                <button onClick={() => deletePerfume(p.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalOpen && (
        <PerfumeModal
          form={form}
          setForm={setForm}
          onSave={savePerfume}
          onClose={() => { setModalOpen(false); setEditTarget(null) }}
          isEdit={!!editTarget}
        />
      )}
    </div>
  )
}

function PerfumeModal({ form, setForm, onSave, onClose, isEdit }) {
  const f = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{isEdit ? 'Edit perfume' : 'Add new perfume'}</h3>
        <div className="form-grid">
          <input value={form.name} onChange={f('name')} placeholder="Perfume name" />
          <input value={form.brand_id} onChange={f('brand_id')} placeholder="Brand ID (UUID)" />
          <select value={form.concentration} onChange={f('concentration')}>
            {['EDP','EDT','Parfum','Cologne'].map(c => <option key={c}>{c}</option>)}
          </select>
          <input value={form.year} onChange={f('year')} type="number" placeholder="Year" />
          <textarea value={form.description} onChange={f('description')} placeholder="Description" />
          <input value={form.image_url} onChange={f('image_url')} placeholder="Image URL" />
          <input value={form.top_notes} onChange={f('top_notes')} placeholder="Top notes (comma separated)" />
          <input value={form.middle_notes} onChange={f('middle_notes')} placeholder="Middle notes" />
          <input value={form.base_notes} onChange={f('base_notes')} placeholder="Base notes" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose}>Cancel</button>
          <button onClick={onSave}>{isEdit ? 'Update' : 'Create'}</button>
        </div>
      </div>
    </div>
  )
}