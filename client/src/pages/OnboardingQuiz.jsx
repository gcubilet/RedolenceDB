import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'

const STEPS = [
  {
    question: 'How do you want your scent to make you feel?',
    multi: false,
    options: [
      { label: 'Fresh & energised',  tags: ['citrus', 'aquatic', 'green', 'fresh'] },
      { label: 'Warm & sensual',     tags: ['oriental', 'amber', 'vanilla', 'musk'] },
      { label: 'Grounded & calm',    tags: ['woody', 'earthy', 'vetiver', 'chypre'] },
      { label: 'Powerful & bold',    tags: ['leather', 'oud', 'spicy', 'smoky'] },
      { label: 'Romantic & soft',    tags: ['floral', 'powdery', 'soft', 'rose'] },
      { label: 'Playful & sweet',    tags: ['gourmand', 'fruity', 'sweet', 'vanilla'] },
    ],
  },
  {
    question: 'Which note families do you love? Pick all that apply.',
    multi: true,
    options: [
      { label: 'Citrus & zesty',    tags: ['citrus', 'bergamot', 'lemon'] },
      { label: 'Florals',           tags: ['floral', 'rose', 'jasmine', 'iris'] },
      { label: 'Woods & resins',    tags: ['woody', 'cedar', 'sandalwood', 'resinous'] },
      { label: 'Musks & skin',      tags: ['musk', 'skin', 'clean', 'soft'] },
      { label: 'Spices & incense',  tags: ['spicy', 'incense', 'cardamom', 'pepper'] },
      { label: 'Gourmand & sweet',  tags: ['gourmand', 'vanilla', 'caramel', 'sweet'] },
      { label: 'Green & herbal',    tags: ['green', 'herbal', 'aromatic', 'fresh'] },
      { label: 'Aquatic & marine',  tags: ['aquatic', 'marine', 'ozonic', 'fresh'] },
    ],
  },
  {
    question: 'Are there any notes you actively dislike?',
    multi: true,
    negative: true,
    options: [
      { label: 'Heavy musks',       tags: ['heavy-musk'] },
      { label: 'Florals',           tags: ['dislike-floral'] },
      { label: 'Sweet/gourmand',    tags: ['dislike-sweet'] },
      { label: 'Smoky/incense',     tags: ['dislike-smoky'] },
      { label: 'Aquatics',          tags: ['dislike-aquatic'] },
      { label: 'Animalic/leathery', tags: ['dislike-leather'] },
      { label: "None — I'm open",   tags: [], exclusive: true },
    ],
  },
  {
    question: 'When do you most reach for a fragrance?',
    multi: false,
    options: [
      { label: 'Every morning, daily wear',    tags: ['fresh', 'clean', 'moderate', 'everyday'] },
      { label: 'Work & professional settings', tags: ['clean', 'aromatic', 'subtle', 'professional'] },
      { label: 'Evenings & dates',             tags: ['oriental', 'sensual', 'EDP', 'bold'] },
      { label: 'Weekends & outdoors',          tags: ['green', 'woody', 'fresh', 'casual'] },
      { label: 'Special occasions only',       tags: ['Parfum', 'niche', 'complex', 'luxury'] },
    ],
  },
  {
    question: 'What season do you wear fragrance most?',
    multi: false,
    options: [
      { label: 'Winter',     tags: ['warm', 'gourmand', 'smoky', 'oud', 'amber'] },
      { label: 'Spring',     tags: ['floral', 'green', 'dewy', 'light'] },
      { label: 'Summer',     tags: ['citrus', 'aquatic', 'fresh', 'light'] },
      { label: 'Autumn',     tags: ['woody', 'spicy', 'amber', 'earthy'] },
      { label: 'Year-round', tags: ['versatile', 'moderate'] },
    ],
  },
  {
    question: 'How much sillage and projection do you want?',
    multi: false,
    options: [
      { label: 'Skin-close — just for me',  tags: ['intimate', 'skin', 'subtle'] },
      { label: 'Noticeable within a hug',   tags: ['moderate', 'soft'] },
      { label: 'People notice when I enter', tags: ['strong', 'sillage', 'projection'] },
      { label: 'Room-filling presence',     tags: ['enormous', 'bold', 'statement'] },
    ],
  },
  {
    question: 'How long do you want it to last?',
    multi: false,
    options: [
      { label: 'Light touch (2–4h)',      tags: ['EDT', 'cologne', 'light'] },
      { label: 'Half day (4–6h)',         tags: ['EDT', 'moderate'] },
      { label: 'Full day (6–8h)',         tags: ['EDP', 'longevity'] },
      { label: 'All day and night (8h+)', tags: ['Parfum', 'EDP', 'longevity', 'intense'] },
    ],
  },
  {
    question: 'Pick a scene that resonates with your ideal scent',
    multi: false,
    options: [
      { label: 'Ocean at dawn',         tags: ['aquatic', 'marine', 'clean', 'fresh'] },
      { label: 'Old library in winter', tags: ['woody', 'leather', 'smoky', 'complex'] },
      { label: 'Blooming garden',       tags: ['floral', 'green', 'dewy', 'romantic'] },
      { label: 'Desert at sunset',      tags: ['amber', 'oud', 'warm', 'dry'] },
      { label: 'Rain on warm asphalt',  tags: ['earthy', 'green', 'petrichor', 'fresh'] },
      { label: 'Candlelit dinner',      tags: ['vanilla', 'musk', 'warm', 'sensual'] },
    ],
  },
]

export default function OnboardingQuiz() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})   // stepIdx → index (single) or Set of indices (multi)
  const [saving, setSaving] = useState(false)

  const current = STEPS[step]
  const isMulti = current.multi

  // ── selection helpers ─────────────────────────────────────────────────────
  function toggle(i) {
    const opt = current.options[i]
    if (!isMulti) {
      setAnswers(p => ({ ...p, [step]: i }))
      return
    }
    setAnswers(prev => {
      const set = new Set(prev[step] || [])
      // exclusive options (e.g. "None") clear everything else
      if (opt.exclusive) return { ...prev, [step]: new Set([i]) }
      // if another exclusive was selected, clear it first
      const exclusiveIdx = current.options.findIndex(o => o.exclusive)
      if (set.has(exclusiveIdx)) set.delete(exclusiveIdx)
      if (set.has(i)) set.delete(i)
      else set.add(i)
      return { ...prev, [step]: set }
    })
  }

  function isSelected(i) {
    if (!isMulti) return answers[step] === i
    return (answers[step] || new Set()).has(i)
  }

  function canProceed() {
    if (!isMulti) return answers[step] !== undefined
    // multi steps are optional — can always proceed
    return true
  }

  // ── build tags from all answers ───────────────────────────────────────────
  function buildTags() {
    const positive = []
    const negative = []
    STEPS.forEach((s, si) => {
      const ans = answers[si]
      if (ans === undefined || ans === null) return
      const indices = s.multi ? [...(ans || [])] : [ans]
      indices.forEach(idx => {
        const opt = s.options[idx]
        if (!opt) return
        if (s.negative) negative.push(...opt.tags)
        else positive.push(...opt.tags)
      })
    })
    return {
      positive: [...new Set(positive)],
      negative: [...new Set(negative)],
    }
  }

  async function finish() {
    if (!user) return
    setSaving(true)
    const { positive, negative } = buildTags()
    // store positive tags as profile_tags; embed negative in answers for scoring
    const { error } = await supabase
      .from('quiz_responses')
      .upsert({
        user_id:      user.id,
        answers:      { steps: answers, negative_tags: negative },
        profile_tags: positive,
      }, { onConflict: 'user_id' })
    setSaving(false)
    if (error) { console.error('Quiz save error:', error); return }
    navigate('/recommendations')
  }

  const progress = (step / STEPS.length) * 100

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        body { background: #F7F2EC; font-family: 'DM Sans', sans-serif; }
        .quiz-opt:hover { border-color: #A9A3E8 !important; background: #F5F3FE !important; }
        .quiz-btn:hover:not(:disabled) { opacity: .85; }
      `}</style>

      <div style={styles.page}>
        {/* Progress */}
        <div style={styles.progressWrap}>
          <div style={styles.progressBg}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
          <p style={styles.progressLabel}>
            Question {step + 1} of {STEPS.length}
            {isMulti && <span style={styles.multiHint}> · select all that apply</span>}
            {current.negative && <span style={styles.multiHint}> · optional</span>}
          </p>
        </div>

        {/* Question */}
        <h2 style={styles.question}>{current.question}</h2>

        {/* Options */}
        <div style={{
          ...styles.grid,
          gridTemplateColumns: current.options.length > 5 ? 'repeat(auto-fill, minmax(170px, 1fr))' : '1fr 1fr',
        }}>
          {current.options.map((opt, i) => (
            <button
              key={i}
              className="quiz-opt"
              onClick={() => toggle(i)}
              style={{
                ...styles.option,
                ...(isSelected(i) ? styles.optionSelected : {}),
              }}
            >
              <span style={styles.optLabel}>{opt.label}</span>
              {isSelected(i) && (
                <span style={styles.optCheck}>✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div style={styles.nav}>
          {step > 0 ? (
            <button className="quiz-btn" onClick={() => setStep(s => s - 1)} style={styles.backBtn}>
              ← Back
            </button>
          ) : <span />}

          {step < STEPS.length - 1 ? (
            <button
              className="quiz-btn"
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              style={{ ...styles.nextBtn, ...(!canProceed() ? styles.btnDisabled : {}) }}
            >
              Next →
            </button>
          ) : (
            <button
              className="quiz-btn"
              onClick={finish}
              disabled={saving}
              style={{ ...styles.nextBtn, ...(saving ? styles.btnDisabled : {}) }}
            >
              {saving ? 'Saving…' : 'See my matches ✨'}
            </button>
          )}
        </div>

        {/* Tag preview */}
        {Object.keys(answers).length > 0 && (
          <div style={styles.tagPreview}>
            <p style={styles.tagPreviewLabel}>Your profile so far</p>
            <div style={styles.tagCloud}>
              {buildTags().positive.slice(0, 12).map(tag => (
                <span key={tag} style={styles.tag}>{tag}</span>
              ))}
              {buildTags().negative.length > 0 && buildTags().negative.map(tag => (
                <span key={tag} style={styles.tagNeg}>{tag.replace('dislike-', '— ')}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

const styles = {
  page: { maxWidth: 640, margin: '3rem auto', padding: '0 1.5rem 4rem' },
  progressWrap: { marginBottom: '2rem' },
  progressBg: { height: 3, background: '#E8DDD0', borderRadius: 3, marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 3, background: '#7F77DD', transition: 'width .35s ease' },
  progressLabel: { fontSize: 12, color: '#9A8878', margin: 0, fontFamily: "'DM Sans', sans-serif" },
  multiHint: { color: '#B8A898', fontStyle: 'italic' },
  question: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(22px, 3.5vw, 30px)', fontWeight: 400, color: '#2C2018', margin: '0 0 1.5rem', lineHeight: 1.25 },
  grid: { display: 'grid', gap: 10, marginBottom: '2rem' },
  option: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px', border: '0.5px solid #E0D4C4',
    borderRadius: 12, background: '#FDFAF6', cursor: 'pointer',
    textAlign: 'left', fontFamily: "'DM Sans', sans-serif",
    transition: 'border-color .15s, background .15s',
    position: 'relative',
  },
  optionSelected: {
    border: '1.5px solid #7F77DD', background: '#EEEDFE',
  },
  optEmoji: { fontSize: 20, flexShrink: 0, lineHeight: 1 },
  optLabel: { fontSize: 13, color: '#2C2018', fontWeight: 400, flex: 1 },
  optCheck: { fontSize: 11, color: '#7F77DD', fontWeight: 700, flexShrink: 0 },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' },
  backBtn: { padding: '9px 20px', border: '0.5px solid #E0D4C4', borderRadius: 24, background: 'none', color: '#5C4A38', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  nextBtn: { padding: '10px 24px', border: 'none', borderRadius: 24, background: '#7F77DD', color: '#FDF8F2', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  btnDisabled: { opacity: 0.45, cursor: 'default' },
  tagPreview: { padding: '14px 16px', background: '#F5F0E8', border: '0.5px solid #E0D4C4', borderRadius: 12 },
  tagPreviewLabel: { fontSize: 11, color: '#9A8878', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 8px', fontFamily: "'DM Sans', sans-serif" },
  tagCloud: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  tag: { fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#EDE4D8', color: '#5C4A38', fontFamily: "'DM Sans', sans-serif" },
  tagNeg: { fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#FAECE7', color: '#8B3A22', fontFamily: "'DM Sans', sans-serif" },
}