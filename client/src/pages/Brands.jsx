// pages/Brands.jsx
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Brands() {
  const navigate = useNavigate()

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const { data } = await supabase
        .from('brands')
        .select('brand_id, country, brand_name, logo_url')
        .order('brand_name')
      return data || []
    }
  })

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 2.5rem' }}>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: 40, color: '#2C2018', marginBottom: '2rem' }}>
        Brands
      </h1>
      {isLoading ? (
        <p style={{ color: '#9A8878', fontSize: 14 }}>Loading brands…</p>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {brands.map(b => (
          <div
            key={b.brand_id}
            onClick={() => navigate(`/brand/${b.brand_id}`)}
            style={{ background: '#FDFAF6', border: '0.5px solid #E8DDD0', borderRadius: 12, padding: '20px', cursor: 'pointer', transition: 'border-color .15s' }}
          >
            <p style={{ fontSize: 11, color: '#9A8878', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>{b.country}</p>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: '#2C2018', margin: 0 }}>{b.brand_name}</p>
          </div>
        ))}
      </div>
      )}
    </div>
  )
}