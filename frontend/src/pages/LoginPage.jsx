import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icon, Logo } from '../components/Icon';

export function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const switchMode = (login) => {
    setIsLogin(login);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) return setError('Please fill in all fields.');
    if (!isLogin && password !== confirmPassword) return setError('Passwords do not match.');
    setLoading(true);
    try {
      if (isLogin) await login(email, password);
      else await register(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth">
      <aside className="auth-art">
        <div className="auth-art-inner">
          <Logo size={44} />
          <h2>Report it once. <br />Reach the right office.</h2>
          <ul>
            <li><Icon name="camera" size={18} /> Photo, place and problem in under a minute</li>
            <li><Icon name="route" size={18} /> Routed to the responsible Karnataka authority</li>
            <li><Icon name="clock" size={18} /> Follow progress with your ticket ID</li>
          </ul>
        </div>
      </aside>

      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h1 className="h2">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
          <p className="muted">{isLogin ? 'Log in to report and follow civic issues.' : 'It takes a few seconds.'}</p>

          <div className="segmented full" role="tablist">
            <button type="button" role="tab" aria-selected={isLogin} className={isLogin ? 'on' : ''} onClick={() => switchMode(true)}>Log in</button>
            <button type="button" role="tab" aria-selected={!isLogin} className={!isLogin ? 'on' : ''} onClick={() => switchMode(false)}>Register</button>
          </div>

          <label className="field">
            <span className="label">Email or phone</span>
            <input type="text" className="input" autoComplete="username" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">Password</span>
            <input type="password" className="input" autoComplete={isLogin ? 'current-password' : 'new-password'}
              placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {!isLogin && (
            <label className="field appear">
              <span className="label">Confirm password</span>
              <input type="password" className="input" autoComplete="new-password" placeholder="••••••••"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </label>
          )}

          {error && <div className="notice error"><Icon name="alert" /><div>{error}</div></div>}

          <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
            {loading ? <span className="spin" /> : isLogin ? 'Log in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
