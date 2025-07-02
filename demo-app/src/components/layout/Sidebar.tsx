import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar: React.FC = () => {
  const navItems = [
    { path: '/', label: '대시보드', icon: '📊' },
    { path: '/history', label: '결함 이력', icon: '📋' },
    { path: '/rules', label: '고객사 기준 정보', icon: '⚙️' },
    { path: '/data', label: '데이터 관리', icon: '💾' },
    { path: '/models', label: 'AI 모델 관리', icon: '🤖' },
    { path: '/diagnostics', label: '진단', icon: '🔧' },
  ];

  return (
    <div className="w-64 glass-effect shadow-dark-lg">
      {/* 헤더 섹션 */}
      <div className="p-6 border-b border-dark-border border-opacity-30">
        <h1 className="text-xl font-bold text-primary mb-1">
          CCL SDD System
        </h1>
        <p className="text-sm text-text-muted">
          표면 결함 검사 시스템
        </p>
      </div>
      
      {/* 네비게이션 메뉴 */}
      <nav className="mt-2 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 mb-1 rounded-lg text-text-secondary hover:bg-dark-elevated hover:text-text-primary transition-all duration-200 group ${
                isActive 
                  ? 'bg-primary text-white shadow-dark font-medium' 
                  : ''
              }`
            }
          >
            <span className="mr-3 text-lg group-hover:scale-110 transition-transform duration-200">
              {item.icon}
            </span>
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      
      {/* 하단 정보 */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-dark-border border-opacity-30 bg-dark-surface bg-opacity-30">
        <div className="text-xs text-text-muted text-center">
          <p>Version 1.0.0</p>
          <p className="mt-1">© 2024 CCL Systems</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar; 