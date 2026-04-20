const CONCENTRATIONS = ['Parfum', 'EDP', 'EDT', 'EDC', 'Cologne']

const SEASONS = [
  { value: 1, label: 'Spring' },
  { value: 2, label: 'Summer' },
  { value: 3, label: 'Autumn' },
  { value: 4, label: 'Winter' },
]

const GENDERS = [
  { value: 1, label: 'Feminine' },
  { value: 2, label: 'Unisex' },
  { value: 3, label: 'Masculine' },
]

export default function FilterPanel({ filters, onChange, options, onClear }) {
  const { brands = [], noteFamilies = [] } = options || {}
  const hasActiveFilters = Object.values(filters).some(v => v && v !== '')

  function set(key, value) {
    onChange({ ...filters, [key]: value })
  }

  function toggle(key, value) {
    set(key, filters[key] === value ? '' : value)
  }

  return (
    <aside style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.headerLabel}>Filters</span>
        {hasActiveFilters && (
          <button onClick={onClear} style={styles.clearBtn}>Clear all</button>
        )}
      </div>

      {/* Brand */}
      <FilterSection title="Brand">
        <select
          value={filters.brand_id || ''}
          onChange={e => set('brand_id', e.target.value)}
          style={styles.select}
        >
          <option value="">All brands</option>
          {brands.map(b => (
            <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>
          ))}
        </select>
      </FilterSection>

      {/* Note family */}
      <FilterSection title="Note family">
        <div style={styles.chipGroup}>
          {noteFamilies.map(family => (
            <button
              key={family}
              onClick={() => toggle('note_family', family)}
              style={{
                ...styles.chip,
                ...(filters.note_family === family ? styles.chipActive : {}),
              }}
            >
              {family}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Concentration */}
      <FilterSection title="Concentration">
        <div style={styles.chipGroup}>
          {CONCENTRATIONS.map(c => (
            <button
              key={c}
              onClick={() => toggle('concentration', c)}
              style={{
                ...styles.chip,
                ...(filters.concentration === c ? styles.chipActive : {}),
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Season */}
      <FilterSection title="Season">
        <div style={styles.chipGroup}>
          {SEASONS.map(s => (
            <button
              key={s.value}
              onClick={() => toggle('season', s.value)}
              style={{
                ...styles.chip,
                ...(filters.season === s.value ? styles.chipActive : {}),
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Gender lean */}
      <FilterSection title="Gender lean">
        <div style={styles.chipGroup}>
          {GENDERS.map(g => (
            <button
              key={g.value}
              onClick={() => toggle('gender', g.value)}
              style={{
                ...styles.chip,
                ...(filters.gender === g.value ? styles.chipActive : {}),
              }}
            >
              {g.label}
            </button>
          ))}
        </div>
      </FilterSection>
    </aside>
  )
}

function FilterSection({ title, children }) {
  return (
    <div style={styles.section}>
      <p style={styles.sectionTitle}>{title}</p>
      {children}
    </div>
  )
}

const styles = {
  panel: {
    width: 220,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    position: 'sticky',
    top: 24,
    alignSelf: 'flex-start',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: '#7A6A58',
    fontFamily: 'var(--font-sans)',
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    fontSize: 12,
    color: '#C4845A',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
  },
  section: {
    borderTop: '0.5px solid #E8DDD0',
    padding: '14px 0',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    color: '#9A8878',
    margin: '0 0 10px',
    fontFamily: 'var(--font-sans)',
  },
  select: {
    width: '100%',
    padding: '7px 10px',
    border: '0.5px solid #E0D4C4',
    borderRadius: 8,
    background: '#FDFAF6',
    color: '#2C2018',
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
  },
  chipGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    padding: '4px 12px',
    borderRadius: 20,
    border: '0.5px solid #E0D4C4',
    background: '#FDFAF6',
    color: '#5C4A38',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    transition: 'all .15s ease',
  },
  chipActive: {
    background: '#C4845A',
    borderColor: '#C4845A',
    color: '#FDF8F2',
  },
}