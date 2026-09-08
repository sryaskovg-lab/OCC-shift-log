import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) router.replace('/');
    });
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);

    if (mode === 'signup') {
      if (!name.trim()) {
        setMsg({ type: 'err', text: 'Enter your name.' });
        setBusy(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name.trim() } }
      });
      setBusy(false);
      if (error) {
        setMsg({ type: 'err', text: error.message });
        return;
      }
      setMsg({
        type: 'ok',
        text: 'Account created. Check your email to confirm it, then sign in.'
      });
      setMode('signin');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setMsg({ type: 'err', text: error.message });
      return;
    }
    router.replace('/');
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="brand">
          <span className="dot"></span>
          <h1>OCC SHIFT LOG</h1>
        </div>
        <h2>{mode === 'signin' ? 'Sign in' : 'Create your account'}</h2>
        <p className="tagline">
          {mode === 'signin'
            ? 'Use the account you set up for the shift log.'
            : 'One account per operator. Use your work email.'}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="field">
              <label>Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="J. Smith"
                autoFocus
              />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
              minLength={6}
              required
            />
          </div>

          <button className="primary-btn" type="submit" disabled={busy}>
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          {msg && <p className={`msg ${msg.type}`} style={{ marginTop: 12 }}>{msg.text}</p>}
        </form>

        <div className="toggle-row">
          <span style={{ color: 'var(--text-dim)' }}>
            {mode === 'signin' ? "New to the log?" : 'Already have an account?'}
          </span>
          <button
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setMsg(null);
            }}
          >
            {mode === 'signin' ? 'Create an account' : 'Sign in instead'}
          </button>
        </div>
      </div>
    </div>
  );
}
