import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

const SYSTEMS = ['Network', 'Power', 'Comms', 'Security'];
const STATES = [
  { key: 'normal', label: 'Normal', color: 'var(--green)' },
  { key: 'degraded', label: 'Degraded', color: 'var(--amber)' },
  { key: 'critical', label: 'Critical', color: 'var(--red)' }
];
const SHIFTS = ['Day', 'Swing', 'Night'];

function stateColor(key) {
  return (STATES.find((s) => s.key === key) || STATES[0]).color;
}
function stateLabel(key) {
  return (STATES.find((s) => s.key === key) || STATES[0]).label;
}
function nextState(key) {
  const idx = STATES.findIndex((s) => s.key === key);
  return STATES[(idx + 1) % STATES.length].key;
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function freshForm() {
  const sys = {};
  SYSTEMS.forEach((s) => (sys[s] = 'normal'));
  return {
    shift: 'Day',
    date: todayISO(),
    handedTo: '',
    systemStatus: sys,
    summary: '',
    openItems: '',
    notes: ''
  };
}
function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out
  const [handovers, setHandovers] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [view, setView] = useState('form'); // 'form' | 'read'
  const [activeId, setActiveId] = useState(null);
  const [form, setForm] = useState(freshForm());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session || null);
      if (!data?.session) router.replace('/login');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) router.replace('/login');
    });
    return () => sub?.subscription?.unsubscribe();
  }, [router]);

  const loadHandovers = useCallback(async () => {
    const { data, error } = await supabase
      .from('handovers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setLoadError('Could not load the shift log. Refresh to try again.');
      return;
    }
    setLoadError(null);
    setHandovers(data || []);
  }, []);

  useEffect(() => {
    if (session) loadHandovers();
  }, [session, loadHandovers]);

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  function startNew() {
    setView('form');
    setActiveId(null);
    setForm(freshForm());
    setSaveMsg(null);
  }

  function openEntry(h) {
    setView('read');
    setActiveId(h.id);
  }

  async function handleSave() {
    if (!form.date) {
      setSaveMsg({ type: 'err', text: 'Add a date before saving.' });
      return;
    }
    setSaving(true);
    setSaveMsg(null);

    const authorName = session.user.user_metadata?.full_name || session.user.email;

    const { data, error } = await supabase
      .from('handovers')
      .insert({
        author_id: session.user.id,
        author_name: authorName,
        shift: form.shift,
        date: form.date,
        handed_to: form.handedTo || null,
        system_status: form.systemStatus,
        summary: form.summary || null,
        open_items: form.openItems || null,
        notes: form.notes || null
      })
      .select()
      .single();

    setSaving(false);

    if (error) {
      setSaveMsg({ type: 'err', text: 'Could not save — check your connection and try again.' });
      return;
    }

    setHandovers((prev) => [data, ...prev]);
    setActiveId(data.id);
    setView('read');
  }

  if (session === undefined) {
    return <div className="loading">Loading…</div>;
  }
  if (!session) {
    return <div className="loading">Redirecting to sign in…</div>;
  }

  const displayName = session.user.user_metadata?.full_name || session.user.email;
  const activeEntry = handovers.find((h) => h.id === activeId);

  return (
    <div className="app-shell">
      <header>
        <div className="brand">
          <span className="dot"></span>
          <h1>OCC SHIFT LOG</h1>
        </div>
        <div className="whoami">
          <span>Signed in as</span>
          <span className="name">{displayName}</span>
          <button onClick={handleSignOut}>Sign out</button>
        </div>
      </header>

      <div className="layout">
        <aside>
          <button className="new-btn" onClick={startNew}>
            + New handover
          </button>
          <div className="timeline">
            {loadError && <div className="timeline-empty">{loadError}</div>}
            {!loadError && handovers.length === 0 && (
              <div className="timeline-empty">
                No handovers filed yet. The first one starts the log.
              </div>
            )}
            {!loadError &&
              handovers.map((h) => (
                <div
                  key={h.id}
                  className={`entry ${activeId === h.id ? 'active' : ''}`}
                  onClick={() => openEntry(h)}
                >
                  <div className="entry-card">
                    <div className="entry-top">
                      <span className="entry-shift">{h.shift} shift</span>
                      <span className="entry-date">{fmtDate(h.date)}</span>
                    </div>
                    <div className="entry-author">{h.author_name}</div>
                    <div className="entry-flags">
                      {SYSTEMS.map((s) => {
                        const st = (h.system_status && h.system_status[s]) || 'normal';
                        return (
                          <span
                            key={s}
                            className="flag"
                            title={`${s}: ${stateLabel(st)}`}
                            style={{ background: stateColor(st) }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </aside>

        <main>
          {view === 'read' && activeEntry ? (
            <ReadView entry={activeEntry} />
          ) : (
            <FormView
              form={form}
              setForm={setForm}
              saving={saving}
              saveMsg={saveMsg}
              onSave={handleSave}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function ReadView({ entry }) {
  return (
    <>
      <div className="panel-title">
        {entry.shift} shift · {fmtDate(entry.date)}
      </div>
      <h2 className="panel-heading">Handover from {entry.author_name}</h2>
      <div className="read-meta">
        <div className="item">
          Handed to
          <b>{entry.handed_to || '—'}</b>
        </div>
        {SYSTEMS.map((s) => {
          const st = (entry.system_status && entry.system_status[s]) || 'normal';
          return (
            <div className="item" key={s}>
              <span style={{ color: stateColor(st) }}>●</span> {s}
              <b>{stateLabel(st)}</b>
            </div>
          );
        })}
      </div>
      <div className="read-section">
        <h3>Summary</h3>
        {entry.summary ? <p>{entry.summary}</p> : <p className="empty">No summary provided.</p>}
      </div>
      <div className="read-section">
        <h3>Open items</h3>
        {entry.open_items ? (
          <p>{entry.open_items}</p>
        ) : (
          <p className="empty">No open items.</p>
        )}
      </div>
      <div className="read-section">
        <h3>Notes for next shift</h3>
        {entry.notes ? <p>{entry.notes}</p> : <p className="empty">No additional notes.</p>}
      </div>
    </>
  );
}

function FormView({ form, setForm, saving, saveMsg, onSave }) {
  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }
  function cycleSystem(sys) {
    setForm((prev) => ({
      ...prev,
      systemStatus: { ...prev.systemStatus, [sys]: nextState(prev.systemStatus[sys]) }
    }));
  }

  return (
    <>
      <div className="panel-title">File a new entry</div>
      <h2 className="panel-heading">New handover</h2>

      <div className="row">
        <div className="field">
          <label>Shift</label>
          <select value={form.shift} onChange={(e) => set('shift', e.target.value)}>
            {SHIFTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </div>
        <div className="field">
          <label>Handing off to (optional)</label>
          <input
            type="text"
            value={form.handedTo}
            onChange={(e) => set('handedTo', e.target.value)}
            placeholder="Next operator"
          />
        </div>
      </div>

      <div className="status-block">
        <label>System status — click to cycle</label>
        <div className="status-grid">
          {SYSTEMS.map((s) => (
            <div className="status-chip" key={s} onClick={() => cycleSystem(s)}>
              <span className="dot" style={{ background: stateColor(form.systemStatus[s]) }} />
              <span>
                {s} — {stateLabel(form.systemStatus[s])}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="field" style={{ marginBottom: 18 }}>
        <label>Shift summary</label>
        <textarea
          value={form.summary}
          onChange={(e) => set('summary', e.target.value)}
          placeholder="What happened this shift, in brief"
        />
      </div>

      <div className="field" style={{ marginBottom: 18 }}>
        <label>Open items / alarms</label>
        <textarea
          value={form.openItems}
          onChange={(e) => set('openItems', e.target.value)}
          placeholder="Anything unresolved that the next shift needs to track"
        />
      </div>

      <div className="field" style={{ marginBottom: 6 }}>
        <label>Notes for next shift</label>
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Context, watch-items, anything not captured above"
        />
      </div>

      <div className="save-row">
        <button className="save-btn" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save handover'}
        </button>
        {saveMsg && <span className={`msg ${saveMsg.type}`}>{saveMsg.text}</span>}
      </div>
    </>
  );
}
