import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function LoginRegister() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')       // 'login' | 'register' | 'forgot'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })

  const f = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  function validate() {
    if (!form.email) return 'Email is required.'
    if (mode === 'forgot') return null
    if (!form.password) return 'Password is required.'
    if (form.password.length < 8) return 'Password must be at least 8 characters.'
    if (mode === 'register') {
      if (!form.name.trim()) return 'Name is required.'
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
            data: { name: form.name },   // passed to handle_new_user trigger
          }
        })
        if (error) throw error
        setSuccess('Account created! Check your email to confirm before logging in.')

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

  async function handleOAuth(provider) {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/` }
    })
    if (error) setError(error.message)
  }

  const titles = { login: 'Welcome back', register: 'Create your account', forgot: 'Reset password' }
  const subtitles = {
    login: 'Sign in to your ScentBase account',
    register: 'Start building your fragrance collection',
    forgot: "We'll send you a link to reset your password",
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>SB</div>
          <h1 style={styles.title}>{titles[mode]}</h1>
          <p style={styles.subtitle}>{subtitles[mode]}</p>
        </div>

        {/* Error / success banners */}
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

        {/* OAuth buttons — only on login/register */}
        {mode !== 'forgot' && (
          <>
            <div style={styles.oauthRow}>
              <button style={styles.oauthBtn} onClick={() => handleOAuth('google')} type="button">
                <OAuthIcon provider="google" />
                Continue with Google
              </button>
              <button style={styles.oauthBtn} onClick={() => handleOAuth('github')} type="button">
                <OAuthIcon provider="github" />
                Continue with GitHub
              </button>
            </div>
            <div style={styles.divider}>
              <span style={styles.dividerLine} />
              <span style={styles.dividerText}>or continue with email</span>
              <span style={styles.dividerLine} />
            </div>
          </>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === 'register' && (
            <Field label="Full name" id="name">
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={f('name')}
                placeholder="Your name"
                autoComplete="name"
                style={styles.input}
              />
            </Field>
          )}

          <Field label="Email address" id="email">
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={f('email')}
              placeholder="you@example.com"
              autoComplete="email"
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
                style={styles.textLink}
                onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}
              >
                Forgot password?
              </button>
            </div>
          )}

          <button type="submit" style={styles.submitBtn} disabled={loading}>
            {loading ? <Spinner /> : (
              mode === 'login' ? 'Sign in' :
              mode === 'register' ? 'Create account' :
              'Send reset link'
            )}
          </button>
        </form>

        {/* Mode switcher */}
        <p style={styles.switchText}>
          {mode === 'login' && <>
            Don't have an account?{' '}
            <button style={styles.textLink} onClick={() => { setMode('register'); setError(''); setSuccess('') }}>
              Sign up
            </button>
          </>}
          {mode === 'register' && <>
            Already have an account?{' '}
            <button style={styles.textLink} onClick={() => { setMode('login'); setError(''); setSuccess('') }}>
              Sign in
            </button>
          </>}
          {mode === 'forgot' && <>
            <button style={styles.textLink} onClick={() => { setMode('login'); setError(''); setSuccess('') }}>
              Back to sign in
            </button>
          </>}
        </p>
      </div>
    </div>
  )
}

// ---- Sub-components ----

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
        style={{ ...styles.input, paddingRight: 40 }}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        style={styles.eyeBtn}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? '🙈' : '👁'}
      </button>
    </div>
  )
}

function OAuthIcon({ provider }) {
  if (provider === 'google') return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
    </svg>
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

// ---- Styles ----

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
    background: 'var(--color-background-tertiary)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 16,
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  header: { textAlign: 'center' },
  logo: {
    width: 44, height: 44, borderRadius: 12,
    background: '#7F77DD', color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 500, fontSize: 16, marginBottom: 12,
    fontFamily: 'var(--font-sans)',
  },
  title: {
    fontSize: 22, fontWeight: 500, margin: '0 0 4px',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-sans)',
  },
  subtitle: {
    fontSize: 14, color: 'var(--color-text-secondary)', margin: 0,
  },
  banner: (type) => ({
    display: 'flex', alignItems: 'flex-start', gap: 8,
    padding: '10px 12px', borderRadius: 8, fontSize: 13,
    background: type === 'error' ? 'var(--color-background-danger)' : 'var(--color-background-success)',
    color: type === 'error' ? 'var(--color-text-danger)' : 'var(--color-text-success)',
    border: `0.5px solid ${type === 'error' ? 'var(--color-border-danger)' : 'var(--color-border-success)'}`,
  }),
  bannerIcon: { fontWeight: 500, flexShrink: 0 },
  oauthRow: { display: 'flex', flexDirection: 'column', gap: 8 },
  oauthBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: '9px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500,
    border: '0.5px solid var(--color-border-secondary)',
    background: 'var(--color-background-primary)',
    color: 'var(--color-text-primary)', cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    transition: 'background .15s',
  },
  divider: {
    display: 'flex', alignItems: 'center', gap: 10,
  },
  dividerLine: {
    flex: 1, height: '0.5px', background: 'var(--color-border-tertiary)',
  },
  dividerText: { fontSize: 12, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  label: {
    fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)',
  },
  input: {
    width: '100%', padding: '8px 12px', fontSize: 14,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 8, background: 'var(--color-background-primary)',
    color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)',
    outline: 'none', boxSizing: 'border-box',
  },
  eyeBtn: {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
    color: 'var(--color-text-tertiary)', padding: 2,
  },
  submitBtn: {
    width: '100%', padding: '10px', fontSize: 14, fontWeight: 500,
    background: '#7F77DD', color: '#fff', border: 'none',
    borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-sans)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 4, transition: 'opacity .15s',
  },
  textLink: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#7F77DD', fontSize: 13, fontWeight: 500,
    padding: 0, fontFamily: 'var(--font-sans)',
  },
  switchText: {
    textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)', margin: 0,
  },
}