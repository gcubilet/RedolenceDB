import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'

const STEPS = [
  {
    question: 'How do you want your scent to make you feel?',
    options: [
      { label: 'Fresh & clean',    tags: ['citrus','aquatic','green'] },
      { label: 'Warm & sensual',   tags: ['oriental','amber','vanilla'] },
      { label: 'Natural & earthy', tags: ['woody','chypre','vetiver'] },
      { label: 'Bold & striking',  tags: ['leather','oud','spicy'] },
    ]
  },
  {
    question: 'What season do you wear fragrance most?',
    options: [
      { label: 'Winter', tags: ['warm','gourmand','smoky'] },
      { label: 'Summer', tags: ['citrus','aquatic','fresh'] },
      { label: 'Spring', tags: ['floral','green','dewy'] },
      { label: 'Autumn', tags: ['woody','spicy','amber'] },
    ]
  },
  {
    question: 'How long do you want it to last?',
    options: [
      { label: 'Light & subtle (2–4h)',   tags: ['EDT','cologne','fresh'] },
      { label: 'All day (6–8h)',           tags: ['EDP','moderate'] },
      { label: 'Long-lasting (8h+)',       tags: ['Parfum','EDP','oriental'] },
      { label: "Don't mind",               tags: [] },
    ]
  },
  {
    question: 'Pick an environment that resonates',
    options: [
      { label: 'Ocean at dawn',    tags: ['aquatic','marine','fresh'] },
      { label: 'Forest after rain',tags: ['woody','green','earthy'] },
      { label: 'City at night',    tags: ['leather','smoky','dark'] },
      { label: 'Blooming garden',  tags: ['floral','powdery','soft'] },
    ]
  },
  {
    question: 'How would you describe your personal style?',
    options: [
      { label: 'Minimal',      tags: ['clean','airy','modern'] },
      { label: 'Classic',      tags: ['classic','powdery','chypre'] },
      { label: 'Eclectic',     tags: ['niche','oud','complex'] },
      { label: 'Maximalist',   tags: ['oriental','bold','sillage'] },
    ]
  },
]

export default function OnboardingQuiz() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})

  function pick(optionIndex) {
    setAnswers(prev => ({ ...prev, [step]: optionIndex }))
  }

  async function finish() {
  if (!user) {
    console.error('No user found')
    return
  }

  const finalAnswers = { ...answers }

  const profileTags = [...new Set(
    Object.entries(finalAnswers).flatMap(([stepIdx, optIdx]) =>
      STEPS[Number(stepIdx)].options[optIdx].tags
    )
  )]

  const { data, error } = await supabase
    .from('quiz_responses')
    .upsert({
      user_id: user.id,
      answers: finalAnswers,
      profile_tags: profileTags,
    }, { onConflict: 'user_id' })

  if (error) {
    console.error('Supabase error:', error)
    return
  }

  navigate('/recommendations')
}

  const current = STEPS[step]
  const selected = answers[step]

  return (
    <div style={{ maxWidth: 560, margin: '4rem auto', padding: '0 1rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ height: 3, background: '#eee', borderRadius: 3 }}>
          <div style={{
            height: '100%', borderRadius: 3, background: '#7F77DD',
            width: `${((step) / STEPS.length) * 100}%`,
            transition: 'width 0.3s ease'
          }} />
        </div>
        <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
          Question {step + 1} of {STEPS.length}
        </p>
      </div>

      <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 400, marginBottom: '1.5rem' }}>
        {current.question}
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '2rem' }}>
        {current.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => pick(i)}
            style={{
              padding: '16px',
              border: selected === i ? '2px solid #7F77DD' : '0.5px solid #ddd',
              borderRadius: 12,
              background: selected === i ? '#EEEDFE' : 'white',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {step > 0
          ? <button onClick={() => setStep(s => s - 1)}>Back</button>
          : <span />
        }
        {step < STEPS.length - 1
          ? <button
              onClick={() => setStep(s => s + 1)}
              disabled={selected === undefined}
            >
              Next
            </button>
          : <button onClick={finish} disabled={selected === undefined}>
              See my matches
            </button>
        }
      </div>
    </div>
  )
}