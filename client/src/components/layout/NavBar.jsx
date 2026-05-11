import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'

export default function NavBar() {
  const { user, profile, signOut } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (path) => location.pathname === path

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=DM+Sans:wght@400;500&display=swap');
        .nav-link { transition: color .15s ease; }
        .nav-link:hover { color: #7F77DD !important; }
        .nav-link.active { color: #7F77DD !important; }
        .nav-link.active::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0; right: 0;
          height: 1.5px;
          background: #7F77DD;
          border-radius: 2px;
        }
        .avatar-btn:hover { opacity: .85; }
        .dropdown-item:hover { background: #F0E8DC !important; }
        .mobile-menu-item:hover { background: #F0E8DC !important; }
      `}</style>

      <nav style={styles.nav}>
        <div style={styles.inner}>

          {/* Logo */}
          <Link to="/" style={styles.logo}>
            <div style={styles.logoMark}>RDB</div>
            <span style={styles.logoText}>RedolenceDB</span>
          </Link>

          {/* Centre links */}
          <div style={styles.links}>
            <NavLink to="/" label="Catalogue" isActive={isActive('/')} />
            <NavLink to="/brands" label="Brands" isActive={isActive('/brands')} />
            {user && <NavLink to="/my-collection" label="My collection" isActive={isActive('/my-collection')} />}
            {user && <NavLink to="/wishlist" label="Wishlist" isActive={isActive('/wishlist')} />}
            {user && <NavLink to="/recommendations" label="For you" isActive={isActive('/recommendations')} />}
          </div>

          {/* Right side */}
          <div style={styles.right}>
            {user ? (
              <div style={{ position: 'relative' }}>
                <button
                  className="avatar-btn"
                  onClick={() => setMenuOpen(o => !o)}
                  style={styles.avatarBtn}
                >
                  <div style={styles.avatar}>{initials}</div>
                  <span style={styles.avatarName}>{profile?.name?.split(' ')[0] || 'Account'}</span>
                  <ChevronIcon open={menuOpen} />
                </button>

                {menuOpen && (
                  <>
                    <div onClick={() => setMenuOpen(false)} style={styles.backdrop} />
                    <div style={styles.dropdown}>
                      <div style={styles.dropdownHeader}>
                        <p style={styles.dropdownName}>{profile?.name || 'User'}</p>
                        <p style={styles.dropdownEmail}>{user.email}</p>
                      </div>
                      <div style={styles.dropdownDivider} />
                      <DropdownItem to="/profile" label="Profile" onClick={() => setMenuOpen(false)} />
                      <DropdownItem to="/my-collection" label="My collection" onClick={() => setMenuOpen(false)} />
                      <DropdownItem to="/wishlist" label="Wishlist" onClick={() => setMenuOpen(false)} />
                      <DropdownItem to="/recommendations" label="For you" onClick={() => setMenuOpen(false)} />
                      <div style={styles.dropdownDivider} />
                      <DropdownItem to="/admin" label="Admin dashboard" onClick={() => setMenuOpen(false)} />
                      <DropdownItem to="/console" label="Query console" onClick={() => setMenuOpen(false)} />
                      <div style={styles.dropdownDivider} />
                      <button
                        onClick={() => { setMenuOpen(false); handleSignOut() }}
                        style={styles.signOutBtn}
                        className="dropdown-item"
                      >
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div style={styles.authLinks}>
                <Link to="/login" style={styles.signInLink}>Sign in</Link>
                <Link to="/login?mode=register" style={styles.registerBtn}>Get started</Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Spacer so content doesn't hide under fixed nav */}
      <div style={{ height: 64 }} />
    </>
  )
}

function NavLink({ to, label, isActive }) {
  return (
    <Link
      to={to}
      className={`nav-link${isActive ? ' active' : ''}`}
      style={{
        ...styles.navLink,
        color: isActive ? '#7F77DD' : '#5C4A38',
        position: 'relative',
      }}
    >
      {label}
    </Link>
  )
}

function DropdownItem({ to, label, onClick }) {
  const navigate = useNavigate()
  return (
    <button
      className="dropdown-item"
      onClick={() => { onClick(); navigate(to) }}
      style={styles.dropdownItem}
    >
      {label}
    </button>
  )
}

function ChevronIcon({ open }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 12 12" fill="none"
      stroke="#9A8878" strokeWidth="1.5" strokeLinecap="round"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
    >
      <path d="M2 4l4 4 4-4" />
    </svg>
  )
}

const styles = {
  nav: {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    height: 64,
    background: 'rgba(247, 242, 236, 0.92)',
    backdropFilter: 'blur(12px)',
    borderBottom: '0.5px solid #E8DDD0',
    zIndex: 100,
  },
  inner: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 2.5rem',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '2rem',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textDecoration: 'none',
    flexShrink: 0,
  },
  logoMark: {
    width: 32, height: 32,
    background: '#7F77DD',
    borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#FDF8F2',
    fontSize: 12, fontWeight: 500,
    fontFamily: "'DM Sans', sans-serif",
  },
  logoText: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: 20,
    fontWeight: 400,
    color: '#2C2018',
    letterSpacing: '.01em',
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: '2rem',
    flex: 1,
    justifyContent: 'center',
  },
  navLink: {
    textDecoration: 'none',
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 400,
    paddingBottom: 2,
  },
  right: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  avatarBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'none',
    border: '0.5px solid #E0D4C4',
    borderRadius: 24,
    padding: '5px 12px 5px 5px',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  avatar: {
    width: 28, height: 28,
    borderRadius: '50%',
    background: '#7F77DD',
    color: '#FDF8F2',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 500,
    fontFamily: "'DM Sans', sans-serif",
    flexShrink: 0,
  },
  avatarName: {
    fontSize: 13,
    color: '#2C2018',
    fontWeight: 400,
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 99,
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: 220,
    background: '#FDFAF6',
    border: '0.5px solid #E0D4C4',
    borderRadius: 12,
    boxShadow: '0 8px 24px rgba(44, 32, 24, 0.08)',
    zIndex: 100,
    overflow: 'hidden',
  },
  dropdownHeader: {
    padding: '14px 16px 10px',
  },
  dropdownName: {
    fontSize: 13,
    fontWeight: 500,
    color: '#2C2018',
    margin: '0 0 2px',
    fontFamily: "'DM Sans', sans-serif",
  },
  dropdownEmail: {
    fontSize: 12,
    color: '#9A8878',
    margin: 0,
    fontFamily: "'DM Sans', sans-serif",
  },
  dropdownDivider: {
    height: '0.5px',
    background: '#E8DDD0',
  },
  dropdownItem: {
    width: '100%',
    textAlign: 'left',
    padding: '10px 16px',
    background: 'none',
    border: 'none',
    fontSize: 13,
    color: '#2C2018',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    display: 'block',
  },
  signOutBtn: {
    width: '100%',
    textAlign: 'left',
    padding: '10px 16px',
    background: 'none',
    border: 'none',
    fontSize: 13,
    color: '#C05A3A',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  authLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  signInLink: {
    fontSize: 13,
    color: '#5C4A38',
    textDecoration: 'none',
    fontFamily: "'DM Sans', sans-serif",
    padding: '6px 12px',
  },
  registerBtn: {
    fontSize: 13,
    color: '#FDF8F2',
    textDecoration: 'none',
    fontFamily: "'DM Sans', sans-serif",
    padding: '6px 16px',
    background: '#7F77DD',
    borderRadius: 20,
    fontWeight: 500,
  },
}
