import { useState, useEffect, useCallback, useRef } from 'react';

const FOCUS_MINS = 25;
const FOCUS_SECS = FOCUS_MINS * 60;
const RADIUS     = 88;
const CIRC       = 2 * Math.PI * RADIUS;

const PRIORITY_SCORE = { High: 0, Medium: 1, Low: 2 };

function pickBestTask(tasks) {
  const open = tasks.filter(t => t.status !== 'Done' && t.status !== 'Delegated' && t.status !== 'Blocked');
  if (!open.length) return null;
  const now = Date.now();
  return [...open].sort((a, b) => {
    const pa = PRIORITY_SCORE[a.priority] ?? 1;
    const pb = PRIORITY_SCORE[b.priority] ?? 1;
    const da = a.due_date ? Math.max(0, (new Date(a.due_date + 'T00:00:00') - now) / 86400000) : 999;
    const db = b.due_date ? Math.max(0, (new Date(b.due_date + 'T00:00:00') - now) / 86400000) : 999;
    return (pa * 10 + Math.min(da, 30)) - (pb * 10 + Math.min(db, 30));
  })[0];
}

function fmt(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function TimerRing({ timeLeft, total, phase }) {
  const pct    = timeLeft / total;
  const offset = CIRC * (1 - pct);
  const isLow  = timeLeft <= 60 && phase === 'focus';
  const color  = phase === 'timesup' ? '#059669'
               : isLow              ? '#E11D48'
               :                      '#7C3AED';

  return (
    <div className="focus-ring-wrap">
      <svg width={200} height={200} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={100} cy={100} r={RADIUS} fill="none" stroke="#EDE9FE" strokeWidth={10} />
        {/* Progress */}
        <circle
          cx={100} cy={100} r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset .5s linear, stroke .3s' }}
        />
      </svg>
      <div className="focus-ring-time" style={{ color }}>
        {phase === 'timesup' ? '✓' : fmt(timeLeft)}
      </div>
    </div>
  );
}

export default function FocusMode({ tasks, updateTask, onClose }) {
  const [phase,    setPhase]    = useState('pick');      // pick | focus | paused | timesup | done
  const [task,     setTask]     = useState(() => pickBestTask(tasks));
  const [timeLeft, setTimeLeft] = useState(FOCUS_SECS);
  const [total,    setTotal]    = useState(FOCUS_SECS);
  const [changing, setChanging] = useState(false);
  const intervalRef = useRef(null);

  // Timer tick
  useEffect(() => {
    if (phase !== 'focus') { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(intervalRef.current); setPhase('timesup'); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [phase]);

  // Block scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  function start() {
    setTimeLeft(FOCUS_SECS);
    setTotal(FOCUS_SECS);
    setPhase('focus');
  }

  function togglePause() {
    setPhase(p => p === 'focus' ? 'paused' : 'focus');
  }

  function addTime() {
    const extra = 5 * 60;
    setTimeLeft(t => t + extra);
    setTotal(t => t + extra);
    if (phase === 'timesup') setPhase('focus');
  }

  async function markDone() {
    if (task) await updateTask(task.id, { status: 'Done' });
    setPhase('done');
  }

  function nextTask() {
    const next = pickBestTask(tasks.map(t => t.id === task?.id ? { ...t, status: 'Done' } : t));
    setTask(next);
    setTimeLeft(FOCUS_SECS);
    setTotal(FOCUS_SECS);
    setPhase(next ? 'pick' : 'done');
  }

  const openTasks = tasks.filter(t => t.status !== 'Done' && t.status !== 'Delegated' && t.status !== 'Blocked');

  return (
    <div className="focus-overlay">
      <button className="focus-close" onClick={onClose} title="Exit focus mode">✕</button>

      {/* PICK PHASE */}
      {phase === 'pick' && (
        <div className="focus-content">
          <div className="focus-eyebrow">🎯 Ready to focus?</div>
          <div className="focus-task-name">{task?.name ?? 'No tasks available'}</div>
          {task && (
            <div className="focus-task-meta">
              <span className={`badge badge-${task.priority.toLowerCase()}`}>{task.priority}</span>
              <span className="badge badge-todo">{task.area}</span>
            </div>
          )}

          {changing ? (
            <div className="focus-picker">
              <select
                className="focus-select"
                value={task?.id ?? ''}
                onChange={e => {
                  const t = tasks.find(t => t.id === e.target.value);
                  setTask(t ?? null);
                  setChanging(false);
                }}
                autoFocus
              >
                {openTasks.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <button className="focus-change-btn" onClick={() => setChanging(true)}>
              Not this one? Pick a different task →
            </button>
          )}

          <div className="focus-actions">
            {task ? (
              <button className="focus-start-btn" onClick={start}>
                Let's go ▶
              </button>
            ) : (
              <button className="focus-start-btn" style={{ background: '#6B7280' }} onClick={onClose}>
                No open tasks — close
              </button>
            )}
          </div>
        </div>
      )}

      {/* FOCUS / PAUSED PHASE */}
      {(phase === 'focus' || phase === 'paused') && (
        <div className="focus-content">
          <div className="focus-eyebrow">
            {phase === 'paused' ? '⏸ Paused' : '⚡ Focusing'}
          </div>
          <div className="focus-task-name">{task?.name}</div>

          <TimerRing timeLeft={timeLeft} total={total} phase={phase} />

          <div className="focus-actions">
            <button className="focus-btn focus-btn-ghost" onClick={togglePause}>
              {phase === 'paused' ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button className="focus-btn focus-btn-done" onClick={markDone}>
              ✅ Done
            </button>
          </div>
          <button className="focus-change-btn" onClick={() => { clearInterval(intervalRef.current); setPhase('pick'); }}>
            ← Switch task
          </button>
        </div>
      )}

      {/* TIME'S UP PHASE */}
      {phase === 'timesup' && (
        <div className="focus-content">
          <div className="focus-eyebrow">⏰ Time's up!</div>
          <div className="focus-task-name">{task?.name}</div>
          <TimerRing timeLeft={0} total={total} phase="timesup" />
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, marginBottom: 24 }}>
            Did you finish it?
          </p>
          <div className="focus-actions">
            <button className="focus-btn focus-btn-ghost" onClick={addTime}>
              +5 min — keep going
            </button>
            <button className="focus-btn focus-btn-done" onClick={markDone}>
              ✅ Yes, done!
            </button>
          </div>
        </div>
      )}

      {/* DONE PHASE */}
      {phase === 'done' && (
        <div className="focus-content">
          <div className="focus-celebration">🎉</div>
          <div className="focus-eyebrow" style={{ fontSize: 28, fontWeight: 900 }}>
            Task crushed!
          </div>
          <div className="focus-task-name" style={{ opacity: 0.7, fontSize: 18 }}>
            {task?.name}
          </div>
          <div className="focus-actions" style={{ marginTop: 40 }}>
            <button className="focus-btn focus-btn-ghost" onClick={onClose}>
              That's enough for now
            </button>
            <button className="focus-btn focus-btn-done" onClick={nextTask}>
              ⚡ Next task →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
