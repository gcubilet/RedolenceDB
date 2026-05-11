import { useState, useDeferredValue } from 'react'
import { usePerfumes, useFilterOptions } from '../hooks/usePerfumes'
import PerfumeCard from '../components/perfume/PerfumeCard'
import FilterPanel from '../components/ui/FilterPanel'

const CONCENTRATION_SHORT = {
  'Extrait de parfum': 'Parfum',
  'Eau de parfum':     'EDP',
  'Eau de toilette':   'EDT',
  'Eau friche':        'Fraîche',
}

const GENDER_LABELS = {
  feminine:  'Feminine',
  unisex:    'Unisex',
  masculine: 'Masculine',
}

const SORT_OPTIONS = [
  { value: 'name_asc',    label: 'Name A–Z' },
  { value: 'name_desc',   label: 'Name Z–A' },
  { value: 'newest',      label: 'Newest first' },
  { value: 'top_rated',   label: 'Top rated' },
]

function sortPerfumes(perfumes, sort) {
  const arr = [...perfumes]
  switch (sort) {
    case 'name_asc':   return arr.sort((a, b) => a.name.localeCompare(b.name))
    case 'name_desc':  return arr.sort((a, b) => b.name.localeCompare(a.name))
    case 'newest':     return arr.sort((a, b) => new Date(b.release_date) - new Date(a.release_date))
    case 'top_rated':  return arr.sort((a, b) => {
      const avg = p => {
        const scores = p.user_ratings?.filter(r => r.score).map(r => r.score) || []
        return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
      }
      return avg(b) - avg(a)
    })
    default: return arr
  }
}

export default function Catalogue() {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('name_asc')
  const [filters, setFilters] = useState({
    brand_id: '',
    note_family: '',
    concentration: '',
    season: '',
    gender: '',
  })
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const deferredSearch = useDeferredValue(search)
  const activeFilters = { ...filters, search: deferredSearch }

  const { data: perfumes = [], isLoading, isError } = usePerfumes(activeFilters)
  const { data: options } = useFilterOptions()

  const sorted = sortPerfumes(perfumes, sort)
  const activeFilterCount = Object.values(filters).filter(Boolean).length + (search ? 1 : 0)

  function clearFilters() {
    setFilters({ brand_id: '', note_family: '', concentration: '', season: '', gender: '' })
    setSearch('')
  }

  return (
    <>
      {/* Google Font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        * { box-sizing: border-box; }

        body {
          background: #F7F2EC;
          font-family: 'DM Sans', sans-serif;
        }

        .perfume-card:hover {
          transform: translateY(-4px);
          border-color: #D4B89A !important;
        }

        .perfume-card:hover img {
          transform: scale(1.04);
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }

        .skeleton {
          background: linear-gradient(90deg, #EDE4D8 25%, #E4D8CA 50%, #EDE4D8 75%);
          background-size: 400px 100%;
          animation: shimmer 1.4s ease infinite;
          border-radius: 12px;
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #F0E8DC; }
        ::-webkit-scrollbar-thumb { background: #D4B89A; border-radius: 3px; }
      `}</style>

      <div style={styles.page}>

        {/* Hero header */}
        <header style={styles.hero}>
          <p style={styles.heroEyebrow}>Fragrance catalogue</p>
          <h1 style={styles.heroTitle}>Discover your next signature scent</h1>
          <p style={styles.heroSub}>
            {isLoading ? '…' : `${perfumes.length} fragrances`}
          </p>
        </header>

        {/* Search + sort bar */}
        <div style={styles.toolbar}>
          <div style={styles.searchWrap}>
            <svg style={styles.searchIcon} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8.5" cy="8.5" r="5.5"/>
              <path d="M13 13l3.5 3.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search perfumes or brands…"
              style={styles.searchInput}
            />
            {search && (
              <button onClick={() => setSearch('')} style={styles.clearSearch}>✕</button>
            )}
          </div>

          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            style={styles.sortSelect}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Mobile filter toggle */}
          <button
            onClick={() => setMobileFiltersOpen(o => !o)}
            style={styles.mobileFilterBtn}
          >
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
        </div>

        {/* Active filter pills */}
        {activeFilterCount > 0 && (
          <div style={styles.activePills}>
            {search && <ActivePill label={`"${search}"`} onRemove={() => setSearch('')} />}
            {filters.concentration && <ActivePill label={CONCENTRATION_SHORT[filters.concentration] || filters.concentration} onRemove={() => setFilters(f => ({ ...f, concentration: '' }))} />}
            {filters.note_family && <ActivePill label={filters.note_family} onRemove={() => setFilters(f => ({ ...f, note_family: '' }))} />}
            {filters.season && <ActivePill label={filters.season} onRemove={() => setFilters(f => ({ ...f, season: '' }))} />}
            {filters.gender && <ActivePill label={GENDER_LABELS[filters.gender] || filters.gender} onRemove={() => setFilters(f => ({ ...f, gender: '' }))} />}
            {filters.brand_id && <ActivePill label={options?.brands?.find(b => String(b.brand_id) === String(filters.brand_id))?.brand_name || 'Brand'} onRemove={() => setFilters(f => ({ ...f, brand_id: '' }))} />}
            <button onClick={clearFilters} style={styles.clearAllBtn}>Clear all</button>
          </div>
        )}

        {/* Main layout */}
        <div style={styles.layout}>

          {/* Filter panel — desktop */}
          <div style={{ ...styles.filterDesktop, ...(mobileFiltersOpen ? styles.filterMobileOpen : {}) }}>
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              options={options}
              onClear={clearFilters}
            />
          </div>

          {/* Grid */}
          <main style={styles.main}>
            {isError && (
              <div style={styles.emptyState}>
                <p style={styles.emptyTitle}>Something went wrong</p>
                <p style={styles.emptySub}>Could not load perfumes. Check your Supabase connection.</p>
              </div>
            )}

            {isLoading && (
              <div style={styles.grid}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} style={styles.skeletonCard}>
                    <div className="skeleton" style={{ aspectRatio: '3/4', borderRadius: 12 }} />
                    <div style={{ padding: '14px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div className="skeleton" style={{ height: 10, width: '50%', borderRadius: 4 }} />
                      <div className="skeleton" style={{ height: 16, width: '80%', borderRadius: 4 }} />
                      <div className="skeleton" style={{ height: 10, width: '40%', borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && !isError && sorted.length === 0 && (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C4B8A8" strokeWidth="1">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
                  </svg>
                </div>
                <p style={styles.emptyTitle}>No perfumes found</p>
                <p style={styles.emptySub}>Try adjusting your filters or search term.</p>
                <button onClick={clearFilters} style={styles.resetBtn}>Reset filters</button>
              </div>
            )}

            {!isLoading && !isError && sorted.length > 0 && (
              <>
                <p style={styles.resultCount}>
                  {sorted.length} {sorted.length === 1 ? 'fragrance' : 'fragrances'}
                </p>
                <div style={styles.grid}>
                  {sorted.map((perfume, i) => (
                    <PerfumeCard key={perfume.perfume_id} perfume={perfume} index={i} />
                  ))}
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </>
  )
}

function ActivePill({ label, onRemove }) {
  return (
    <span style={styles.activePill}>
      {label}
      <button onClick={onRemove} style={styles.pillRemove}>✕</button>
    </span>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#F7F2EC',
    padding: '0 0 4rem',
  },
  hero: {
    padding: '3rem 2.5rem 2rem',
    maxWidth: 1200,
    margin: '0 auto',
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    color: '#9A8878',
    margin: '0 0 12px',
    fontFamily: "'DM Sans', sans-serif",
  },
  heroTitle: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: 'clamp(32px, 5vw, 32px)',
    fontWeight: 300,
    color: '#2C2018',
    margin: '0 0 12px',
    lineHeight: 1.15,
  },
  heroSub: {
    fontSize: 14,
    color: '#9A8878',
    margin: 0,
    fontFamily: "'DM Sans', sans-serif",
  },
  toolbar: {
    display: 'flex',
    gap: 10,
    padding: '0 2.5rem',
    maxWidth: 1200,
    margin: '0 auto 16px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  searchWrap: {
    flex: 1,
    minWidth: 200,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    width: 16,
    height: 16,
    color: '#9A8878',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    padding: '9px 36px 9px 38px',
    border: '0.5px solid #E0D4C4',
    borderRadius: 10,
    background: '#FDFAF6',
    color: '#2C2018',
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
  },
  clearSearch: {
    position: 'absolute',
    right: 10,
    background: 'none',
    border: 'none',
    color: '#9A8878',
    cursor: 'pointer',
    fontSize: 12,
    padding: 2,
  },
  sortSelect: {
    padding: '9px 14px',
    border: '0.5px solid #E0D4C4',
    borderRadius: 10,
    background: '#FDFAF6',
    color: '#5C4A38',
    fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    cursor: 'pointer',
  },
  mobileFilterBtn: {
    display: 'none',  // shown via media query in real app
    padding: '9px 16px',
    border: '0.5px solid #E0D4C4',
    borderRadius: 10,
    background: '#FDFAF6',
    color: '#5C4A38',
    fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    cursor: 'pointer',
  },
  activePills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    padding: '0 2.5rem 12px',
    maxWidth: 1200,
    margin: '0 auto',
    alignItems: 'center',
  },
  activePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px 4px 12px',
    background: '#EDE0D0',
    color: '#5C4A38',
    borderRadius: 20,
    fontSize: 12,
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 500,
  },
  pillRemove: {
    background: 'none',
    border: 'none',
    color: '#9A8878',
    cursor: 'pointer',
    padding: 0,
    fontSize: 10,
    lineHeight: 1,
  },
  clearAllBtn: {
    background: 'none',
    border: 'none',
    color: '#7F77DD',
    fontSize: 12,
    cursor: 'pointer',
    padding: '4px 6px',
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 500,
  },
  layout: {
    display: 'flex',
    gap: '2rem',
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 2.5rem',
    alignItems: 'flex-start',
  },
  filterDesktop: {
    display: 'block',
  },
  filterMobileOpen: {
    display: 'block',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  resultCount: {
    fontSize: 12,
    color: '#9A8878',
    margin: '0 0 16px',
    fontFamily: "'DM Sans', sans-serif",
    letterSpacing: '.02em',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '1.25rem',
  },
  skeletonCard: {
    display: 'flex',
    flexDirection: 'column',
  },
  emptyState: {
    textAlign: 'center',
    padding: '4rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: {
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 500,
    color: '#2C2018',
    margin: 0,
    fontFamily: "'Cormorant Garamond', serif",
  },
  emptySub: {
    fontSize: 14,
    color: '#9A8878',
    margin: 0,
    fontFamily: "'DM Sans', sans-serif",
  },
  resetBtn: {
    marginTop: 8,
    padding: '8px 20px',
    border: '0.5px solid #E0D4C4',
    borderRadius: 20,
    background: '#FDFAF6',
    color: '#5C4A38',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
}