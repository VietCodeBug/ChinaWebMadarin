'use client';

import React, { useState, useEffect } from 'react';
import { Volume2, Trash2, Search, Layers, Star, FolderOpen } from 'lucide-react';
import { Vocab } from '../types';
import { getVocabList, deleteFromVocab, addFlashcard, getFolders } from '../actions';

interface Props {
  speak: (text: string) => void;
  showToast: (msg: string) => void;
}

export default function NotebookTab({ speak, showToast }: Props) {
  const [vocabList, setVocabList] = useState<Vocab[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Folder integration
  const [folders, setFolders] = useState<{ id: number; name: string }[]>([]);
  const [selFolderId, setSelFolderId] = useState<number | null>(null);

  useEffect(() => {
    loadFolders();
  }, []);

  useEffect(() => {
    loadVocab();
  }, [selFolderId]);

  const loadFolders = async () => {
    const r = await getFolders();
    if (r.success && r.folders) {
      setFolders(r.folders as any[]);
    }
  };

  const loadVocab = async () => {
    setLoading(true);
    const r = await getVocabList(selFolderId || undefined);
    if (r.success && r.vocab) setVocabList(r.vocab);
    setLoading(false);
  };

  const deleteItem = async (id: number) => {
    const r = await deleteFromVocab(id);
    if (r.success) {
      showToast('Đã xóa từ');
      setVocabList(prev => prev.filter(v => v.id !== id));
    }
  };

  const exportToFlashcards = async () => {
    if (!vocabList.length) { showToast('Sổ tay trống!'); return; }
    let n = 0;
    setLoading(true);
    for (const v of vocabList) {
      // Export into the same folder they are currently in, if selected!
      const r = await addFlashcard(v.word, v.meaning, v.pinyin, selFolderId || undefined);
      if (r.success) n++;
    }
    setLoading(false);
    showToast(`Đã tạo ${n} flashcard từ sổ tay!`);
  };

  const addOne = async (v: Vocab) => {
    // Save word into the folder it belongs to
    const r = await addFlashcard(v.word, v.meaning, v.pinyin, selFolderId || undefined);
    if (r.success) showToast(`Đã thêm "${v.word}" vào SRS!`);
  };

  const filtered = vocabList.filter(v =>
    v.word.includes(search) ||
    v.pinyin?.toLowerCase().includes(search.toLowerCase()) ||
    v.meaning.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
        <div>
          <h2 style={{ fontWeight: 800, fontSize: '1.1rem' }}>Sổ tay từ vựng</h2>
          <p style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
            {vocabList.length} từ đã lưu · Bấm vào chữ Hán trong bài đọc để lưu từ mới
          </p>
        </div>
        <button className="btn-primary" onClick={exportToFlashcards} disabled={loading || !vocabList.length}>
          <Layers size={14} /> Export → Flashcards
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} style={{ position: 'absolute', left: '.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.4rem' }}
            placeholder="Tìm từ vựng..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Folder filter */}
        <select
          className="form-input text-xs font-bold py-2 px-3 bg-white dark:bg-slate-900 border dark:border-slate-800 max-w-[200px]"
          value={selFolderId || ''}
          onChange={e => setSelFolderId(e.target.value ? parseInt(e.target.value, 10) : null)}
        >
          <option value="">📂 Tất cả chủ đề</option>
          {folders.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--primary)' }}>
          <div className="spinner" />
          <span className="font-bold text-sm">Đang tải sổ tay từ vựng...</span>
        </div>
      ) : filtered.length > 0 ? (
        <div className="vocab-cards-grid">
          {filtered.map(v => (
            <div key={v.id} className="vocab-card-item bg-white dark:bg-slate-900 border dark:border-slate-800">
              <button className="vocab-card-delete" onClick={() => deleteItem(v.id)}>
                <Trash2 size={13} />
              </button>
              <div className="vocab-card-hz zh">{v.word}</div>
              <div className="vocab-card-py">{v.pinyin}</div>
              <div className="vocab-card-meaning text-slate-700 dark:text-slate-350">{v.meaning}</div>
              <div className="flex gap-2 mt-2 items-center">
                <span className="vocab-card-status">Đang học</span>
                <button className="btn-ghost p-1" onClick={() => speak(v.word)} title="Phát âm">
                  <Volume2 size={12} />
                </button>
                <button className="btn-ghost p-1" onClick={() => addOne(v)} title="Thêm SRS">
                  <Star size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="jade-card p-12 text-center max-w-sm mx-auto bg-white dark:bg-slate-900 border dark:border-slate-800">
          <div style={{ fontSize: '2.5rem' }}>📓</div>
          <div style={{ fontWeight: 700, marginTop: '.5rem', color: 'var(--text-muted)' }}>
            {search ? 'Không tìm thấy từ nào' : 'Sổ tay trống'}
          </div>
          <div style={{ fontSize: '.8rem', color: 'var(--text-faint)', marginTop: '.25rem' }}>
            Bấm vào chữ Hán trong bài đọc để lưu từ mới.
          </div>
        </div>
      )}
    </div>
  );
}
