'use client';

import React, { useState, useEffect } from 'react';
import { Volume2, Trash2, Search, Layers, Star } from 'lucide-react';
import { Vocab } from '../types';
import { getVocabList, deleteFromVocab, addFlashcard } from '../actions';

interface Props {
  speak: (text: string) => void;
  showToast: (msg: string) => void;
}

export default function NotebookTab({ speak, showToast }: Props) {
  const [vocabList, setVocabList] = useState<Vocab[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVocabList().then(r => {
      if (r.success && r.vocab) setVocabList(r.vocab);
      setLoading(false);
    });
  }, []);

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
    for (const v of vocabList) {
      const r = await addFlashcard(v.word, v.meaning, v.pinyin);
      if (r.success) n++;
    }
    showToast(`Đã tạo ${n} flashcard từ sổ tay!`);
  };

  const addOne = async (v: Vocab) => {
    const r = await addFlashcard(v.word, v.meaning, v.pinyin);
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
        <button className="btn-primary" onClick={exportToFlashcards}>
          <Layers size={14} /> Export → Flashcards
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
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

      {loading ? (
        <div className="text-center py-12 animate-pulse" style={{ color: 'var(--primary)', fontWeight: 700 }}>Đang tải...</div>
      ) : filtered.length > 0 ? (
        <div className="vocab-cards-grid">
          {filtered.map(v => (
            <div key={v.id} className="vocab-card-item">
              <button className="vocab-card-delete" onClick={() => deleteItem(v.id)}>
                <Trash2 size={13} />
              </button>
              <div className="vocab-card-hz zh">{v.word}</div>
              <div className="vocab-card-py">{v.pinyin}</div>
              <div className="vocab-card-meaning">{v.meaning}</div>
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
        <div className="jade-card p-12 text-center max-w-sm mx-auto">
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
