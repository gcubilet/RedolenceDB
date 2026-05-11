import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons'
export default function LoginRegister() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')       // 'login' | 'register' | 'forgot'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ name: '', age: '', email: '', password: '', confirm: '' })

  const f = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  function validate() {
    if (!form.email) return 'Email is required.'
    if (mode === 'forgot') return null
    if (!form.password) return 'Password is required.'
    if (form.password.length < 8) return 'Password must be at least 8 characters.'
    
    if (mode === 'register') {
      if (!form.name.trim()) return 'Name is required.'
      if (!form.age) return 'Age is required.'
      if (parseInt(form.age) < 0) return 'Age cannot be negative.'
      if (form.password !== form.confirm) return 'Passwords do not match.'
    }
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const validationError = validate()
    if (validationError) return setError(validationError)

    setLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        })
        if (error) throw error
        navigate('/')

      } else if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: { 
              name: form.name,
              age: parseInt(form.age) 
            },
          }
        })
        if (error) throw error
        setSuccess('Account created!')

      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
        setSuccess('Password reset link sent — check your inbox.')
      }

    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const titles = { login: 'Welcome back', register: 'Create your account', forgot: 'Reset password' }
  const subtitles = {
    login: 'Sign in to your RedolenceDB account',
    register: 'Start building your fragrance collection',
    forgot: "We'll send you a link to reset your password",
  }

  return (
    <div style={styles.page}>
      <style>{`
        .auth-input:focus {
          border-color: var(--color-accent) !important;
          box-shadow: 0 0 0 3px var(--color-accent-soft);
        }
        .auth-input::placeholder { color: var(--color-text-tertiary); opacity: .8; }
        .auth-submit:hover:not(:disabled) { background: var(--color-accent-hover) !important; }
        .auth-submit:disabled { opacity: .7; cursor: not-allowed; }
        .auth-text-link:hover { text-decoration: underline; }
      `}</style>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo}>RDB</div>
          <h1 style={styles.title}>{titles[mode]}</h1>
          <p style={styles.subtitle}>{subtitles[mode]}</p>
        </div>

        {error && (
          <div style={styles.banner('error')}>
            <span style={styles.bannerIcon}>!</span>
            {error}
          </div>
        )}
        {success && (
          <div style={styles.banner('success')}>
            <span style={styles.bannerIcon}>✓</span>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === 'register' && (
            <>
              <Field label="Full name" id="name">
                <input
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={f('name')}
                  placeholder="Your name"
                  autoComplete="name"
                  className="auth-input"
                  style={styles.input}
                />
              </Field>
              <Field label="Age" id="age">
                <input
                  id="age"
                  type="number"
                  min="0"
                  value={form.age}
                  onChange={f('age')}
                  placeholder="Your age"
                  className="auth-input"
                  style={styles.input}
                />
              </Field>
            </>
          )}

          <Field label="Email address" id="email">
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={f('email')}
              placeholder="you@example.com"
              autoComplete="email"
              className="auth-input"
              style={styles.input}
            />
          </Field>

          {mode !== 'forgot' && (
            <Field label="Password" id="password">
              <PasswordInput
                id="password"
                value={form.password}
                onChange={f('password')}
                placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
            </Field>
          )}

          {mode === 'register' && (
            <Field label="Confirm password" id="confirm">
              <PasswordInput
                id="confirm"
                value={form.confirm}
                onChange={f('confirm')}
                placeholder="Repeat your password"
                autoComplete="new-password"
              />
            </Field>
          )}

          {mode === 'login' && (
            <div style={{ textAlign: 'right', marginTop: -8 }}>
              <button
                type="button"
                className="auth-text-link"
                style={styles.textLink}
                onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}
              >
                Forgot password?
              </button>
            </div>
          )}

          <button type="submit" className="auth-submit" style={styles.submitBtn} disabled={loading}>
            {loading ? <Spinner /> : (
              mode === 'login' ? 'Sign in' :
              mode === 'register' ? 'Create account' :
              'Send reset link'
            )}
          </button>
        </form>

        <p style={styles.switchText}>
          {mode === 'login' && <>
            Don't have an account?{' '}
            <button className="auth-text-link" style={styles.textLink} onClick={() => { setMode('register'); setError(''); setSuccess('') }}>
              Sign up
            </button>
          </>}
          {mode === 'register' && <>
            Already have an account?{' '}
            <button className="auth-text-link" style={styles.textLink} onClick={() => { setMode('login'); setError(''); setSuccess('') }}>
              Sign in
            </button>
          </>}
          {mode === 'forgot' && <>
            <button className="auth-text-link" style={styles.textLink} onClick={() => { setMode('login'); setError(''); setSuccess('') }}>
              Back to sign in
            </button>
          </>}
        </p>
      </div>
    </div>
  )
}

function Field({ label, id, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label htmlFor={id} style={styles.label}>{label}</label>
      {children}
    </div>
  )
}

function PasswordInput({ id, value, onChange, placeholder, autoComplete }) {
  const [visible, setVisible] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="auth-input"
        style={{ ...styles.input, paddingRight: 40 }}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        style={styles.eyeBtn}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        <FontAwesomeIcon icon={visible ? faEyeSlash : faEye} style={{ color: 'var(--color-accent)' }} />
      </button>
    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 16, height: 16,
      border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff', borderRadius: '50%',
      animation: 'spin .6s linear infinite',
    }} />
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
    background: 'var(--color-background-secondary)',
    fontFamily: 'var(--font-sans)',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 16,
    padding: '2.25rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    boxShadow: '0 8px 24px rgba(44, 32, 24, 0.06)',
  },
  header: { textAlign: 'center' },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: 'var(--color-accent)',
    color: 'var(--color-accent-on)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 500,
    fontSize: 14,
    marginBottom: 14,
    fontFamily: 'var(--font-sans)',
    letterSpacing: '.02em',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 30,
    fontWeight: 400,
    margin: '0 0 6px',
    color: 'var(--color-text-primary)',
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--color-text-tertiary)',
    margin: 0,
    fontFamily: 'var(--font-sans)',
  },
  banner: (type) => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 10,
    fontSize: 13,
    background: type === 'error' ? 'var(--color-background-danger)' : 'var(--color-background-success)',
    color: type === 'error' ? 'var(--color-text-danger)' : 'var(--color-text-success)',
    border: `0.5px solid ${type === 'error' ? 'var(--color-border-danger)' : 'var(--color-border-success)'}`,
    fontFamily: 'var(--font-sans)',
  }),
  bannerIcon: { fontWeight: 500, flexShrink: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    letterSpacing: '.04em',
    textTransform: 'uppercase',
    fontFamily: 'var(--font-sans)',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    fontSize: 14,
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 10,
    background: 'var(--color-background-primary)',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color .15s ease, box-shadow .15s ease',
  },
  eyeBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    color: 'var(--color-text-tertiary)',
    padding: 2,
  },
  submitBtn: {
    width: '100%',
    padding: '11px 20px',
    fontSize: 14,
    fontWeight: 500,
    background: 'var(--color-accent)',
    color: 'var(--color-accent-on)',
    border: 'none',
    borderRadius: 24,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    transition: 'background .15s ease, opacity .15s ease',
    letterSpacing: '.02em',
  },
  textLink: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--color-accent)',
    fontSize: 13,
    fontWeight: 500,
    padding: 0,
    fontFamily: 'var(--font-sans)',
  },
  switchText: {
    textAlign: 'center',
    fontSize: 13,
    color: 'var(--color-text-tertiary)',
    margin: 0,
    fontFamily: 'var(--font-sans)',
  },
}