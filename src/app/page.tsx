'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Home, Brain, Layers, BookOpen, Notebook, Flame } from 'lucide-react';
import { User, Course, Theme, THEMES, THEME_COLORS, DayActivity } from './types';
import {
  getCourseList, logoutUser, registerNewUser, loginUserAction, getDailyActivity
} from './actions';
import Sidebar from './components/Sidebar';
import FlashcardTab from './components/FlashcardTab';
import NotebookTab from './components/NotebookTab';
import ReadingTab from './components/ReadingTab';
import PracticeTab from './components/PracticeTab';

type Tab = 'dashboard' | 'practice' | 'flashcards' | 'reading' | 'notebook';

// ─── Dashboard ────────────────────────────────────────────────────────────────
function DashboardTab({
  user, courses, srsDue, vocabCount, hskAdded, hskTotal, activityDays,
  onGoFlashcards
}: {
  user: User; courses: Course[]; srsDue: number; vocabCount: number;
  hskAdded: number; hskTotal: number; activityDays: DayActivity[];
  onGoFlashcards: () => void;
}) {
  const level = (xp: number) => Math.floor(xp / 100) + 1;
  const maxAct = activityDays.reduce((m, d) => Math.max(m, d.value), 1);

  return (
    <div className="flex flex-col gap-6">
      {/* Level + Streak row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="jade-card p-5 sm:col-span-2">
          <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-faint)' }}>Tiến độ cấp độ</div>
          <div className="flex items-end justify-between mt-2">
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>Cấp {level(user.exp)}</div>
              <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: '.2rem' }}>
                Cần thêm {100 - (user.exp % 100)} XP để lên cấp {level(user.exp) + 1}
              </div>
            </div>
            <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--primary)' }}>{user.exp} XP tổng</div>
          </div>
          <div className="progress-track h-2 mt-3">
            <div className="progress-fill" style={{ width: `${user.exp % 100}%` }} />
          </div>
        </div>

        <div className="jade-card p-5 flex flex-col justify-between">
          <div>
            <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-faint)' }}>Hôm nay</div>
            <div className="flex items-center gap-2 mt-2">
              <Flame size={28} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '1.75rem', fontWeight: 800 }}>{user.streak} ngày</span>
            </div>
          </div>
          <div className="pt-3 border-t flex justify-between items-center" style={{ borderColor: 'var(--card-border)' }}>
            <div>
              <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Thẻ chờ ôn tập</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>{srsDue} thẻ</div>
            </div>
            <button className="btn-primary text-xs" onClick={onGoFlashcards}>Ôn ngay</button>
          </div>
        </div>
      </div>

      {/* Activity chart */}
      <div className="jade-card p-5">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>Hoạt động 7 ngày qua</div>
            <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>Số câu phản xạ đã trả lời mỗi ngày</div>
          </div>
          <span style={{ fontSize: '.72rem', fontWeight: 700, background: 'var(--primary-light)', color: 'var(--primary)', padding: '.2rem .65rem', borderRadius: '999px' }}>
            Dữ liệu thực
          </span>
        </div>
        <div className="flex items-end gap-2" style={{ height: '120px' }}>
          {activityDays.map((d, i) => {
            const pct = d.value ? Math.max(8, (d.value / maxAct) * 100) : 4;
            return (
              <div key={i} className="chart-bar-col">
                <div className="chart-bar-track" style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                  <div className="chart-bar-fill" style={{ height: `${pct}%` }} />
                  <div className="chart-bar-tooltip">{d.value} câu</div>
                </div>
                <span style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--text-faint)', marginTop: '.3rem' }}>{d.label}</span>
              </div>
            );
          })}
        </div>
        {activityDays.every(d => d.value === 0) && (
          <div style={{ fontSize: '.8rem', color: 'var(--text-faint)', textAlign: 'center', marginTop: '.75rem' }}>
            Chưa có dữ liệu – hãy bắt đầu luyện tập hôm nay!
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Thẻ SRS', val: srsDue, icon: '🎴' },
          { label: 'Từ sổ tay', val: vocabCount, icon: '📓' },
          { label: 'Đã học', val: hskAdded, icon: '✅' },
          { label: 'Thư viện', val: hskTotal, icon: '📚' },
        ].map(s => (
          <div key={s.label} className="jade-card p-4 text-center">
            <div style={{ fontSize: '1.5rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>{s.val}</div>
            <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '.1rem' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  // Layout
  const [tab, setTab] = useState<Tab>('dashboard');
  const [theme, setTheme] = useState<Theme>('jade');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Dashboard data
  const [courses, setCourses] = useState<Course[]>([]);
  const [srsDue, setSrsDue] = useState(0);
  const [vocabCount, setVocabCount] = useState(0);
  const [hskAdded, setHskAdded] = useState(0);
  const [hskTotal, setHskTotal] = useState(0);
  const [activityDays, setActivityDays] = useState<DayActivity[]>([]);

  // Audio
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceIdx, setVoiceIdx] = useState('');
  const [audioRate, setAudioRate] = useState(1.0);
  const audioCtx = useRef<AudioContext | null>(null);

  // ─── Init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('scholar-theme') as Theme || 'jade';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const load = () => {
        const vs = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('zh') || v.lang.startsWith('cmn'));
        setVoices(vs);
        const best = vs.findIndex(v => /xiaoxiao|meijia|chinese/i.test(v.name));
        setVoiceIdx(best >= 0 ? String(best) : vs.length ? '0' : '');
      };
      load();
      window.speechSynthesis.onvoiceschanged = load;
    }

    bootstrap();
  }, []);

  const bootstrap = async () => {
    setLoading(true);
    const [courseRes, actRes] = await Promise.all([getCourseList(), getDailyActivity()]);

    if (courseRes.success && courseRes.user) {
      setCourses(courseRes.courses || []);
      setUser(courseRes.user as User);
      setSrsDue(courseRes.stats?.srsDueCount || 0);
      setVocabCount(courseRes.stats?.vocabCount || 0);

      // Load HSK stats inline
      const { getHSK30Stats } = await import('./actions');
      const hsk = await getHSK30Stats();
      if (hsk.success) { setHskAdded(hsk.addedCount || 0); setHskTotal(hsk.totalCount || 0); }

      try { audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch (_) {}
    } else {
      setUser(null);
    }

    if (actRes.success && actRes.days) setActivityDays(actRes.days);
    setLoading(false);
  };

  const applyTheme = (t: Theme) => {
    setTheme(t); document.documentElement.setAttribute('data-theme', t); localStorage.setItem('scholar-theme', t);
  };

  const showToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(''), 2800);
  }, []);

  // ─── Audio ──────────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'zh-CN'; utt.rate = audioRate;
    if (voiceIdx !== '' && voices[+voiceIdx]) utt.voice = voices[+voiceIdx];
    window.speechSynthesis.speak(utt);
  }, [audioRate, voiceIdx, voices]);

  // ─── Auth handlers ──────────────────────────────────────────────────────
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthBusy(true);
    const r = authMode === 'register'
      ? await registerNewUser(emailInput, passInput, nameInput || emailInput.split('@')[0])
      : await loginUserAction(emailInput, passInput);
    setAuthBusy(false);
    if (r.success && r.user) {
      setUser(r.user as User);
      showToast(authMode === 'register' ? 'Đăng ký thành công!' : 'Đăng nhập thành công!');
      bootstrap();
    } else {
      showToast(r.error || 'Tài khoản hoặc mật khẩu không chính xác');
    }
  };

  const handleLogout = async () => {
    await logoutUser(); setUser(null); setTab('dashboard'); showToast('Đã đăng xuất');
  };

  // ─── Tab label ──────────────────────────────────────────────────────────
  const tabLabel: Record<Tab, string> = {
    dashboard: 'Bảng điều khiển', practice: 'Luyện phản xạ',
    flashcards: 'Flashcards & Thư viện HSK', reading: 'Bài đọc & Dịch nghĩa', notebook: 'Sổ tay từ vựng',
  };

  // ─── Loading screen ──────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex h-screen w-screen items-center justify-center" style={{ background: 'var(--bg-app)' }}>
      <p style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '1.1rem' }} className="animate-pulse">Đang tải Scholar...</p>
    </div>
  );

  // ─── Auth screen ─────────────────────────────────────────────────────────
  if (!user) return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: 'var(--bg-app)' }}>
      {/* Theme picker on auth */}
      <div className="absolute top-4 right-4 flex gap-2">
        {THEMES.map(t => (
          <div key={t} className={`theme-dot ${theme === t ? 'active' : ''}`}
            style={{ background: THEME_COLORS[t] }} onClick={() => applyTheme(t)} />
        ))}
      </div>

      <div className="jade-card p-8 w-full max-w-sm flex flex-col items-center gap-6">
        <div className="text-center">
          <div style={{ fontSize: '3.5rem', fontWeight: 900, color: 'var(--primary)', fontFamily: "'Noto Sans SC'" }}>学</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>Scholar</div>
          <p style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginTop: '.25rem' }}>
            {authMode === 'register' ? 'Tạo tài khoản học tiếng Trung' : 'Đăng nhập để học tiếng Trung'}
          </p>
        </div>
        <form className="auth-form" onSubmit={handleAuth}>
          {authMode === 'register' && (
            <div className="form-group">
              <label className="form-label">Tên hiển thị</label>
              <input className="form-input" type="text" placeholder="Nguyễn Văn A" value={nameInput} onChange={e => setNameInput(e.target.value)} />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="email@gmail.com" value={emailInput} onChange={e => setEmailInput(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Mật khẩu</label>
            <input className="form-input" type="password" placeholder="••••••" value={passInput} onChange={e => setPassInput(e.target.value)} required />
          </div>
          <button type="submit" className="btn-submit" disabled={authBusy}>
            {authBusy ? 'Đang xử lý...' : (authMode === 'register' ? 'Đăng ký →' : 'Đăng nhập →')}
          </button>
        </form>
        <div className="auth-toggle-hint">
          {authMode === 'register' ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
          <button className="btn-switch-auth" onClick={() => setAuthMode(m => m === 'login' ? 'register' : 'login')}>
            {authMode === 'register' ? 'Đăng nhập' : 'Đăng ký miễn phí'}
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Main layout ──────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'var(--bg-app)', color: 'var(--text-main)' }}>

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      {/* Desktop sidebar */}
      <Sidebar user={user} tab={tab} setTab={setTab} theme={theme} applyTheme={applyTheme} onLogout={handleLogout} />

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top header */}
        <header className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0"
          style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--card-border)' }}>
          <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>{tabLabel[tab]}</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: 'var(--primary-light)' }}>
              <Flame size={15} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--primary)' }}>{user.streak} ngày streak</span>
            </div>
            {/* Mobile theme dots */}
            <div className="flex md:hidden gap-1.5">
              {THEMES.map(t => (
                <div key={t} className={`theme-dot ${theme === t ? 'active' : ''}`}
                  style={{ background: THEME_COLORS[t], width: 16, height: 16 }} onClick={() => applyTheme(t)} />
              ))}
            </div>
          </div>
        </header>

        {/* Scroll area */}
        <main className="flex-1 overflow-y-auto main-scroll-area" style={{ background: 'var(--bg-app)' }}>
          <div className="max-w-5xl mx-auto px-4 py-6 md:px-8">

            {tab === 'dashboard' && (
              <DashboardTab
                user={user} courses={courses} srsDue={srsDue} vocabCount={vocabCount}
                hskAdded={hskAdded} hskTotal={hskTotal} activityDays={activityDays}
                onGoFlashcards={() => setTab('flashcards')}
              />
            )}

            {tab === 'practice' && (
              <PracticeTab
                initialCourses={courses}
                speak={speak}
                audioRate={audioRate}
                setAudioRate={setAudioRate}
                voices={voices}
                voiceIdx={voiceIdx}
                setVoiceIdx={setVoiceIdx}
                showToast={showToast}
                onExpGain={xp => setUser(u => u ? { ...u, exp: u.exp + xp } : u)}
              />
            )}

            {tab === 'flashcards' && (
              <FlashcardTab
                speak={speak}
                showToast={showToast}
                onSrsDueChange={n => setSrsDue(n)}
              />
            )}

            {tab === 'reading' && (
              <ReadingTab
                speak={speak}
                showToast={showToast}
                onVocabSaved={() => setVocabCount(c => c + 1)}
              />
            )}

            {tab === 'notebook' && (
              <NotebookTab speak={speak} showToast={showToast} />
            )}

          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="mobile-bottom-nav">
          {([
            ['dashboard', Home, 'Home'],
            ['practice', Brain, 'Phản xạ'],
            ['flashcards', Layers, 'Flashcard'],
            ['reading', BookOpen, 'Đọc'],
            ['notebook', Notebook, 'Sổ tay'],
          ] as [Tab, any, string][]).map(([id, Icon, label]) => (
            <button key={id} className={`mobile-nav-btn ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              <Icon size={22} /><span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
