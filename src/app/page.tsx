'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Home, Brain, Layers, BookOpen, Notebook, Flame } from 'lucide-react';
import { User, Course, Theme, THEMES, THEME_COLORS, DayActivity, DeckProgress } from './types';
import {
  getCourseList, getDailyActivity, getInProgressDecks
} from './actions';
import Sidebar from './components/Sidebar';
import FlashcardTab from './components/FlashcardTab';
import NotebookTab from './components/NotebookTab';
import ReadingTab from './components/ReadingTab';
import PracticeTab from './components/PracticeTab';
import { signIn, signOut, useSession } from '@/lib/auth-client';

type Tab = 'dashboard' | 'practice' | 'flashcards' | 'reading' | 'notebook';

// ─── Dashboard ────────────────────────────────────────────────────────────────
function DashboardTab({
  user, courses, srsDue, vocabCount, hskAdded, hskTotal, activityDays,
  inProgressDecks, hskLevelCounts,
  onGoFlashcards, onContinueDeck
}: {
  user: User; courses: Course[]; srsDue: number; vocabCount: number;
  hskAdded: number; hskTotal: number; activityDays: DayActivity[];
  inProgressDecks: DeckProgress[];
  hskLevelCounts: Record<string, number>;
  onGoFlashcards: () => void;
  onContinueDeck: (level: string, deckIndex: number) => void;
}) {
  const level = (xp: number) => Math.floor(xp / 100) + 1;
  const maxAct = activityDays.reduce((m, d) => Math.max(m, d.value), 1);

  return (
    <div className="flex flex-col gap-6">
      {/* Premium Hero Banner */}
      <div
        className="relative rounded-[28px] overflow-hidden bg-cover bg-center p-6 sm:p-8 flex flex-col justify-end min-h-[160px] sm:min-h-[200px] border border-primary-container/10 shadow-lg"
        style={{ backgroundImage: `linear-gradient(to right, rgba(3, 7, 18, 0.95), rgba(3, 7, 18, 0.55)), url('/mandarin_banner.png')` }}
      >
        <div className="relative z-10 max-w-xl">
          <span className="text-[9px] font-black text-[#34d399] bg-[#064e3b]/80 border border-[#065f46] px-2.5 py-0.5 rounded-full uppercase tracking-widest">
            Học tập thông minh
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white mt-2 drop-shadow-sm leading-tight">
            Chào mừng trở lại, {user.display_name || user.email.split('@')[0]}!
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
            Rèn luyện kỹ năng viết chữ Hán và ôn tập thẻ nhớ để duy trì chuỗi tiến độ học tập xuất sắc của bạn.
          </p>
        </div>
      </div>

      {/* Level + Streak row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="jade-card p-5 sm:col-span-2 bg-white dark:bg-slate-900 border dark:border-slate-800">
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
          <div className="progress-track h-2 mt-3 bg-slate-100 dark:bg-slate-800">
            <div className="progress-fill" style={{ width: `${user.exp % 100}%` }} />
          </div>
        </div>

        <div className="jade-card p-5 flex flex-col justify-between bg-white dark:bg-slate-900 border dark:border-slate-800">
          <div>
            <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-faint)' }}>Hôm nay</div>
            <div className="flex items-center gap-2 mt-2">
              <Flame size={28} className="text-amber-500 animate-pulse" />
              <span style={{ fontSize: '1.75rem', fontWeight: 800 }}>{user.streak} ngày</span>
            </div>
          </div>
          <div className="pt-3 border-t flex justify-between items-center dark:border-slate-850" style={{ borderColor: 'var(--card-border)' }}>
            <div>
              <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Thẻ chờ ôn tập</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>{srsDue} thẻ</div>
            </div>
            <button className="btn-primary text-xs shadow-sm hover:brightness-105" onClick={onGoFlashcards}>Ôn ngay</button>
          </div>
        </div>
      </div>

      {/* In-progress decks */}
      {inProgressDecks.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h3 style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
              📚 Tiếp tục học dở dang
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {inProgressDecks.map(deck => {
              const totalWords = hskLevelCounts[deck.level] || 0;
              const wordsInDeck = deck.deckIndex === Math.floor(totalWords / 50) ? (totalWords % 50) : 50;
              const studied = (deck.knownIds?.length || 0) + (deck.unknownIds?.length || 0);
              const percent = Math.min(100, Math.round((studied / wordsInDeck) * 100));

              return (
                <div key={deck.id} className="jade-card p-5 flex flex-col justify-between gap-4 bg-white dark:bg-slate-900 border dark:border-slate-800 hover:border-primary/40 transition-all hover:shadow-md">
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <span style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-faint)' }}>{deck.level} · Nhóm {deck.deckIndex + 1}</span>
                        <h4 style={{ fontWeight: 800, fontSize: '0.95rem', marginTop: '.15rem' }}>Từ {deck.deckIndex * 50 + 1} - {deck.deckIndex * 50 + wordsInDeck}</h4>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">
                        Đã học {percent}%
                      </span>
                    </div>
                    <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: '.5rem' }}>
                      Đã nhớ {deck.knownIds?.length || 0} từ · Chưa nhớ {deck.unknownIds?.length || 0} từ
                    </div>
                  </div>
                  
                  <div>
                    <div className="progress-track h-2 mb-3 bg-slate-100 dark:bg-slate-850">
                      <div className="progress-fill" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="flex justify-between items-center">
                      <span style={{ fontSize: '.72rem', color: 'var(--text-faint)', fontStyle: 'italic' }}>
                        Cập nhật: {new Date(deck.updatedAt).toLocaleDateString('vi-VN')}
                      </span>
                      <button className="btn-primary text-xs hover:brightness-105" onClick={() => onContinueDeck(deck.level, deck.deckIndex)}>
                        Học tiếp →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity chart */}
      <div className="jade-card p-5 bg-white dark:bg-slate-900 border dark:border-slate-800">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>Hoạt động 7 ngày qua</div>
            <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>Số câu phản xạ đã trả lời mỗi ngày</div>
          </div>
          <span style={{ fontSize: '.72rem', fontWeight: 800, background: 'var(--primary-light)', color: 'var(--primary)', padding: '.2rem .65rem', borderRadius: '999px' }}>
            Dữ liệu thực
          </span>
        </div>
        <div className="flex items-end gap-2 pt-2" style={{ height: '120px' }}>
          {activityDays.map((d, i) => {
            const pct = d.value ? Math.max(8, (d.value / maxAct) * 100) : 4;
            return (
              <div key={i} className="chart-bar-col">
                <div className="chart-bar-track bg-slate-100 dark:bg-slate-800" style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'flex-end' }}>
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
          <div key={s.label} className="jade-card p-4 text-center bg-white dark:bg-slate-900 border dark:border-slate-800 hover:scale-[1.03] transition-transform">
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
  const { data: session, isPending } = useSession();

  // Auth
  const [user, setUser] = useState<User | null>(null);
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
  const [inProgressDecks, setInProgressDecks] = useState<DeckProgress[]>([]);
  const [hskLevelCounts, setHskLevelCounts] = useState<Record<string, number>>({});

  // States to route study mode from Dashboard
  const [flashcardLevel, setFlashcardLevel] = useState<string | null>(null);
  const [flashcardDeckIdx, setFlashcardDeckIdx] = useState<number | null>(null);
  const [flashcardStudyMode, setFlashcardStudyMode] = useState<boolean>(false);
  const [flashcardSubTab, setFlashcardSubTab] = useState<'review' | 'library'>('review');

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
  }, []);

  // Sync Better Auth session user
  useEffect(() => {
    if (session?.user) {
      const nextUser: User = {
        id: session.user.id,
        email: session.user.email,
        display_name: session.user.name,
        exp: (session.user as any).exp ?? 0,
        max_combo: (session.user as any).maxCombo ?? 0,
        streak: (session.user as any).streak ?? 0,
        image: session.user.image,
      };
      setUser(prev => {
        if (!prev) return nextUser;
        if (
          prev.id !== nextUser.id ||
          prev.exp !== nextUser.exp ||
          prev.streak !== nextUser.streak ||
          prev.display_name !== nextUser.display_name ||
          prev.image !== nextUser.image
        ) {
          return nextUser;
        }
        return prev; // Prevent reference change loop
      });
    } else {
      setUser(null);
    }
  }, [session]);

  const prevUserId = useRef<string | null>(null);
  // Load user dashboard stats when user is authenticated (run once on login)
  useEffect(() => {
    if (user && user.id !== prevUserId.current) {
      prevUserId.current = user.id;
      bootstrap();
    } else if (!user) {
      prevUserId.current = null;
    }
  }, [user]);

  const refreshDashboard = async () => {
    const [courseRes, actRes] = await Promise.all([getCourseList(), getDailyActivity()]);
    if (courseRes.success && courseRes.user) {
      setCourses(courseRes.courses || []);
      setSrsDue(courseRes.stats?.srsDueCount || 0);
      setVocabCount(courseRes.stats?.vocabCount || 0);

      const { getHSK30Stats, getInProgressDecks } = await import('./actions');
      const [hsk, decksRes] = await Promise.all([getHSK30Stats(), getInProgressDecks()]);
      if (hsk.success) {
        setHskAdded(hsk.addedCount || 0);
        setHskTotal(hsk.totalCount || 0);
        setHskLevelCounts(hsk.levelCounts || {});
      }
      if (decksRes.success && decksRes.decks) {
        setInProgressDecks(decksRes.decks as DeckProgress[]);
      }
    }
    if (actRes.success && actRes.days) setActivityDays(actRes.days);
  };

  const bootstrap = async () => {
    setLoading(true);
    await refreshDashboard();
    if (user) {
      try { audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch (_) {}
    }
    setLoading(false);
  };

  const applyTheme = (t: Theme) => {
    setTheme(t); document.documentElement.setAttribute('data-theme', t); localStorage.setItem('scholar-theme', t);
  };

  const handleContinueDeck = (level: string, deckIndex: number) => {
    setFlashcardLevel(level);
    setFlashcardDeckIdx(deckIndex);
    setFlashcardStudyMode(true);
    setFlashcardSubTab('library');
    setTab('flashcards');
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
  const handleGoogleLogin = async () => {
    setAuthBusy(true);
    try {
      await signIn.social({
        provider: "google",
        callbackURL: window.location.origin
      });
    } catch (e: any) {
      showToast(e.message || "Đăng nhập Google thất bại");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    await signOut(); setUser(null); setTab('dashboard'); showToast('Đã đăng xuất');
  };

  // ─── Tab label ──────────────────────────────────────────────────────────
  const tabLabel: Record<Tab, string> = {
    dashboard: 'Bảng điều khiển', practice: 'Luyện phản xạ',
    flashcards: 'Flashcards & Thư viện HSK', reading: 'Bài đọc & Dịch nghĩa', notebook: 'Sổ tay từ vựng',
  };

  // ─── Loading / Session Sync Screen ─────────────────────────────────────────
  if (isPending) return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-3" style={{ background: 'var(--bg-app)' }}>
      <div className="spinner" />
      <p style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1rem' }} className="animate-pulse">Đang đồng bộ phiên học...</p>
    </div>
  );

  if (loading && user) return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-3" style={{ background: 'var(--bg-app)' }}>
      <div className="spinner" />
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

      <div className="jade-card p-8 w-full max-w-sm flex flex-col items-center gap-8 bg-white dark:bg-slate-900 border dark:border-slate-800">
        <div className="text-center">
          <div style={{ fontSize: '3.5rem', fontWeight: 900, color: 'var(--primary)', fontFamily: "'Noto Sans SC'" }}>学</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>Scholar</div>
          <p style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginTop: '.45rem' }}>
            Đăng nhập bằng Google để học tiếng Trung miễn phí
          </p>
        </div>
        
        <button 
          onClick={handleGoogleLogin} 
          className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 font-extrabold text-sm hover:bg-slate-50 dark:hover:bg-slate-850/60 transition-colors bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 shadow-sm"
          disabled={authBusy}
        >
          {authBusy ? (
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#ea4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.41 0-6.19-2.78-6.19-6.19s2.78-6.19 6.19-6.19c1.7 0 3.227.69 4.33 1.794l3.197-3.193C19.24 1.94 15.94 1 12.24 1 6.05 1 1 6.05 1 12.24s4.95 11.24 11.24 11.24c5.73 0 10.51-4.11 10.51-11.24 0-.77-.07-1.42-.2-1.95H12.24z"/>
            </svg>
          )}
          <span>Đăng nhập với Google</span>
        </button>
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
                inProgressDecks={inProgressDecks}
                hskLevelCounts={hskLevelCounts}
                onGoFlashcards={() => setTab('flashcards')}
                onContinueDeck={handleContinueDeck}
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
                initialSubTab={flashcardSubTab}
                initialLevel={flashcardLevel}
                initialDeckIdx={flashcardDeckIdx}
                initialStudyMode={flashcardStudyMode}
                onCloseDeck={() => {
                  setFlashcardLevel(null);
                  setFlashcardDeckIdx(null);
                  setFlashcardStudyMode(false);
                  setFlashcardSubTab('review');
                  refreshDashboard();
                }}
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
