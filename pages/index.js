import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

const SHIFTS = ['Day', 'Swing', 'Night'];
const PRIORITIES = [
  { key: 'normal', label: 'Normal', color: 'var(--text-dim)' },
  { key: 'elevated', label: 'Elevated', color: 'var(--amber)' },
  { key: 'critical', label: 'Critical', color: 'var(--red)' }
];
const ERP_COPY_TYPES = [
  { key: 'paper', label: 'Paper' },
  { key: 'digital', label: 'Digital' },
  { key: 'both', label: 'Paper & digital' }
];

// Legacy fields kept for entries filed before this form update — no
// longer collected on new entries, but still shown if present.
const SYSTEMS = ['Network', 'Power', 'Comms', 'Security'];
const STATES = [
  { key: 'normal', label: 'Normal', color: 'var(--green)' },
  { key: 'degraded', label: 'Degraded', color: 'var(--amber)' },
  { key: 'critical', label: 'Critical', color: 'var(--red)' }
];

const FIELD_LABELS = {
  shift: 'Shift',
  date: 'Date',
  shift_change_time: 'Time of shift change',
  handed_to: 'Handed to',
  priority: 'Priority',
  mel_items: 'MEL items',
  weather_info: 'Weather info',
  navaid_restrictions: 'NAVAID / ground facility restrictions',
  atc_restrictions: 'ATC restrictions',
  route_change_notices: 'Route change notices / NTCs',
  fps_issues: 'Flight Planning System issues',
  diversions: 'Diversions',
  payload_restriction: 'Payload restriction / baggage offload',
  other_info: 'Other relevant info',
  erp_issue: 'ERP issue no.',
  erp_revision_no: 'ERP revision no.',
  erp_date: 'ERP date',
  erp_copy_type: 'ERP copy type',
  attachment_url: 'Attachment link',
  notes: 'Notes',
  incoming_signoffs: 'Incoming shift sign-off',
  outgoing_signoffs: 'Outgoing shift sign-off',
  head_signoffs: 'Head of OCC sign-off'
};

function priorityColor(key) {
  return (PRIORITIES.find((p) => p.key === key) || PRIORITIES[0]).color;
}
function priorityLabel(key) {
  return (PRIORITIES.find((p) => p.key === key) || PRIORITIES[0]).label;
}
function erpCopyLabel(key) {
  const f = ERP_COPY_TYPES.find((c) => c.key === key);
  return f ? f.label : '—';
}
function stateColor(key) {
  return (STATES.find((s) => s.key === key) || STATES[0]).color;
}
function stateLabel(key) {
  return (STATES.find((s) => s.key === key) || STATES[0]).label;
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function freshForm() {
  return {
    shift: 'Day',
    date: todayISO(),
    shiftChangeTime: '',
    handedTo: '',
    priority: 'normal',
    melItems: '',
    weatherInfo: '',
    navaidRestrictions: '',
    atcRestrictions: '',
    routeChangeNotices: '',
    fpsIssues: [],
    diversions: '',
    payloadRestriction: '',
    otherInfo: '',
    erpIssue: '',
    erpRevisionNo: '',
    erpDate: '',
    erpCopyType: '',
    attachmentUrl: '',
    notes: ''
  };
}
function entryToForm(entry) {
  return {
    shift: entry.shift || 'Day',
    date: entry.date || todayISO(),
    shiftChangeTime: entry.shift_change_time || '',
    handedTo: entry.handed_to || '',
    priority: entry.priority || 'normal',
    melItems: entry.mel_items || '',
    weatherInfo: entry.weather_info || '',
    navaidRestrictions: entry.navaid_restrictions || '',
    atcRestrictions: entry.atc_restrictions || '',
    routeChangeNotices: entry.route_change_notices || '',
    fpsIssues: entry.fps_issues || [],
    diversions: entry.diversions || '',
    payloadRestriction: entry.payload_restriction || '',
    otherInfo: entry.other_info || '',
    erpIssue: entry.erp_issue || '',
    erpRevisionNo: entry.erp_revision_no || '',
    erpDate: entry.erp_date || '',
    erpCopyType: entry.erp_copy_type || '',
    attachmentUrl: entry.attachment_url || '',
    notes: entry.notes || ''
  };
}
function formToRow(form) {
  return {
    shift: form.shift,
    date: form.date,
    shift_change_time: form.shiftChangeTime || null,
    handed_to: form.handedTo || null,
    priority: form.priority,
    mel_items: form.melItems || null,
    weather_info: form.weatherInfo || null,
    navaid_restrictions: form.navaidRestrictions || null,
    atc_restrictions: form.atcRestrictions || null,
    route_change_notices: form.routeChangeNotices || null,
    fps_issues: form.fpsIssues,
    diversions: form.diversions || null,
    payload_restriction: form.payloadRestriction || null,
    other_info: form.otherInfo || null,
    erp_issue: form.erpIssue || null,
    erp_revision_no: form.erpRevisionNo || null,
    erp_date: form.erpDate || null,
    erp_copy_type: form.erpCopyType || null,
    attachment_url: form.attachmentUrl || null,
    notes: form.notes || null
  };
}
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}
function sameName(a, b) {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
function valuesEqual(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
function fmtValue(v) {
  if (v === null || v === undefined || v === '') return '(empty)';
  if (Array.isArray(v)) return v.length === 0 ? '(empty)' : JSON.stringify(v);
  return String(v);
}

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState(undefined);
  const [handovers, setHandovers] = useState([]);
  const [acksByHandover, setAcksByHandover] = useState({});
  const [revisionsByHandover, setRevisionsByHandover] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [view, setView] = useState('form'); // 'form' | 'read' | 'edit'
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

  const loadAll = useCallback(async () => {
    const { data: hData, error: hErr } = await supabase
      .from('handovers')
      .select('*')
      .order('created_at', { ascending: false });

    if (hErr) {
      setLoadError('Could not load the shift log. Refresh to try again.');
      return;
    }
    setLoadError(null);
    setHandovers(hData || []);

    const { data: aData } = await supabase
      .from('acknowledgments')
      .select('*')
      .order('created_at', { ascending: true });
    if (aData) {
      const grouped = {};
      aData.forEach((a) => {
        if (!grouped[a.handover_id]) grouped[a.handover_id] = [];
        grouped[a.handover_id].push(a);
      });
      setAcksByHandover(grouped);
    }

    const { data: rData } = await supabase
      .from('handover_revisions')
      .select('*')
      .order('edited_at', { ascending: true });
    if (rData) {
      const grouped = {};
      rData.forEach((r) => {
        if (!grouped[r.handover_id]) grouped[r.handover_id] = [];
        grouped[r.handover_id].push(r);
      });
      setRevisionsByHandover(grouped);
    }
  }, []);

  useEffect(() => {
    if (session) loadAll();
  }, [session, loadAll]);

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
    setSaveMsg(null);
  }

  function startEdit(entry) {
    setForm(entryToForm(entry));
    setView('edit');
    setSaveMsg(null);
  }

  async function handleSaveNew() {
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
        ...formToRow(form)
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

  // Shared path for both "save an edit" and "click a sign-off button":
  // both are updates to an existing row, and both get logged as a full
  // before/after snapshot in handover_revisions.
  async function applyChange(entryId, changes) {
    const current = handovers.find((h) => h.id === entryId);
    if (!current) return { ok: false };

    const editorName = session.user.user_metadata?.full_name || session.user.email;
    const previousSnapshot = {};
    const newSnapshot = {};
    Object.keys(changes).forEach((key) => {
      previousSnapshot[key] = current[key] ?? null;
      newSnapshot[key] = changes[key] ?? null;
    });

    const { data: updated, error: updateErr } = await supabase
      .from('handovers')
      .update({ ...changes, updated_at: new Date().toISOString(), updated_by_name: editorName })
      .eq('id', entryId)
      .select()
      .single();

    if (updateErr) {
      return { ok: false };
    }

    const { data: revision } = await supabase
      .from('handover_revisions')
      .insert({
        handover_id: entryId,
        editor_id: session.user.id,
        editor_name: editorName,
        previous_data: previousSnapshot,
        new_data: newSnapshot
      })
      .select()
      .single();

    setHandovers((prev) => prev.map((h) => (h.id === entryId ? updated : h)));
    if (revision) {
      setRevisionsByHandover((prev) => {
        const list = prev[entryId] ? [...prev[entryId], revision] : [revision];
        return { ...prev, [entryId]: list };
      });
    }
    return { ok: true };
  }

  async function handleSaveEdit() {
    if (!form.date) {
      setSaveMsg({ type: 'err', text: 'Add a date before saving.' });
      return;
    }
    setSaving(true);
    setSaveMsg(null);

    const res = await applyChange(activeId, formToRow(form));
    setSaving(false);

    if (!res.ok) {
      setSaveMsg({ type: 'err', text: 'Could not save changes — check your connection and try again.' });
      return;
    }
    setView('read');
  }

  async function handleSign(entryId, field) {
    const current = handovers.find((h) => h.id === entryId);
    if (!current) return;
    const displayName = session.user.user_metadata?.full_name || session.user.email;
    const list = current[field] || [];
    if (list.some((s) => sameName(s.name, displayName))) return; // already signed
    const updated = [...list, { name: displayName, signed_at: new Date().toISOString() }];
    await applyChange(entryId, { [field]: updated });
  }

  async function handleAddAck(handoverId, note) {
    const authorName = session.user.user_metadata?.full_name || session.user.email;
    const { data, error } = await supabase
      .from('acknowledgments')
      .insert({ handover_id: handoverId, author_id: session.user.id, author_name: authorName, note })
      .select()
      .single();
    if (error) return { ok: false };
    setAcksByHandover((prev) => {
      const list = prev[handoverId] ? [...prev[handoverId], data] : [data];
      return { ...prev, [handoverId]: list };
    });
    return { ok: true };
  }

  if (session === undefined) return <div className="loading">Loading…</div>;
  if (!session) return <div className="loading">Redirecting to sign in…</div>;

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
              <div className="timeline-empty">No handovers filed yet. The first one starts the log.</div>
            )}
            {!loadError &&
              handovers.map((h) => {
                const acks = acksByHandover[h.id] || [];
                const forYou = sameName(h.handed_to, displayName);
                const edited = !!h.updated_at;
                return (
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
                        {h.priority && h.priority !== 'normal' && (
                          <span
                            className="priority-pill"
                            style={{ color: priorityColor(h.priority), borderColor: priorityColor(h.priority) }}
                          >
                            {priorityLabel(h.priority)}
                          </span>
                        )}
                        {forYou && acks.length === 0 && <span className="for-you-pill">For you</span>}
                        {acks.length > 0 && (
                          <span className="ack-pill">{acks.length} reply{acks.length > 1 ? 's' : ''}</span>
                        )}
                        {edited && <span className="edited-pill">Edited</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </aside>

        <main>
          {view === 'read' && activeEntry ? (
            <ReadView
              entry={activeEntry}
              acks={acksByHandover[activeEntry.id] || []}
              revisions={revisionsByHandover[activeEntry.id] || []}
              displayName={displayName}
              onAddAck={handleAddAck}
              onEdit={() => startEdit(activeEntry)}
              onSign={(field) => handleSign(activeEntry.id, field)}
            />
          ) : view === 'edit' && activeEntry ? (
            <FormView
              form={form}
              setForm={setForm}
              saving={saving}
              saveMsg={saveMsg}
              onSave={handleSaveEdit}
              onCancel={() => setView('read')}
              editing
            />
          ) : (
            <FormView
              form={form}
              setForm={setForm}
              saving={saving}
              saveMsg={saveMsg}
              onSave={handleSaveNew}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function SignBlock({ title, entries, roleField, displayName, onSign }) {
  const signedByYou = entries.some((s) => sameName(s.name, displayName));
  return (
    <div className="signblock">
      <div className="signblock-title">{title}</div>
      {entries.length === 0 && <p className="empty">Not yet signed.</p>}
      {entries.map((s, i) => (
        <div className="signrow" key={i}>
          <span>{s.name}</span>
          <span className="mono">{fmtDateTime(s.signed_at)}</span>
        </div>
      ))}
      {!signedByYou && (
        <button className="sign-btn" onClick={() => onSign(roleField)}>
          Sign as {title.toLowerCase()}
        </button>
      )}
    </div>
  );
}

function ReadView({ entry, acks, revisions, displayName, onAddAck, onEdit, onSign }) {
  const [ackText, setAckText] = useState('');
  const [ackBusy, setAckBusy] = useState(false);
  const [ackMsg, setAckMsg] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const forYou = sameName(entry.handed_to, displayName);
  const fpsIssues = entry.fps_issues || [];

  const hasLegacy =
    entry.summary || entry.open_items || entry.system_status ||
    (entry.incidents && entry.incidents.length > 0) || entry.epr_checked;

  async function submitAck() {
    if (!ackText.trim()) {
      setAckMsg({ type: 'err', text: 'Write something before adding a response.' });
      return;
    }
    setAckBusy(true);
    setAckMsg(null);
    const res = await onAddAck(entry.id, ackText.trim());
    setAckBusy(false);
    if (!res.ok) {
      setAckMsg({ type: 'err', text: 'Could not save your response — try again.' });
      return;
    }
    setAckText('');
  }

  return (
    <>
      <div className="panel-title-row">
        <div>
          <div className="panel-title">
            {entry.shift} shift · {fmtDate(entry.date)}
            {entry.shift_change_time ? ` · ${entry.shift_change_time}` : ''}
          </div>
          <h2 className="panel-heading">Handover from {entry.author_name}</h2>
        </div>
        <button className="edit-btn" onClick={onEdit}>
          Edit
        </button>
      </div>

      <div className="read-meta">
        <div className="item">
          Handed to
          <b>
            {entry.handed_to || '—'}
            {forYou && <span className="for-you-tag">This one's for you</span>}
          </b>
        </div>
        <div className="item">
          Priority
          <b style={{ color: priorityColor(entry.priority) }}>{priorityLabel(entry.priority || 'normal')}</b>
        </div>
        {entry.updated_at && (
          <div className="item">
            Last edited
            <b>
              {fmtDateTime(entry.updated_at)} by {entry.updated_by_name}
            </b>
          </div>
        )}
      </div>

      <Section title="MEL items affecting operation" value={entry.mel_items} />
      <Section title="Weather — home base, destinations, alternates" value={entry.weather_info} />
      <Section title="NAVAID / ground facility restrictions" value={entry.navaid_restrictions} />
      <Section title="ATC restrictions and limitations" value={entry.atc_restrictions} />
      <Section title="Route change notices / NTCs" value={entry.route_change_notices} />

      <div className="read-section">
        <h3>Flight Planning System issues</h3>
        {fpsIssues.length === 0 ? (
          <p className="empty">None logged.</p>
        ) : (
          <ul className="fps-list">
            {fpsIssues.map((f, i) => (
              <li key={i}>
                <div className="fps-desc">{f.description || '—'}</div>
                <div className="fps-meta">
                  {f.time_occurred && <span>Occurred {f.time_occurred}</span>}
                  {f.time_reported && <span>Reported {f.time_reported}</span>}
                  {f.reported_to && <span>To {f.reported_to}</span>}
                  {f.ticket_number && <span>Ticket #{f.ticket_number}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Section title="Diversions — forecast vs actual weather" value={entry.diversions} />
      <Section title="Payload restriction / baggage offload" value={entry.payload_restriction} />
      <Section title="Other relevant information" value={entry.other_info} />

      <div className="read-section">
        <h3>ERP revision check</h3>
        {entry.erp_issue || entry.erp_revision_no || entry.erp_date || entry.erp_copy_type ? (
          <div className="erp-grid">
            <div><span className="erp-label">Issue</span><span>{entry.erp_issue || '—'}</span></div>
            <div><span className="erp-label">Revision</span><span>{entry.erp_revision_no || '—'}</span></div>
            <div><span className="erp-label">Date</span><span>{entry.erp_date || '—'}</span></div>
            <div><span className="erp-label">Copy</span><span>{erpCopyLabel(entry.erp_copy_type)}</span></div>
          </div>
        ) : (
          <p className="empty">Not recorded.</p>
        )}
      </div>

      {entry.attachment_url && (
        <div className="read-section">
          <h3>Attachment</h3>
          <p>
            <a className="attachment-link" href={entry.attachment_url} target="_blank" rel="noreferrer">
              {entry.attachment_url}
            </a>
          </p>
        </div>
      )}

      <Section title="Notes" value={entry.notes} />

      {hasLegacy && (
        <div className="read-section legacy-section">
          <h3>Legacy fields (filed before this form update)</h3>
          {entry.summary && <p><b>Summary:</b> {entry.summary}</p>}
          {entry.open_items && <p><b>Open items:</b> {entry.open_items}</p>}
          {entry.system_status && (
            <div className="read-meta" style={{ marginTop: 8 }}>
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
          )}
        </div>
      )}

      <div className="read-section signoff-grid">
        <SignBlock title="Incoming shift" entries={entry.incoming_signoffs || []} roleField="incoming_signoffs" displayName={displayName} onSign={onSign} />
        <SignBlock title="Outgoing shift" entries={entry.outgoing_signoffs || []} roleField="outgoing_signoffs" displayName={displayName} onSign={onSign} />
        <SignBlock title="Head of OCC" entries={entry.head_signoffs || []} roleField="head_signoffs" displayName={displayName} onSign={onSign} />
      </div>

      <div className="read-section ack-section">
        <h3>Responses</h3>
        {acks.length === 0 && <p className="empty">No responses yet.</p>}
        {acks.map((a) => (
          <div className="ack-item" key={a.id}>
            <div className="ack-top">
              <span className="ack-author">{a.author_name}</span>
              <span className="ack-time">{fmtDateTime(a.created_at)}</span>
            </div>
            <p>{a.note}</p>
          </div>
        ))}
        <div className="ack-form">
          <textarea
            value={ackText}
            onChange={(e) => setAckText(e.target.value)}
            placeholder={forYou ? 'Acknowledge or add a follow-up note' : 'Add a follow-up note'}
          />
          <div className="save-row">
            <button className="save-btn" onClick={submitAck} disabled={ackBusy}>
              {ackBusy ? 'Posting…' : 'Post response'}
            </button>
            {ackMsg && <span className={`msg ${ackMsg.type}`}>{ackMsg.text}</span>}
          </div>
        </div>
      </div>

      <div className="read-section history-section">
        <button className="history-toggle" onClick={() => setShowHistory((v) => !v)}>
          {showHistory ? 'Hide' : 'Show'} edit history ({revisions.length})
        </button>
        {showHistory && (
          <div className="history-list">
            {revisions.length === 0 && <p className="empty">No edits recorded.</p>}
            {revisions.map((r) => {
              const changedKeys = Object.keys(r.new_data).filter(
                (k) => !valuesEqual(r.previous_data[k], r.new_data[k])
              );
              return (
                <div className="history-item" key={r.id}>
                  <div className="ack-top">
                    <span className="ack-author">{r.editor_name}</span>
                    <span className="ack-time">{fmtDateTime(r.edited_at)}</span>
                  </div>
                  {changedKeys.length === 0 ? (
                    <p className="empty">No field changes.</p>
                  ) : (
                    <ul className="diff-list">
                      {changedKeys.map((k) => (
                        <li key={k}>
                          <span className="diff-field">{FIELD_LABELS[k] || k}:</span>{' '}
                          <span className="diff-old">{fmtValue(r.previous_data[k])}</span>
                          {' → '}
                          <span className="diff-new">{fmtValue(r.new_data[k])}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function Section({ title, value }) {
  return (
    <div className="read-section">
      <h3>{title}</h3>
      {value ? <p>{value}</p> : <p className="empty">None recorded.</p>}
    </div>
  );
}

function FormView({ form, setForm, saving, saveMsg, onSave, onCancel, editing }) {
  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }
  function addFps() {
    setForm((prev) => ({
      ...prev,
      fpsIssues: [
        ...prev.fpsIssues,
        { description: '', time_occurred: '', time_reported: '', reported_to: '', ticket_number: '' }
      ]
    }));
  }
  function updateFps(i, field, value) {
    setForm((prev) => {
      const fpsIssues = [...prev.fpsIssues];
      fpsIssues[i] = { ...fpsIssues[i], [field]: value };
      return { ...prev, fpsIssues };
    });
  }
  function removeFps(i) {
    setForm((prev) => ({ ...prev, fpsIssues: prev.fpsIssues.filter((_, idx) => idx !== i) }));
  }

  return (
    <>
      <div className="panel-title">{editing ? 'Editing entry' : 'File a new entry'}</div>
      <h2 className="panel-heading">{editing ? 'Edit handover' : 'New handover'}</h2>

      <div className="row">
        <div className="field">
          <label>Shift</label>
          <select value={form.shift} onChange={(e) => set('shift', e.target.value)}>
            {SHIFTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </div>
        <div className="field">
          <label>Time of shift change</label>
          <input
            type="text"
            value={form.shiftChangeTime}
            onChange={(e) => set('shiftChangeTime', e.target.value)}
            placeholder="e.g. 08:00"
          />
        </div>
      </div>

      <div className="row">
        <div className="field">
          <label>Handing off to (optional)</label>
          <input
            type="text"
            value={form.handedTo}
            onChange={(e) => set('handedTo', e.target.value)}
            placeholder="Next operator's name"
          />
        </div>
        <div className="field">
          <label>Priority</label>
          <select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
            {PRIORITIES.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <FieldArea label="MEL items which affect operation" value={form.melItems} onChange={(v) => set('melItems', v)} />
      <FieldArea
        label="Abnormal weather — home base, destinations, alternates, en-route alternates"
        value={form.weatherInfo}
        onChange={(v) => set('weatherInfo', v)}
      />
      <FieldArea
        label="NAVAID / ground facility failures and restrictions"
        value={form.navaidRestrictions}
        onChange={(v) => set('navaidRestrictions', v)}
      />
      <FieldArea label="Overall ATC restrictions and limitations" value={form.atcRestrictions} onChange={(v) => set('atcRestrictions', v)} />
      <FieldArea
        label="Company route change notices / NTCs affecting operation"
        value={form.routeChangeNotices}
        onChange={(v) => set('routeChangeNotices', v)}
      />

      <div className="status-block">
        <label>Flight Planning System technical problems</label>
        {form.fpsIssues.map((f, i) => (
          <div className="fps-row" key={i}>
            <input
              type="text"
              value={f.description}
              onChange={(e) => updateFps(i, 'description', e.target.value)}
              placeholder="Problem description"
            />
            <input
              type="text"
              value={f.time_occurred}
              onChange={(e) => updateFps(i, 'time_occurred', e.target.value)}
              placeholder="Time occurred"
            />
            <input
              type="text"
              value={f.time_reported}
              onChange={(e) => updateFps(i, 'time_reported', e.target.value)}
              placeholder="Time reported"
            />
            <input
              type="text"
              value={f.reported_to}
              onChange={(e) => updateFps(i, 'reported_to', e.target.value)}
              placeholder="Reported to"
            />
            <input
              type="text"
              value={f.ticket_number}
              onChange={(e) => updateFps(i, 'ticket_number', e.target.value)}
              placeholder="IT ticket #"
            />
            <button className="remove-incident-btn" onClick={() => removeFps(i)}>Remove</button>
          </div>
        ))}
        <button className="add-incident-btn" onClick={addFps}>+ Add FPS issue</button>
      </div>

      <FieldArea
        label="Flight diversions — forecast weather at planning vs. actual at time of diversion"
        value={form.diversions}
        onChange={(v) => set('diversions', v)}
      />
      <FieldArea
        label="Payload restriction due to weather / baggage offloading"
        value={form.payloadRestriction}
        onChange={(v) => set('payloadRestriction', v)}
      />
      <FieldArea label="Any other relevant information" value={form.otherInfo} onChange={(v) => set('otherInfo', v)} />

      <div className="status-block">
        <label>ERP revision check — actual issue/revision copy available to OCC personnel</label>
        <div className="row" style={{ marginBottom: 0 }}>
          <div className="field">
            <input
              type="text"
              value={form.erpIssue}
              onChange={(e) => set('erpIssue', e.target.value)}
              placeholder="Issue no."
            />
          </div>
          <div className="field">
            <input
              type="text"
              value={form.erpRevisionNo}
              onChange={(e) => set('erpRevisionNo', e.target.value)}
              placeholder="Revision no."
            />
          </div>
          <div className="field">
            <input type="date" value={form.erpDate} onChange={(e) => set('erpDate', e.target.value)} />
          </div>
          <div className="field">
            <select value={form.erpCopyType} onChange={(e) => set('erpCopyType', e.target.value)}>
              <option value="">Copy type…</option>
              {ERP_COPY_TYPES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="field">
          <label>Attachment / photo link (optional)</label>
          <input
            type="text"
            value={form.attachmentUrl}
            onChange={(e) => set('attachmentUrl', e.target.value)}
            placeholder="Paste a link to a photo, doc, or file"
          />
        </div>
      </div>

      <FieldArea label="Notes" value={form.notes} onChange={(v) => set('notes', v)} last />

      <div className="save-row">
        <button className="save-btn" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Save handover'}
        </button>
        {editing && (
          <button className="cancel-btn" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
        {saveMsg && <span className={`msg ${saveMsg.type}`}>{saveMsg.text}</span>}
      </div>
    </>
  );
}

function FieldArea({ label, value, onChange, last }) {
  return (
    <div className="field" style={{ marginBottom: last ? 6 : 18 }}>
      <label>{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
