import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'

const EXAMPLE_QUERIES = [
  { label: 'Top rated perfumes',       sql: `SELECT p.name, b.brand_name, ROUND(AVG(r.score),1) AS avg_score, COUNT(r.*) AS ratings\nFROM perfumes p\nJOIN brands b ON b.brand_id = p.brand_id\nJOIN user_ratings r ON r.perfume_id = p.perfume_id\nGROUP BY p.perfume_id, p.name, b.brand_name\nORDER BY avg_score DESC\nLIMIT 10;` },
  { label: 'Most collected perfumes',  sql: `SELECT p.name, b.brand_name, COUNT(*) AS collectors\nFROM user_perfumes up\nJOIN perfumes p ON p.perfume_id = up.perfume_id\nJOIN brands b ON b.brand_id = p.brand_id\nGROUP BY p.perfume_id, p.name, b.brand_name\nORDER BY collectors DESC\nLIMIT 10;` },
  { label: 'Notes by scent family',    sql: `SELECT scent_family, COUNT(*) AS note_count\nFROM notes\nGROUP BY scent_family\nORDER BY note_count DESC;` },
  { label: 'User rating breakdown',    sql: `SELECT sillage, COUNT(*) AS count\nFROM user_ratings\nWHERE sillage IS NOT NULL\nGROUP BY sillage\nORDER BY count DESC;` },
]

export default function QueryConsole() {
  const { user } = useAuthStore()
  const [sql, setSql] = useState('')
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(null)
  const textareaRef = useRef(null)

  // All authenticated users can use the console (SELECT only)
  useState(() => { setIsAdmin(true) })

  async function runQuery() {
    if (!sql.trim()) return
    const trimmed = sql.trim().toLowerCase()
    if (!trimmed.startsWith('select')) {
      setError('Only SELECT statements are permitted.')
      return
    }

    setLoading(true)
    setError('')
    setResults(null)

    const { data, error: qErr } = await supabase.rpc('run_query', { query: sql })

    if (qErr) {
      setError(qErr.message)
    } else {
      setResults(data)
    }
    setLoading(false)
  }

  function loadExample(exSql) {
    setSql(exSql)
    textareaRef.current?.focus()
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      runQuery()
    }
  }

  function exportCsv() {
    if (!results?.length) return
    const headers = Object.keys(results[0]).join(',')
    const rows = results.map(r => Object.values(r).map(v => JSON.stringify(v ?? '')).join(','))
    const blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'query-results.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (isAdmin === false) {
    return (
      <div style={{ textAlign: 'center', padding: '6rem 2rem' }}>
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: '#2C2018' }}>Access denied</p>
        <p style={{ color: '#9A8878', fontSize: 14 }}>You need admin access to use the query console.</p>
      </div>
    )
  }

  const columns = results?.length ? Object.keys(results[0]) : []

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=DM+Sans:wght@400;500&family=DM+Mono:wght@400&display=swap');
        * { box-sizing: border-box; }
        body { background: #F7F2EC; font-family: 'DM Sans', sans-serif; }
        .example-btn:hover { background: #EDE4D8 !important; }
        .result-row:hover td { background: #F5EFE6 !important; }
        .run-btn:hover { opacity: .88; }
      `}</style>

      <div style={styles.page}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Admin tool</p>
            <h1 style={styles.title}>Query console</h1>
          </div>
          <div style={styles.headerNote}>
            <span style={styles.readOnlyBadge}>SELECT only</span>
            <span style={styles.headerMeta}>Read-only access for all users · Cmd+Enter to run</span>
          </div>
        </div>

        <div style={styles.layout}>
          {/* Sidebar */}
          <aside style={styles.sidebar}>
            <p style={styles.sidebarTitle}>Example queries</p>
            {EXAMPLE_QUERIES.map((ex, i) => (
              <button
                key={i}
                className="example-btn"
                onClick={() => loadExample(ex.sql)}
                style={styles.exampleBtn}
              >
                {ex.label}
              </button>
            ))}
          </aside>

          {/* Main editor + results */}
          <div style={styles.main}>
            {/* Editor */}
            <div style={styles.editorWrap}>
              <textarea
                ref={textareaRef}
                value={sql}
                onChange={e => setSql(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="SELECT * FROM perfumes LIMIT 10;"
                style={styles.editor}
                spellCheck={false}
              />
              <div style={styles.editorFooter}>
                <button onClick={() => { setSql(''); setResults(null); setError('') }} style={styles.clearBtn}>
                  Clear
                </button>
                <button onClick={runQuery} disabled={loading || !sql.trim()} className="run-btn" style={styles.runBtn}>
                  {loading ? 'Running…' : 'Run query'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={styles.errorBox}>
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* Results */}
            {results !== null && !error && (
              <div style={styles.resultsWrap}>
                <div style={styles.resultsHeader}>
                  <span style={styles.resultsCount}>
                    {results.length} {results.length === 1 ? 'row' : 'rows'} returned
                  </span>
                  {results.length > 0 && (
                    <button onClick={exportCsv} style={styles.exportBtn}>Export CSV</button>
                  )}
                </div>

                {results.length === 0 ? (
                  <p style={styles.noRows}>Query ran successfully — no rows returned.</p>
                ) : (
                  <div style={styles.tableScroll}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          {columns.map(col => (
                            <th key={col} style={styles.th}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((row, i) => (
                          <tr key={i} className="result-row">
                            {columns.map(col => (
                              <td key={col} style={styles.td}>
                                {row[col] === null
                                  ? <span style={styles.nullVal}>null</span>
                                  : typeof row[col] === 'object'
                                    ? JSON.stringify(row[col])
                                    : String(row[col])
                                }
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

const styles = {
  page: { maxWidth: 1200, margin: '0 auto', padding: '2rem 2.5rem 4rem' },
  header: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: 12 },
  eyebrow: { fontSize: 11, fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A8878', margin: '0 0 8px', fontFamily: "'DM Sans', sans-serif" },
  title: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 40, fontWeight: 300, color: '#2C2018', margin: 0 },
  headerNote: { display: 'flex', alignItems: 'center', gap: 10 },
  readOnlyBadge: { fontSize: 11, padding: '3px 10px', background: '#EDE4D8', color: '#7A6A58', borderRadius: 20, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" },
  headerMeta: { fontSize: 12, color: '#9A8878', fontFamily: "'DM Mono', monospace" },
  layout: { display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1.5rem', alignItems: 'start' },
  sidebar: { background: '#FDFAF6', border: '0.5px solid #E8DDD0', borderRadius: 12, padding: '16px', position: 'sticky', top: 80 },
  sidebarTitle: { fontSize: 11, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9A8878', margin: '0 0 10px', fontFamily: "'DM Sans', sans-serif" },
  exampleBtn: { width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: 'none', color: '#5C4A38', fontSize: 12, cursor: 'pointer', borderRadius: 6, fontFamily: "'DM Sans', sans-serif", transition: 'background .15s', display: 'block', marginBottom: 2 },
  main: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  editorWrap: { background: '#FDFAF6', border: '0.5px solid #E8DDD0', borderRadius: 12, overflow: 'hidden' },
  editor: { width: '100%', minHeight: 160, padding: '16px', border: 'none', background: 'transparent', color: '#2C2018', fontSize: 13, fontFamily: "'DM Mono', 'Courier New', monospace", resize: 'vertical', outline: 'none', lineHeight: 1.65 },
  editorFooter: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: '0.5px solid #EDE4D8' },
  clearBtn: { padding: '7px 16px', border: '0.5px solid #E0D4C4', borderRadius: 20, background: 'none', color: '#5C4A38', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  runBtn: { padding: '7px 20px', border: 'none', borderRadius: 20, background: '#C4845A', color: '#FDF8F2', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'opacity .15s' },
  errorBox: { background: 'var(--color-background-danger)', color: 'var(--color-text-danger)', border: '0.5px solid var(--color-border-danger)', borderRadius: 10, padding: '12px 16px', fontSize: 13, fontFamily: "'DM Mono', monospace" },
  resultsWrap: { background: '#FDFAF6', border: '0.5px solid #E8DDD0', borderRadius: 12, overflow: 'hidden' },
  resultsHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '0.5px solid #EDE4D8', background: '#F0E8DC' },
  resultsCount: { fontSize: 12, color: '#7A6A58', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 },
  exportBtn: { fontSize: 12, padding: '4px 12px', border: '0.5px solid #E0D4C4', borderRadius: 20, background: '#FDFAF6', color: '#5C4A38', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  noRows: { padding: '1.5rem', textAlign: 'center', color: '#9A8878', fontSize: 13, fontFamily: "'DM Sans', sans-serif" },
  tableScroll: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: "'DM Mono', monospace" },
  th: { textAlign: 'left', padding: '8px 14px', background: '#F5EFE6', color: '#7A6A58', fontSize: 11, fontWeight: 500, letterSpacing: '.04em', fontFamily: "'DM Sans', sans-serif", borderBottom: '0.5px solid #E8DDD0', whiteSpace: 'nowrap' },
  td: { padding: '9px 14px', borderBottom: '0.5px solid #EDE4D8', color: '#2C2018', whiteSpace: 'nowrap', transition: 'background .12s' },
  nullVal: { color: '#B8A898', fontStyle: 'italic' },
}

