'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2, Check, Plus, RotateCcw, ChevronLeft, ChevronRight,
  BookOpen, Star, HelpCircle, AlertCircle, Sparkles, X, ArrowRight, FolderPlus, FolderOpen, Trash2
} from 'lucide-react';
import { Flashcard, HSKWord, HSK_LEVELS, DeckProgress } from '../types';
import {
  getFlashcardsDue, addFlashcard, recordFlashcardReview,
  getHSK30Stats, getHSK30DeckWords, addHSK30WordToFlashcards,
  saveDeckProgress, getDeckProgress, getInProgressDecks,
  createFolder, getFolders, deleteFolder
} from '../actions';
import gsap from 'gsap';

// ─── Swipeable Card Component ──────────────────────────────────────────────────
interface SwipeableCardProps {
  flipped: boolean;
  onFlip: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  speak: (text: string) => void;
  zh: string;
  pinyin: string;
  vi: string;
  label?: string;
  type?: string;
  level?: string;
  exampleZh?: string;
  examplePinyin?: string;
  exampleVi?: string;
  disabled?: boolean;
  resetCount?: number;
}

function SwipeableCard({
  flipped, onFlip, onSwipeLeft, onSwipeRight, speak,
  zh, pinyin, vi, label, type, level, exampleZh, examplePinyin, exampleVi,
  disabled = false, resetCount = 0
}: SwipeableCardProps) {
  const cardInnerRef = useRef<HTMLDivElement>(null);
  const stampLeftRef = useRef<HTMLDivElement>(null);
  const stampRightRef = useRef<HTMLDivElement>(null);

  const isDragging = useRef(false);
  const startX = useRef(0);
  const dragX = useRef(0);

  // Trigger scale-in transition when character/word changes
  useEffect(() => {
    if (cardInnerRef.current) {
      gsap.killTweensOf(cardInnerRef.current);
      gsap.set(cardInnerRef.current, { x: 0, y: 0, rotationZ: 0, rotationY: flipped ? 180 : 0, scale: 0.94, opacity: 0 });
      gsap.to(cardInnerRef.current, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.2)' });
    }
    if (stampLeftRef.current) stampLeftRef.current.style.opacity = '0';
    if (stampRightRef.current) stampRightRef.current.style.opacity = '0';
    dragX.current = 0;
  }, [zh]);

  // Handle reset count to slide card back to center if swipe action is cancelled/failed
  useEffect(() => {
    if (resetCount > 0 && cardInnerRef.current) {
      gsap.to(cardInnerRef.current, {
        x: 0,
        rotationZ: 0,
        opacity: 1,
        duration: 0.3,
        ease: 'power2.out'
      });
      if (stampLeftRef.current) stampLeftRef.current.style.opacity = '0';
      if (stampRightRef.current) stampRightRef.current.style.opacity = '0';
    }
  }, [resetCount]);

  // Flip rotation animation
  useEffect(() => {
    if (cardInnerRef.current) {
      gsap.to(cardInnerRef.current, {
        rotationY: flipped ? 180 : 0,
        duration: 0.5,
        ease: 'back.out(1.2)'
      });
    }
  }, [flipped]);

  const handleStart = (e: React.MouseEvent | React.TouchEvent, clientX: number) => {
    if (disabled) return;
    
    // Crucial Bug Fix: If user clicked a button (like speak audio or add SRS), do not flip/drag card!
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('select') || target.closest('input')) {
      return;
    }
    
    isDragging.current = true;
    startX.current = clientX;
    dragX.current = 0;
    if (cardInnerRef.current) {
      cardInnerRef.current.style.transition = 'none';
    }
  };

  const handleMove = (clientX: number) => {
    if (disabled || !isDragging.current) return;
    const deltaX = clientX - startX.current;
    dragX.current = deltaX;

    // Translate and rotate card slightly during drag
    if (cardInnerRef.current) {
      gsap.set(cardInnerRef.current, {
        x: deltaX,
        rotationZ: deltaX * 0.05
      });
    }

    // Dynamic stamp opacity
    if (deltaX > 20) {
      const opacity = Math.min(0.95, (deltaX - 20) / 100);
      if (stampRightRef.current) stampRightRef.current.style.opacity = String(opacity);
      if (stampLeftRef.current) stampLeftRef.current.style.opacity = '0';
    } else if (deltaX < -20) {
      const opacity = Math.min(0.95, (-deltaX - 20) / 100);
      if (stampLeftRef.current) stampLeftRef.current.style.opacity = String(opacity);
      if (stampRightRef.current) stampRightRef.current.style.opacity = '0';
    } else {
      if (stampLeftRef.current) stampLeftRef.current.style.opacity = '0';
      if (stampRightRef.current) stampRightRef.current.style.opacity = '0';
    }
  };

  const handleEnd = () => {
    if (disabled || !isDragging.current) return;
    isDragging.current = false;

    // Fade out stamps
    gsap.to([stampLeftRef.current, stampRightRef.current], { opacity: 0, duration: 0.15 });

    const threshold = 120;
    if (dragX.current > threshold) {
      // Swipe Right (Mastered / Good)
      gsap.to(cardInnerRef.current, {
        x: 600,
        rotationZ: 20,
        opacity: 0,
        duration: 0.3,
        onComplete: onSwipeRight
      });
    } else if (dragX.current < -threshold) {
      // Swipe Left (Wrong / Again)
      gsap.to(cardInnerRef.current, {
        x: -600,
        rotationZ: -20,
        opacity: 0,
        duration: 0.3,
        onComplete: onSwipeLeft
      });
    } else {
      // Check if it's a simple tap or minor drag
      if (Math.abs(dragX.current) < 8) {
        onFlip();
      } else {
        // Return to center
        gsap.to(cardInnerRef.current, {
          x: 0,
          rotationZ: 0,
          duration: 0.25,
          ease: 'power2.out'
        });
      }
    }
  };

  return (
    <div
      className={`quizlet-card-container w-full select-none ${disabled ? 'opacity-80' : ''}`}
      onMouseDown={e => handleStart(e, e.clientX)}
      onMouseMove={e => handleMove(e.clientX)}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={e => handleStart(e, e.touches[0].clientX)}
      onTouchMove={e => handleMove(e.touches[0].clientX)}
      onTouchEnd={handleEnd}
    >
      {/* Visual Swipe Stamps */}
      <div ref={stampRightRef} className="swipe-stamp right">
        ĐÃ NHỚ
      </div>
      <div ref={stampLeftRef} className="swipe-stamp left">
        CHƯA NHỚ
      </div>

      <div ref={cardInnerRef} className="quizlet-card-inner shadow-xl">
        {/* Busy/Loading Overlay */}
        {disabled && (
          <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] rounded-[24px] z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white/95 dark:bg-slate-900/95 p-4 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Đang đồng bộ...</span>
            </div>
          </div>
        )}

        {/* Front Face */}
        <div className="quizlet-card-face border border-primary-container/20 rounded-[24px] p-6 sm:p-8 flex flex-col justify-between items-center bg-white dark:bg-slate-900">
          <div className="w-full flex justify-between items-center">
            <span className="qcard-label text-xs font-bold text-slate-400 tracking-wider">
              {label || 'MẶT TRƯỚC'}
            </span>
            {level && (
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                {level}
              </span>
            )}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="qcard-hz zh select-none font-black text-primary leading-none text-7xl sm:text-8xl drop-shadow-sm">
              {zh}
            </div>
            {type && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded">
                {type}
              </span>
            )}
          </div>

          <div className="w-full flex flex-col items-center gap-3">
            <button
              className="qcard-speak-btn hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
              onClick={e => { e.stopPropagation(); speak(zh); }}
              disabled={disabled}
            >
              <Volume2 size={13} />
              <span className="text-xs font-semibold">Phát âm</span>
            </button>
            <span className="text-[10px] text-slate-300 dark:text-slate-600 font-bold uppercase tracking-wider animate-pulse flex items-center gap-1">
              <span>👉 Chạm để lật mặt sau</span>
            </span>
          </div>
        </div>

        {/* Back Face */}
        <div className="quizlet-card-face back border-2 border-primary rounded-[24px] p-6 sm:p-8 flex flex-col justify-between bg-[#f4faf7] dark:bg-[#0c1f18]">
          <div className="w-full flex justify-between items-center">
            <span className="text-[10px] font-bold text-emerald-800/60 dark:text-emerald-400/60 uppercase tracking-widest">
              ĐÁP ÁN
            </span>
            <button
              className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
              onClick={e => { e.stopPropagation(); speak(zh); }}
              disabled={disabled}
            >
              <Volume2 size={14} />
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-center gap-5 w-full text-left my-4 overflow-y-auto">
            <div>
              <div className="text-3xl font-black text-primary zh">{zh}</div>
              <div className="text-lg font-bold text-amber-600 tracking-wide mt-0.5">{pinyin}</div>
            </div>

            <div>
              <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider block mb-1">Ý nghĩa</span>
              <p className="text-slate-800 dark:text-slate-200 font-semibold leading-snug text-base md:text-lg">{vi}</p>
            </div>

            {exampleZh && (
              <div className="bg-white dark:bg-slate-900 p-2 sm:p-3 rounded-xl border border-primary/10 mt-1 sm:mt-2">
                <span className="text-[8px] sm:text-[9px] font-extrabold uppercase text-emerald-800/50 dark:text-emerald-400/50 tracking-wider block mb-0.5">Ví dụ câu</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 zh text-xs sm:text-sm leading-normal">{exampleZh}</p>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">{examplePinyin}</p>
                <p className="text-[10px] sm:text-xs text-slate-400 italic mt-0.5">{exampleVi}</p>
              </div>
            )}
          </div>

          <div className="w-full text-center">
            <span className="text-[9px] font-bold text-emerald-800/40 dark:text-emerald-400/40 uppercase tracking-wider">
              Vuốt Trái: Chưa nhớ · Vuốt Phải: Đã nhớ
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SRS Review Component ─────────────────────────────────────────────────────
interface SRSProps {
  speak: (text: string) => void;
  onDueCountChange: (n: number) => void;
  showToast: (msg: string) => void;
  folders: { id: number; name: string }[];
  selectedFolderId: number | null;
  setSelectedFolderId: (id: number | null) => void;
}

function SRSReview({ speak, onDueCountChange, showToast, folders, selectedFolderId, setSelectedFolderId }: SRSProps) {
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newZh, setNewZh] = useState('');
  const [newVi, setNewVi] = useState('');
  const [newPy, setNewPy] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const [addFolderId, setAddFolderId] = useState<string>('');

  useEffect(() => { load(); }, [selectedFolderId]);

  const load = async () => {
    setLoading(true);
    const r = await getFlashcardsDue(selectedFolderId || undefined);
    if (r.success && r.cards) {
      setDueCards(r.cards);
      setCardIdx(0);
      setFlipped(false);
      onDueCountChange(r.cards.length);
    }
    setLoading(false);
  };

  const rate = async (score: number) => {
    if (!dueCards.length || isSaving) return;
    const card = dueCards[cardIdx];
    setIsSaving(true);
    
    // Server record
    const r = await recordFlashcardReview(card.id, score);
    if (r.success) {
      setFlipped(false);
      // Brief delay to allow card to flip back smoothly before advancing
      setTimeout(() => {
        if (cardIdx < dueCards.length - 1) {
          setCardIdx(i => i + 1);
        } else {
          setDueCards([]);
          onDueCountChange(0);
          try { (window as any).confetti?.({ particleCount: 100, spread: 70, origin: { y: 0.7 } }); } catch (_) {}
          showToast('Chúc mừng! Bạn đã hoàn thành các thẻ ôn tập hôm nay!');
        }
        setIsSaving(false);
      }, 150);
    } else {
      setIsSaving(false);
      setResetCount(c => c + 1); // Trigger card to slide back to center
      showToast(r.error || 'Lỗi đồng bộ đánh giá');
    }
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZh || !newVi) return;
    setIsSaving(true);
    const r = await addFlashcard(newZh, newVi, newPy, addFolderId ? parseInt(addFolderId, 10) : undefined);
    setIsSaving(false);
    if (r.success) {
      showToast('Đã tạo flashcard thành công!');
      setNewZh(''); setNewVi(''); setNewPy('');
      setShowAdd(false);
      load();
    } else {
      showToast(r.error || 'Lỗi tạo thẻ');
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: 'var(--primary)' }}>
      <div className="spinner" />
      <span className="font-bold text-sm">Đang tải thẻ ôn tập do hạn...</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>Ôn tập Spaced Repetition</div>
          <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>Tự động nhắc lại từ vựng dựa trên độ nhớ</div>
        </div>
        <div className="flex items-center gap-2">
          {/* Folder filter */}
          <select
            className="form-input text-xs font-bold py-1.5 px-2 bg-white dark:bg-slate-800"
            value={selectedFolderId || ''}
            onChange={e => setSelectedFolderId(e.target.value ? parseInt(e.target.value, 10) : null)}
          >
            <option value="">📂 Tất cả chủ đề</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <button className="btn-ghost" onClick={load} title="Tải lại" disabled={isSaving}><RotateCcw size={14} /></button>
          <button className="btn-primary text-xs whitespace-nowrap flex items-center gap-1.5" onClick={() => setShowAdd(p => !p)} disabled={isSaving}>
            {showAdd ? <X size={13} /> : <Plus size={13} />}
            <span>{showAdd ? 'Hủy' : 'Tạo thẻ nhớ'}</span>
          </button>
        </div>
      </div>

      {/* Add card form */}
      {showAdd && (
        <form className="jade-card p-5 flex flex-col gap-3 max-w-lg mx-auto w-full bg-white dark:bg-slate-900 border dark:border-slate-800" onSubmit={submitNew}>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>Tạo thẻ nhớ tự do</div>
          <div className="form-group">
            <label className="form-label text-[10px]">Mặt trước (Chữ Hán/Từ vựng)</label>
            <input className="form-input" placeholder="例如: 学习" value={newZh} onChange={e => setNewZh(e.target.value)} required disabled={isSaving} />
          </div>
          <div className="form-group">
            <label className="form-label text-[10px]">Mặt sau (Giải nghĩa tiếng Việt)</label>
            <input className="form-input" placeholder="Ví dụ: Học tập, nghiên cứu" value={newVi} onChange={e => setNewVi(e.target.value)} required disabled={isSaving} />
          </div>
          <div className="form-group">
            <label className="form-label text-[10px]">Pinyin phiên âm (Để trống sẽ tự tạo)</label>
            <input className="form-input" placeholder="Ví dụ: xuéxí" value={newPy} onChange={e => setNewPy(e.target.value)} disabled={isSaving} />
          </div>
          <div className="form-group">
            <label className="form-label text-[10px]">Chọn chủ đề / Folder</label>
            <select
              className="form-input bg-white dark:bg-slate-800"
              value={addFolderId}
              onChange={e => setAddFolderId(e.target.value)}
              disabled={isSaving}
            >
              <option value="">Không có chủ đề</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-submit text-xs py-2.5 font-bold uppercase tracking-wider flex items-center justify-center gap-2" disabled={isSaving}>
            {isSaving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Tạo thẻ
          </button>
        </form>
      )}

      {/* Card arena */}
      {dueCards.length > 0 ? (
        <div className="flex flex-col items-center gap-4 w-full max-w-3xl mx-auto">
          {/* Progress */}
          <div className="w-full flex items-center justify-between gap-4 px-1">
            <span style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              Tiến độ ôn tập
            </span>
            <span style={{ fontSize: '.75rem', fontWeight: 800, color: 'var(--primary)' }}>
              {cardIdx + 1} / {dueCards.length}
            </span>
          </div>
          <div className="quizlet-progress-bar">
            <div className="quizlet-progress-fill" style={{ width: `${((cardIdx) / dueCards.length) * 100}%` }} />
          </div>

          {/* Swipeable Card wrapper */}
          <SwipeableCard
            flipped={flipped}
            onFlip={() => setFlipped(f => !f)}
            onSwipeLeft={() => rate(1)}
            onSwipeRight={() => rate(3)}
            speak={speak}
            zh={dueCards[cardIdx].zh}
            pinyin={dueCards[cardIdx].pinyin || ''}
            vi={dueCards[cardIdx].vi}
            label={`THẺ ÔN TẬP · HẠN HÔM NAY`}
            level={`SRS`}
            disabled={isSaving}
            resetCount={resetCount}
          />

          {/* Rating controls / instruction */}
          <div className="w-full text-center">
            {!flipped ? (
              <div className="text-xs py-2 text-slate-400 font-medium">
                💡 Bạn có thể vuốt thẻ hoặc chạm để lật xem đáp án
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 border-slate-100 p-4 rounded-2xl flex flex-col gap-3 shadow-sm mt-1">
                <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">
                  Đánh giá độ nhớ từ này
                </span>
                <div className="grid grid-cols-4 gap-2">
                  <button className="btn-srs again text-[11px] py-2.5 rounded-xl font-bold" onClick={() => rate(1)} disabled={isSaving}>
                    <span>Quên</span>
                    <span className="btn-srs-interval text-[8px] mt-0.5">1m</span>
                  </button>
                  <button className="btn-srs hard text-[11px] py-2.5 rounded-xl font-bold" onClick={() => rate(2)} disabled={isSaving}>
                    <span>Khó</span>
                    <span className="btn-srs-interval text-[8px] mt-0.5">2d</span>
                  </button>
                  <button className="btn-srs good text-[11px] py-2.5 rounded-xl font-bold" onClick={() => rate(2)} disabled={isSaving}>
                    <span>Nhớ</span>
                    <span className="btn-srs-interval text-[8px] mt-0.5">4d</span>
                  </button>
                  <button className="btn-srs easy text-[11px] py-2.5 rounded-xl font-bold" onClick={() => rate(3)} disabled={isSaving}>
                    <span>Dễ</span>
                    <span className="btn-srs-interval text-[8px] mt-0.5">7d</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="jade-card p-10 text-center max-w-md mx-auto flex flex-col items-center gap-4 bg-white dark:bg-slate-900 border dark:border-slate-800">
          <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl shadow-inner animate-bounce-subtle">
            🎉
          </div>
          <div>
            <h4 style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.25rem' }}>
              Tuyệt vời! Đã hết thẻ ôn tập!
            </h4>
            <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: '.35rem' }} className="leading-relaxed">
              Tất cả flashcard trong hộp nhớ của bạn đều đang ở trạng thái tốt. Sang thư viện HSK để học thêm từ mới!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Deck Study Mode (Quizlet smart loop style) ─────────────────────────────────
interface StudyModeProps {
  words: HSKWord[];
  deckLabel: string;
  level: string;
  deckIndex: number;
  speak: (text: string) => void;
  onBack: () => void;
}

function DeckStudyMode({ words, deckLabel, level, deckIndex, speak, onBack }: StudyModeProps) {
  const [activeQueue, setActiveQueue] = useState<HSKWord[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [unknown, setUnknown] = useState<Set<number>>(new Set());
  const [sessionCount, setSessionCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [resetCount, setResetCount] = useState(0);

  // Load progress from DB on mount
  useEffect(() => {
    const initSession = async () => {
      setLoading(true);
      const res = await getDeckProgress(level, deckIndex);
      if (res.success && res.progress) {
        const savedProgress = res.progress as DeckProgress;
        const savedKnown = new Set(savedProgress.knownIds || []);
        const savedUnknown = new Set(savedProgress.unknownIds || []);
        setKnown(savedKnown);
        setUnknown(savedUnknown);
        setSessionCount(words.length);

        // Queue contains all words in the deck whose IDs are NOT in savedKnown
        const queue = words.filter(w => !savedKnown.has(w.id));
        
        if (queue.length === 0) {
          // If already completed but they opened it again, reset
          setActiveQueue([...words]);
          setKnown(new Set());
          setUnknown(new Set());
        } else {
          setActiveQueue(queue);
        }
      } else {
        // Start fresh
        setActiveQueue([...words]);
        setSessionCount(words.length);
      }
      setLoading(false);
    };

    initSession();
  }, [words, level, deckIndex]);

  const card = activeQueue[currentIdx];

  const handleSwipeRight = async () => {
    if (!card || isSaving) return;
    const wordId = card.id;
    setIsSaving(true);

    const nextKnown = new Set(known).add(wordId);
    const nextUnknown = new Set(unknown);
    nextUnknown.delete(wordId);

    // Smart Queue Logic: remove from queue
    const nextQueue = activeQueue.filter((_, idx) => idx !== currentIdx);
    const isFinished = nextQueue.length === 0;

    // Save progress to DB
    const r = await saveDeckProgress(level, deckIndex, Array.from(nextKnown), Array.from(nextUnknown), isFinished);
    
    if (r.success) {
      setKnown(nextKnown);
      setUnknown(nextUnknown);
      setFlipped(false);
      setIsSaving(false);

      if (isFinished) {
        setFinished(true);
        try { (window as any).confetti?.({ particleCount: 100, spread: 70, origin: { y: 0.7 } }); } catch (_) {}
      } else {
        setActiveQueue(nextQueue);
        if (currentIdx >= nextQueue.length) {
          setCurrentIdx(0);
        }
      }
    } else {
      setIsSaving(false);
      setResetCount(c => c + 1); // Slide card back
    }
  };

  const handleSwipeLeft = async () => {
    if (!card || isSaving) return;
    const wordId = card.id;
    setIsSaving(true);

    const nextUnknown = new Set(unknown).add(wordId);

    // Smart Queue Logic: Move card to the END of the queue
    const nextQueue = [...activeQueue];
    const [movedCard] = nextQueue.splice(currentIdx, 1);
    nextQueue.push(movedCard);

    // Save progress to DB
    const r = await saveDeckProgress(level, deckIndex, Array.from(known), Array.from(nextUnknown), false);
    
    if (r.success) {
      setUnknown(nextUnknown);
      setFlipped(false);
      setIsSaving(false);
      setActiveQueue(nextQueue);
      if (currentIdx >= nextQueue.length - 1) {
        setCurrentIdx(0);
      }
    } else {
      setIsSaving(false);
      setResetCount(c => c + 1); // Slide card back
    }
  };

  const restartSession = async () => {
    setFinished(false);
    setLoading(true);
    await saveDeckProgress(level, deckIndex, [], [], false);
    setKnown(new Set());
    setUnknown(new Set());
    setActiveQueue([...words]);
    setCurrentIdx(0);
    setFlipped(false);
    setLoading(false);
  };

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (finished || loading || isSaving || activeQueue.length === 0) return;
      if (e.key === ' ') {
        e.preventDefault();
        setFlipped(f => !f);
      }
      if (e.key === 'ArrowRight') {
        handleSwipeRight();
      }
      if (e.key === 'ArrowLeft') {
        handleSwipeLeft();
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [currentIdx, activeQueue, flipped, known, unknown, finished, loading, isSaving]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: 'var(--primary)' }}>
        <div className="spinner" />
        <span className="font-bold text-sm">Đang tải tiến trình học...</span>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="jade-card p-10 text-center max-w-md mx-auto flex flex-col gap-5 bg-white dark:bg-slate-900 border dark:border-slate-800">
        <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl shadow-inner animate-bounce-subtle mx-auto">
          🏆
        </div>
        <div>
          <h4 style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)' }}>
            Hoàn thành {deckLabel}!
          </h4>
          <p style={{ fontSize: '.8rem', color: 'var(--text-muted)' }} className="mt-1">
            Bạn đã ghi nhớ toàn bộ từ vựng trong nhóm này!
          </p>
        </div>

        <div className="flex justify-center gap-8 py-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="text-center">
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success-color)' }}>{known.size}</div>
            <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Đã nhớ tốt ✓</div>
          </div>
          <div className="text-center">
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--warning-color)' }}>{unknown.size}</div>
            <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Cần ôn thêm</div>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <button className="btn-primary w-full justify-center py-2.5 text-xs font-bold uppercase tracking-wider" onClick={restartSession} disabled={isSaving}>
            <RotateCcw size={13} /> Học lại từ đầu
          </button>
          <button className="btn-ghost w-full justify-center py-2.5 text-xs font-bold uppercase tracking-wider" onClick={onBack} disabled={isSaving}>
            <ChevronLeft size={13} /> Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  const studiedCount = known.size;
  const progressPercent = sessionCount > 0 ? Math.round((studiedCount / sessionCount) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4">
        <button className="btn-ghost text-xs" onClick={onBack} disabled={isSaving}>
          <ChevronLeft size={13} /> Lưu & Quay lại
        </button>
        <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">
          {deckLabel}
        </span>
      </div>

      {/* Progress metrics */}
      <div className="w-full flex items-center justify-between gap-2 px-1 text-xs">
        <span className="font-bold text-slate-500">Tiến độ ghi nhớ</span>
        <span className="font-extrabold text-primary">{studiedCount} / {sessionCount} từ ({progressPercent}%)</span>
      </div>
      <div className="quizlet-progress-bar">
        <div className="quizlet-progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      {/* Active Card Container */}
      {card && (
        <SwipeableCard
          flipped={flipped}
          onFlip={() => setFlipped(f => !f)}
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          speak={speak}
          zh={card.word}
          pinyin={card.pinyin}
          vi={card.meaning}
          label={`${level} · NHÓM ${deckIndex + 1}`}
          type={card.wordType}
          exampleZh={card.exampleZh}
          examplePinyin={card.examplePinyin}
          exampleVi={card.exampleVi}
          disabled={isSaving}
          resetCount={resetCount}
        />
      )}

      {/* Helper text */}
      <div className="text-center py-1 text-[10px] text-slate-400 font-medium">
        💡 Mẹo: Nhấn Phím cách để lật thẻ · Mũi tên Trái = Chưa nhớ · Mũi tên Phải = Đã nhớ
      </div>

      {/* Quick Action buttons */}
      <div className="flex gap-3 justify-center items-center mt-1">
        <button
          className="flex-1 py-3 rounded-2xl font-bold text-xs border border-red-200 dark:border-red-900/30 transition-all text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
          style={{ background: 'var(--card-bg)' }}
          onClick={handleSwipeLeft}
          disabled={isSaving}
        >
          😵 Chưa nhớ
        </button>
        <button
          className="flex-grow py-3 px-6 rounded-2xl font-extrabold text-xs transition-all text-white bg-primary hover:brightness-105 flex items-center justify-center gap-1.5"
          onClick={() => setFlipped(f => !f)}
          disabled={isSaving}
        >
          {isSaving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {flipped ? 'Mặt trước' : 'Mặt sau'}
        </button>
        <button
          className="flex-1 py-3 rounded-2xl font-bold text-xs border border-emerald-200 dark:border-emerald-900/30 transition-all text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
          style={{ background: 'var(--card-bg)' }}
          onClick={handleSwipeRight}
          disabled={isSaving}
        >
          ✓ Đã nhớ tốt!
        </button>
      </div>
    </div>
  );
}

// ─── HSK Library Component ────────────────────────────────────────────────────
interface LibraryProps {
  speak: (text: string) => void;
  showToast: (msg: string) => void;
  onSrsDueChange: (delta: number) => void;
  initialLevel?: string | null;
  initialDeckIdx?: number | null;
  initialStudyMode?: boolean;
  onCloseDeck?: () => void;
  folders: { id: number; name: string }[];
  onStudyModeChange?: (active: boolean) => void;
}

function HSKLibrary({
  speak, showToast, onSrsDueChange,
  initialLevel, initialDeckIdx, initialStudyMode, onCloseDeck, folders,
  onStudyModeChange
}: LibraryProps) {
  const [hskStats, setHskStats] = useState({ totalCount: 0, addedCount: 0, levelCounts: {} as Record<string, number> });
  const [selLevel, setSelLevel] = useState('HSK1');
  const [deckIdx, setDeckIdx] = useState<number | null>(null);
  const [deckWords, setDeckWords] = useState<HSKWord[]>([]);
  const [deckLoading, setDeckLoading] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const [dbDecks, setDbDecks] = useState<DeckProgress[]>([]);
  
  // Custom folder selection for word addition
  const [addingToFolderMap, setAddingToFolderMap] = useState<Record<number, string>>({});
  const [addingWordIds, setAddingWordIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    refreshStats();
    loadInProgressDecks();
  }, []);

  useEffect(() => {
    if (onStudyModeChange) {
      onStudyModeChange(studyMode && deckIdx !== null);
    }
  }, [studyMode, deckIdx, onStudyModeChange]);

  // Handle routing state passed from Dashboard
  useEffect(() => {
    if (initialLevel) {
      setSelLevel(initialLevel);
    }
    if (initialDeckIdx !== undefined && initialDeckIdx !== null) {
      openDeck(initialLevel || 'HSK1', initialDeckIdx, initialStudyMode || false);
    }
  }, [initialLevel, initialDeckIdx, initialStudyMode]);

  const refreshStats = async () => {
    const r = await getHSK30Stats();
    if (r.success) setHskStats({ totalCount: r.totalCount || 0, addedCount: r.addedCount || 0, levelCounts: r.levelCounts || {} });
  };

  const loadInProgressDecks = async () => {
    const r = await getInProgressDecks();
    if (r.success && r.decks) {
      setDbDecks(r.decks as DeckProgress[]);
    }
  };

  const handleLevelChange = async (lv: string) => {
    setDeckLoading(true);
    setSelLevel(lv);
    setDeckIdx(null);
    setStudyMode(false);
    await new Promise(resolve => setTimeout(resolve, 250));
    setDeckLoading(false);
  };

  const openDeck = async (level: string, idx: number, forceStudy: boolean = false) => {
    setDeckIdx(idx);
    setDeckLoading(true);
    setStudyMode(forceStudy);
    const r = await getHSK30DeckWords(level, idx);
    if (r.success && r.words) {
      setDeckWords(r.words);
    }
    setDeckLoading(false);
  };

  const addToSRS = async (w: HSKWord) => {
    setAddingWordIds(prev => new Set(prev).add(w.id));
    setDeckWords(prev => prev.map(x => x.id === w.id ? { ...x, isAdded: false } : x));
    const targetFolderId = addingToFolderMap[w.id] ? parseInt(addingToFolderMap[w.id], 10) : undefined;
    
    const r = await addHSK30WordToFlashcards(w.id, targetFolderId);
    setAddingWordIds(prev => {
      const next = new Set(prev);
      next.delete(w.id);
      return next;
    });
    if (r.success) {
      showToast(`Đã thêm "${w.word}" vào SRS thành công!`);
      setDeckWords(prev => prev.map(x => x.id === w.id ? { ...x, isAdded: true } : x));
      setHskStats(prev => ({ ...prev, addedCount: prev.addedCount + 1 }));
      onSrsDueChange(1);
    } else {
      showToast(r.error || 'Lỗi thêm từ');
      setDeckWords(prev => prev.map(x => x.id === w.id ? { ...x, isAdded: false } : x));
    }
  };

  const deckCount = (lv: string) => hskStats.levelCounts[lv] || 0;
  const decksFor  = (lv: string) => Math.max(1, Math.ceil(deckCount(lv) / 50));

  const getSavedDeckProgress = (lv: string, idx: number) => {
    return dbDecks.find(d => d.level === lv && d.deckIndex === idx);
  };

  if (studyMode && deckIdx !== null) return (
    <DeckStudyMode
      words={deckWords}
      deckLabel={`${selLevel} · Nhóm ${deckIdx + 1}`}
      level={selLevel}
      deckIndex={deckIdx}
      speak={speak}
      onBack={() => {
        setStudyMode(false);
        loadInProgressDecks();
        if (onCloseDeck) onCloseDeck();
      }}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Stats */}
      <div style={{ fontSize: '.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
        Tổng thư viện HSK: <strong style={{ color: 'var(--primary)' }}>{hskStats.totalCount}</strong> từ ·
        Đang ôn tập SRS: <strong style={{ color: 'var(--primary)' }}>{hskStats.addedCount}</strong> từ
      </div>

      {/* Level tabs */}
      <div className="hsk-level-tabs">
        {HSK_LEVELS.map(lv => (
          <button key={lv} className={`hsk-level-tab ${selLevel === lv ? 'active' : ''}`}
            onClick={() => handleLevelChange(lv)}>
            {lv}
          </button>
        ))}
      </div>

      {deckIdx === null ? (
        /* Deck list */
        deckLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--primary)' }}>
            <div className="spinner" />
            <span className="font-bold text-sm">Đang chuyển đổi cấp độ HSK...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: decksFor(selLevel) }).map((_, i) => {
            const s = i * 50 + 1;
            const e = Math.min((i + 1) * 50, deckCount(selLevel) || 50);
            
            const progress = getSavedDeckProgress(selLevel, i);
            const totalInThisDeck = e - s + 1;
            const studied = progress ? (progress.knownIds?.length || 0) + (progress.unknownIds?.length || 0) : 0;
            const percent = Math.min(100, Math.round((studied / totalInThisDeck) * 100));

            return (
              <div
                key={i}
                className={`jade-card p-5 cursor-pointer flex flex-col justify-between gap-4 bg-white dark:bg-slate-900 border dark:border-slate-800 transition-all hover:scale-[1.02] ${progress ? 'border-primary shadow-sm bg-emerald-50/5' : ''}`}
                onClick={() => openDeck(selLevel, i)}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Nhóm {i + 1}
                    </span>
                    {progress && (
                      <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 uppercase tracking-wide">
                        Đang học
                      </span>
                    )}
                  </div>
                  <h4 style={{ fontWeight: 800, fontSize: '1rem', marginTop: '.2rem' }}>Từ {s}–{e}</h4>
                  
                  {progress && (
                    <div className="text-xs text-slate-500 mt-2 font-medium">
                      Đã nhớ tốt {progress.knownIds?.length || 0} từ · Đã học {percent}%
                    </div>
                  )}
                </div>

                <div className="mt-auto">
                  {progress ? (
                    <div className="w-full">
                      <div className="progress-track h-1.5 mb-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                        <div className="progress-fill h-full bg-emerald-500" style={{ width: `${percent}%` }} />
                      </div>
                      <span style={{ fontSize: '.72rem', color: 'var(--primary)', fontWeight: 800 }} className="flex items-center gap-1.5">
                        <BookOpen size={12} /> Học tiếp
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '.72rem', color: 'var(--primary)', fontWeight: 800 }} className="flex items-center gap-1.5">
                      <BookOpen size={12} /> Bắt đầu học
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )
      ) : (
        /* Word list inside deck */
        <div>
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <button className="btn-ghost text-xs" onClick={() => setDeckIdx(null)} disabled={deckLoading}>
              <ChevronLeft size={13} /> Danh sách nhóm
            </button>
            <span className="text-xs font-extrabold uppercase px-3 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 rounded-full">
              {selLevel} · Nhóm {deckIdx + 1}
            </span>
            {!deckLoading && deckWords.length > 0 && (
              <button className="btn-primary text-xs ml-auto shadow-sm" onClick={() => setStudyMode(true)}>
                <BookOpen size={13} /> Bắt đầu học (Swipe mode)
              </button>
            )}
          </div>

          {deckLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--primary)' }}>
              <div className="spinner" />
              <span className="font-bold text-sm">Đang tải danh sách từ vựng...</span>
            </div>
          ) : (
            <div className="vocab-grid">
              {deckWords.map(w => (
                <div key={w.id} className="vocab-item bg-white dark:bg-slate-900 p-5 rounded-2xl hover:shadow-md transition-all border border-slate-100 dark:border-slate-800 flex flex-col justify-between min-h-[220px]">
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="vocab-item-hz zh font-black text-primary text-2xl">{w.word}</div>
                        <div className="vocab-item-py font-bold text-amber-600 text-xs mt-0.5">{w.pinyin}</div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded">
                        {w.wordType}
                      </span>
                    </div>
                    
                    <div className="vocab-item-meaning font-semibold text-slate-800 dark:text-slate-200 text-sm leading-relaxed mt-2 border-t border-slate-50 dark:border-slate-800 pt-2">
                      {w.meaning}
                    </div>
                  </div>
                  
                  <div className="border-t border-slate-50 dark:border-slate-800 pt-3 mt-3">
                    {/* Select Folder choice */}
                    {!w.isAdded && folders.length > 0 && (
                      <div className="mb-2.5 flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Lưu vào chủ đề:</span>
                        <select
                          className="form-input text-[10px] font-semibold py-1 px-1.5 bg-slate-50 dark:bg-slate-800 flex-1 max-w-[120px]"
                          value={addingToFolderMap[w.id] || ''}
                          onChange={e => setAddingToFolderMap(p => ({ ...p, [w.id]: e.target.value }))}
                        >
                          <option value="">Mặc định</option>
                          {folders.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    <div className="flex gap-2 justify-end">
                      <button
                        className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center hover:bg-slate-100 hover:text-slate-800 active:scale-95 transition-all"
                        onClick={() => speak(w.word)}
                      >
                        <Volume2 size={13} />
                      </button>
                      {addingWordIds.has(w.id) ? (
                        <button className="btn-primary text-[10px] px-3.5 py-1.5 rounded-full flex items-center gap-1 opacity-70 cursor-not-allowed" disabled>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Đang thêm...
                        </button>
                      ) : w.isAdded ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">
                          <Check size={11} /> Đã thêm SRS
                        </span>
                      ) : (
                        <button className="btn-primary text-[10px] px-3.5 py-1.5 rounded-full flex items-center gap-1" onClick={() => addToSRS(w)}>
                          <Plus size={11} /> Thêm SRS
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main FlashcardTab Component ──────────────────────────────────────────────
export default function FlashcardTab({
  speak, showToast, onSrsDueChange,
  initialSubTab, initialLevel, initialDeckIdx, initialStudyMode, onCloseDeck
}: {
  speak: (text: string) => void;
  showToast: (msg: string) => void;
  onSrsDueChange: (delta: number) => void;
  initialSubTab?: 'review' | 'library';
  initialLevel?: string | null;
  initialDeckIdx?: number | null;
  initialStudyMode?: boolean;
  onCloseDeck?: () => void;
}) {
  const [subTab, setSubTab] = useState<'review' | 'library'>('review');
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [isStudying, setIsStudying] = useState(false);
  const [dueCount, setDueCount] = useState(0);

  // Folder states
  const [folders, setFolders] = useState<{ id: number; name: string }[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [isFolderSaving, setIsFolderSaving] = useState(false);

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    const r = await getFolders();
    if (r.success && r.folders) {
      setFolders(r.folders as any[]);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setIsFolderSaving(true);
    const r = await createFolder(newFolderName);
    setIsFolderSaving(false);
    if (r.success) {
      showToast('Đã tạo chủ đề mới thành công!');
      setNewFolderName('');
      setShowFolderModal(false);
      loadFolders();
    } else {
      showToast(r.error || 'Lỗi tạo chủ đề');
    }
  };

  const handleDeleteFolder = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa chủ đề này? Các thẻ từ vựng liên quan sẽ trở về trạng thái không có chủ đề.')) return;
    const r = await deleteFolder(id);
    if (r.success) {
      showToast('Đã xóa chủ đề thành công.');
      if (selectedFolderId === id) setSelectedFolderId(null);
      loadFolders();
    } else {
      showToast(r.error || 'Lỗi xóa chủ đề');
    }
  };

  // Sync subtab state when loaded with initialSubTab
  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const handleTabChange = async (tab: 'review' | 'library') => {
    if (tab === 'library') {
      setLibraryLoading(true);
      setSubTab('library');
      await new Promise(resolve => setTimeout(resolve, 350));
      setLibraryLoading(false);
    } else {
      setSubTab('review');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Folder management toolbar & subtab switcher (hidden in study mode to maximize space) */}
      {!isStudying && (
        <>
          {/* Folder management toolbar */}
          <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border dark:border-slate-800 border-slate-100 flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <FolderOpen size={14} className="text-primary" />
              <span>Quản lý chủ đề của bạn</span>
            </span>
            <div className="flex gap-2">
              {folders.length > 0 && selectedFolderId && (
                <button
                  className="btn-ghost text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs py-1.5 px-2.5 rounded-lg flex items-center gap-1"
                  onClick={() => handleDeleteFolder(selectedFolderId)}
                >
                  <Trash2 size={12} /> Xóa chủ đề hiện tại
                </button>
              )}
              <button
                className="btn-primary text-xs py-1.5 px-3 rounded-lg flex items-center gap-1 shadow-sm"
                onClick={() => setShowFolderModal(true)}
              >
                <FolderPlus size={13} /> Tạo chủ đề mới
              </button>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1.5 p-1.5 rounded-2xl bg-white dark:bg-slate-900 border dark:border-slate-800" style={{ border: '1px solid var(--card-border)' }}>
            <button
              className="flex-1 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
              style={subTab === 'review'
                ? { background: 'var(--primary)', color: 'var(--on-primary-text)' }
                : { color: 'var(--text-muted)' }}
              onClick={() => handleTabChange('review')}
            >
              🎴 Ôn tập SRS {dueCount > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500 text-white animate-pulse">
                  {dueCount}
                </span>
              )}
            </button>
            <button
              className="flex-1 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
              style={subTab === 'library'
                ? { background: 'var(--primary)', color: 'var(--on-primary-text)' }
                : { color: 'var(--text-muted)' }}
              onClick={() => handleTabChange('library')}
            >
              📚 Thư viện HSK 1-6
            </button>
          </div>
        </>
      )}

      {/* New Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[1px] p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="font-extrabold text-sm text-slate-800 dark:text-slate-200">Tạo chủ đề / Thư mục mới</span>
              <button className="btn-ghost" onClick={() => setShowFolderModal(false)}><X size={15} /></button>
            </div>
            <form onSubmit={handleCreateFolder} className="flex flex-col gap-3">
              <input
                className="form-input"
                placeholder="Ví dụ: Giao thông, Mua sắm, Du lịch..."
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                required
                disabled={isFolderSaving}
                autoFocus
              />
              <button
                type="submit"
                className="btn-submit text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2"
                disabled={isFolderSaving}
              >
                {isFolderSaving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Xác nhận tạo
              </button>
            </form>
          </div>
        </div>
      )}

      {subTab === 'review' && (
        <SRSReview
          speak={speak}
          showToast={showToast}
          onDueCountChange={n => { setDueCount(n); onSrsDueChange(n); }}
          folders={folders}
          selectedFolderId={selectedFolderId}
          setSelectedFolderId={setSelectedFolderId}
        />
      )}
      {subTab === 'library' && (
        libraryLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: 'var(--primary)' }}>
            <div className="spinner" />
            <span className="font-bold text-sm">Đang tải thư viện khóa học HSK...</span>
          </div>
        ) : (
          <HSKLibrary
            speak={speak}
            showToast={showToast}
            onSrsDueChange={delta => { setDueCount(c => c + delta); onSrsDueChange(delta); }}
            initialLevel={initialLevel}
            initialDeckIdx={initialDeckIdx}
            initialStudyMode={initialStudyMode}
            onCloseDeck={onCloseDeck}
            folders={folders}
            onStudyModeChange={setIsStudying}
          />
        )
      )}
    </div>
  );
}
