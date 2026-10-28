import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icon, Logo } from './Icon';

// App shell navigation: a top bar on wide screens and a bottom tab bar on phones.

function useTabs(isLoggedIn, isAdmin) {
  return [
    { to: '/', label: 'Report', icon: 'plus', end: true },
    { to: '/scan', label: 'Scan', icon: 'scan' },
    { to: '/track', label: 'Track', icon: 'search' },
    isAdmin
      ? { to: '/admin', label: 'Admin', icon: 'grid' }
      : { to: isLoggedIn ? '/my-complaints' : '/login', label: 'Mine', icon: 'list' },
  ];
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const name = user?.phone_or_email || '';
  return (
    <div className="user-menu" ref={ref}>
      <button className="avatar" onClick={() => setOpen(!open)} aria-label="Account menu" aria-expanded={open}>
        {name.charAt(0).toUpperCase() || 'U'}
      </button>
      {open && (
        <div className="menu-popover" role="menu">
          <div className="menu-head">
            <div className="menu-name">{name}</div>
            <div className="menu-sub">{user?.is_admin ? 'Administrator' : 'Citizen'}</div>
          </div>
          <Link to="/my-complaints" className="menu-item" role="menuitem"><Icon name="list" size={18} /> My reports</Link>
          {user?.is_admin && <Link to="/admin" className="menu-item" role="menuitem"><Icon name="grid" size={18} /> Admin dashboard</Link>}
          <button className="menu-item danger" role="menuitem" onClick={logout}><Icon name="logout" size={18} /> Log out</button>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const { isLoggedIn, isAdmin } = useAuth();
  const tabs = useTabs(isLoggedIn, isAdmin);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <Logo />
            <span>JanaSutra</span>
          </Link>
          <nav className="topnav" aria-label="Main">
            {tabs.map((t) => (
              <NavLink key={t.to + t.label} to={t.to} end={t.end} className={({ isActive }) => `topnav-link${isActive ? ' active' : ''}`}>
                {t.label === 'Mine' ? 'My reports' : t.label === 'Scan' ? 'Road Scan' : t.label}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-end">
            {isLoggedIn ? <UserMenu /> : <Link to="/login" className="btn btn-primary btn-sm">Log in</Link>}
          </div>
        </div>
      </header>

      <nav className="tabbar" aria-label="Main">
        {tabs.map((t) => (
          <NavLink key={t.to + t.label} to={t.to} end={t.end}
            className={({ isActive }) => `tab${isActive ? ' active' : ''}${t.icon === 'scan' ? ' tab-scan' : ''}`}>
            <span className="tab-icon"><Icon name={t.icon} size={t.icon === 'scan' ? 24 : 22} /></span>
            <span className="tab-label">{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
