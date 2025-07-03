import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, History, Cog, Database, Bot, Wrench } from 'lucide-react';

const Sidebar: React.FC = () => {
  const navItems = [
    { path: '/', label: '대시보드', icon: <LayoutDashboard size={20} /> },
    { path: '/history', label: '결함 이력', icon: <History size={20} /> },
    { path: '/rules', label: '고객사 기준 정보', icon: <Cog size={20} /> },
    { path: '/data', label: '데이터 관리', icon: <Database size={20} /> },
    { path: '/models', label: 'AI 모델 관리', icon: <Bot size={20} /> },
    { path: '/diagnostics', label: '진단', icon: <Wrench size={20} /> },
  ];

  return (
    <div className="w-64 bg-surface flex flex-col border-r border-border-color">
      <div className="p-4 border-b border-border-color">
        <h1 className="text-xl font-bold text-primary">SDD System</h1>
        <p className="text-sm text-text-secondary mt-1">표면 결함 검사 시스템</p>
      </div>
      
      <nav className="mt-2 p-2 flex-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 mb-1 rounded-md text-text-secondary hover:bg-background font-medium transition-colors ${
                isActive ? 'bg-primary/10 text-primary' : ''
              }`
            }
          >
            <div className="mr-3">{item.icon}</div>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      
      <div className="p-4 border-t border-border-color text-center text-xs text-text-secondary">
        <p>© 2025 CCL Systems. All rights reserved.</p>
      </div>
    </div>
  );
};

export default Sidebar;