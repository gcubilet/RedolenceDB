import { useNavigate } from 'react-router-dom'

const SEASON_LABELS = { 'spring': 'Spring', 'summer': 'Summer', 'autumn': 'Autumn', 'winter': 'Winter' }
const GENDER_LABELS = { 'feminine': 'Feminine', 'unisex': 'Unisex', 'masculine': 'Masculine' }

const FAMILY_COLORS = {
  floral:    { bg: '#F5EDE8', text: '#7C4A3A' },
  woody:     { bg: '#EAE0D0', text: '#5C4A2A' },
  citrus:    { bg: '#F5F0DC', text: '#6B5A20' },
  oriental:  { bg: '#EDE0D4', text: '#6B3A2A' },
  aquatic:   { bg: '#DFF0F0', text: '#2A5A5A' },
  green:     { bg: '#E5EDD8', text: '#3A5A2A' },
  gourmand:  { bg: '#F0E8D8', text: '#6B4A20' },
  fougere:   { bg: '#E8EDE0', text: '#3A4A2A' },
  chypre:    { bg: '#EDE8E0', text: '#4A4A30' },
  leather:   { bg: '#E8E0D8', text: '#4A3A28' },
}

function getFamilyStyle(family) {
  const key = family?.toLowerCase()
  return FAMILY_COLORS[key] || { bg: '#EDE8E0', text: '#4A4A30' }
}

function avgScore(ratings) {
  if (!ratings?.length) return null
  const scores = ratings.filter(r => r.score).map(r => r.score)
  if (!scores.length) return null
  return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
}

function topNoteFamily(perfumeNotes) {
  const top = perfumeNotes?.find(pn => pn.note_type === 'top')
  return top?.notes?.scent_family || perfumeNotes?.[0]?.notes?.scent_family || null
}

export default function PerfumeCard({ perfume, index = 0 }) {
  const navigate = useNavigate()
  const score = avgScore(perfume.user_ratings)
  const family = topNoteFamily(perfume.perfume_notes)
  const familyStyle = getFamilyStyle(family)

  return (
    <article
      onClick={() => navigate(`/perfume/${perfume.perfume_id}`)}
      style={{
        ...styles.card,
        animationDelay: `${index * 40}ms`,
      }}
      className="perfume-card"
    >
      {/* Image area */}
      <div style={styles.imageWrap}>
        {perfume.image_url ? (
          <img
            src={perfume.image_url}
            alt={perfume.name}
            style={styles.image}
            loading="lazy"
          />
        ) : (
          <div style={styles.imageFallback}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#B8A898" strokeWidth="1.2">
              <path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8l-5-5z"/>
              <path d="M9 3v5h5"/>
              <circle cx="12" cy="15" r="2"/>
              <path d="M12 10v3"/>
            </svg>
          </div>
        )}

        {/* Score badge */}
        {score && (
          <div style={styles.scoreBadge}>
            {score}
          </div>
        )}

        {/* Concentration pill */}
        {perfume.concentration && (
          <div style={styles.concPill}>
            {perfume.concentration}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={styles.content}>
        <p style={styles.brandName}>
          {perfume.brands?.brand_name || 'Unknown brand'}
        </p>
        <h3 style={styles.perfumeName}>{perfume.name}</h3>

        {/* Note family tag */}
        {family && (
          <span style={{ ...styles.familyTag, background: familyStyle.bg, color: familyStyle.text }}>
            {family}
          </span>
        )}

        {/* Note previews */}
        {perfume.perfume_notes?.length > 0 && (
          <div style={styles.notes}>
            {perfume.perfume_notes.slice(0, 3).map((pn, i) => (
              <span key={i} style={styles.noteChip}>
                {pn.notes?.name}
              </span>
            ))}
            {perfume.perfume_notes.length > 3 && (
              <span style={{ ...styles.noteChip, color: '#9A8878' }}>
                +{perfume.perfume_notes.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

const styles = {
  card: {
    background: '#FDFAF6',
    border: '0.5px solid #E8DDD0',
    borderRadius: 16,
    cursor: 'pointer',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    animation: 'fadeUp .35s ease both',
    transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
  },
  imageWrap: {
    position: 'relative',
    aspectRatio: '3/4',
    background: '#F0E8DC',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'transform .4s ease',
  },
  imageFallback: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(145deg, #EDE4D8 0%, #E0D4C4 100%)',
  },
  scoreBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    background: 'rgba(40, 30, 20, 0.75)',
    color: '#F5EFE6',
    fontSize: 12,
    fontWeight: 500,
    padding: '3px 8px',
    borderRadius: 20,
    backdropFilter: 'blur(4px)',
    fontFamily: 'var(--font-sans)',
    letterSpacing: '.02em',
  },
  concPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    background: 'rgba(250, 245, 238, 0.9)',
    color: '#7A6A58',
    fontSize: 10,
    fontWeight: 500,
    padding: '3px 8px',
    borderRadius: 20,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    fontFamily: 'var(--font-sans)',
  },
  content: {
    padding: '14px 16px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    flex: 1,
  },
  brandName: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    color: '#9A8878',
    margin: 0,
    fontFamily: 'var(--font-sans)',
  },
  perfumeName: {
    fontSize: 15,
    fontWeight: 500,
    color: '#2C2018',
    margin: 0,
    lineHeight: 1.3,
    fontFamily: "'Cormorant Garamond', Georgia, serif",
  },
  familyTag: {
    display: 'inline-block',
    fontSize: 11,
    padding: '2px 9px',
    borderRadius: 20,
    fontWeight: 500,
    width: 'fit-content',
    fontFamily: 'var(--font-sans)',
  },
  notes: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  noteChip: {
    fontSize: 11,
    color: '#7A6A58',
    background: '#EDE4D8',
    padding: '2px 8px',
    borderRadius: 20,
    fontFamily: 'var(--font-sans)',
  },
}