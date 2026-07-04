'use client';

import React from 'react';
import { Home, Layers, Brain, BookOpen, Notebook, LogOut, Flame, Palette } from 'lucide-react';
import { User, Theme, THEMES, THEME_COLORS } from '../types';

type Tab = 'dashboard' | 'practice' | 'flashcards' | 'reading' | 'notebook';

interface Props {
  user: User;
  tab: Tab;
  setTab: (t: Tab) => void;
  theme: Theme;
  applyTheme: (t: Theme) => void;
  onLogout: () => void;
}

export default function Sidebar({ user, tab, setTab, theme, applyTheme, onLogout }: Props) {
  const level = (xp: number) => Math.floor(xp / 100) + 1;

  const NavItem = ({ id, icon: Icon, label }: { id: Tab; icon: any; label: string }) => (
    <button className={`nav-item ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
      <Icon size={18} />
      <span>{label}</span>
      <span className="nav-dot" />
    </button>
  );

  return (
    <aside
      className="desktop-sidebar hidden md:flex flex-col h-full py-5 px-3 gap-4 border-r w-60 flex-shrink-0"
      style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--card-border)' }}
    >
      {/* Logo */}
      <div className="px-2 mb-1">
        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--primary)', fontFamily: "'Noto Sans SC'", lineHeight: 1 }}>学</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>Scholar</div>
        <div style={{ fontSize: '.72rem', color: 'var(--text-faint)', fontWeight: 600 }}>Học tiếng Trung HSK 3.0</div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        <NavItem id="dashboard"  icon={Home}    label="Bảng điều khiển" />
        <NavItem id="practice"   icon={Brain}   label="Luyện phản xạ" />
        <NavItem id="flashcards" icon={Layers}  label="Flashcards HSK" />
        <NavItem id="reading"    icon={BookOpen} label="Bài đọc" />
        <NavItem id="notebook"   icon={Notebook} label="Sổ tay từ" />
      </nav>

      {/* Theme picker */}
      <div className="px-2">
        <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.45rem', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
          <Palette size={11} /> Giao diện
        </div>
        <div className="theme-picker">
          {THEMES.map(t => (
            <div
              key={t}
              className={`theme-dot ${theme === t ? 'active' : ''}`}
              style={{ background: THEME_COLORS[t] }}
              onClick={() => applyTheme(t)}
              title={t}
            />
          ))}
        </div>
      </div>

      {/* Profile card */}
      <div className="px-2 py-3 rounded-xl flex flex-col gap-2.5" style={{ background: 'var(--primary-light)' }}>
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{ background: 'var(--primary)', color: 'var(--on-primary-text)' }}
          >
            {(user.display_name || user.email).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div style={{ fontWeight: 700, fontSize: '.82rem' }} className="truncate">
              {user.display_name || user.email.split('@')[0]}
            </div>
            <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Cấp {level(user.exp)} · {user.exp} XP
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Flame size={14} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--primary)' }}>{user.streak} ngày streak</span>
        </div>
        <button
          className="flex items-center justify-center gap-1 text-xs font-bold px-2 py-1.5 rounded-lg w-full"
          style={{ background: 'var(--error-bg)', color: 'var(--error-text)', border: 'none', cursor: 'pointer' }}
          onClick={onLogout}
        >
          <LogOut size={13} /> Đăng xuất
        </button>
      </div>
    </aside>
  );
}
