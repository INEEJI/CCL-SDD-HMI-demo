import React from 'react';
import { UserCircleIcon, BellIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';

const Header: React.FC = () => {
  return (
    <header className="glass-effect shadow-dark px-6 py-4 flex justify-between items-center z-10">
      {/* 좌측: 페이지 제목 및 상태 */}
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-semibold text-text-primary">
          표면 결함 검사 시스템
        </h1>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
          <span className="text-sm text-text-secondary">시스템 가동 중</span>
        </div>
      </div>
      
      {/* 우측: 사용자 액션 */}
      <div className="flex items-center space-x-3">
        {/* 알림 버튼 */}
        <button className="relative p-2 text-text-secondary hover:text-text-primary hover:bg-dark-elevated rounded-lg transition-all duration-200 group">
          <BellIcon className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-danger rounded-full text-xs flex items-center justify-center">
            <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
          </span>
        </button>
        
        {/* 설정 버튼 */}
        <button className="p-2 text-text-secondary hover:text-text-primary hover:bg-dark-elevated rounded-lg transition-all duration-200 group">
          <Cog6ToothIcon className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
        </button>
        
        {/* 사용자 프로필 */}
        <div className="flex items-center space-x-3 pl-3 border-l border-dark-border">
          <div className="text-right">
            <p className="text-sm font-medium text-text-primary">관리자</p>
            <p className="text-xs text-text-muted">Administrator</p>
          </div>
          <button className="p-1 text-text-secondary hover:text-text-primary hover:bg-dark-elevated rounded-lg transition-all duration-200">
            <UserCircleIcon className="h-8 w-8" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header; 