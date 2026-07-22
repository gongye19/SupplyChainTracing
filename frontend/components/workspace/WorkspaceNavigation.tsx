import React from 'react';
import {
  BarChart3,
  Building2,
  FileText,
  Map,
  MessageSquareText,
  PackageSearch,
  Radio,
  X,
} from 'lucide-react';

export type WorkspaceView =
  | 'global-stats'
  | 'map-country'
  | 'map-hscode'
  | 'company-dashboard'
  | 'insight-reports';

interface WorkspaceNavigationProps {
  activeView: WorkspaceView;
  language: 'en' | 'zh';
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onNavigate: (view: WorkspaceView) => void;
  onOpenAssistant: () => void;
}

const WorkspaceNavigation: React.FC<WorkspaceNavigationProps> = ({
  activeView,
  language,
  mobileOpen,
  onCloseMobile,
  onNavigate,
  onOpenAssistant,
}) => {
  const isZh = language === 'zh';
  const itemClass = (active: boolean) => `workspace-nav-item${active ? ' is-active' : ''}`;

  const navigate = (view: WorkspaceView) => {
    onNavigate(view);
    onCloseMobile();
  };

  return (
    <>
      <button
        type="button"
        className={`workspace-nav-backdrop${mobileOpen ? ' is-visible' : ''}`}
        onClick={onCloseMobile}
        aria-label={isZh ? '关闭导航' : 'Close navigation'}
      />
      <aside className={`workspace-navigation${mobileOpen ? ' is-mobile-open' : ''}`}>
        <div className="workspace-brand">
          <div className="workspace-brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <p className="workspace-brand-name">SemiconFlow</p>
            <p className="workspace-brand-subtitle">Intelligence workspace</p>
          </div>
          <button
            type="button"
            className="workspace-nav-close"
            onClick={onCloseMobile}
            aria-label={isZh ? '关闭导航' : 'Close navigation'}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="workspace-nav-scroll" aria-label={isZh ? '主要导航' : 'Primary navigation'}>
          <div className="workspace-nav-group">
            <p className="workspace-nav-label">{isZh ? '工作台' : 'Workspace'}</p>
            <button type="button" className={itemClass(activeView === 'global-stats')} onClick={() => navigate('global-stats')}>
              <BarChart3 size={17} />
              <span>{isZh ? '全球概览' : 'Overview'}</span>
              <span className="workspace-nav-pulse" />
            </button>
          </div>

          <div className="workspace-nav-group">
            <p className="workspace-nav-label">{isZh ? '探索' : 'Explore'}</p>
            <button type="button" className={itemClass(activeView === 'map-country')} onClick={() => navigate('map-country')}>
              <Map size={17} />
              <span>{isZh ? '国家与贸易流' : 'Countries & flows'}</span>
            </button>
            <button type="button" className={itemClass(activeView === 'map-hscode')} onClick={() => navigate('map-hscode')}>
              <PackageSearch size={17} />
              <span>{isZh ? '产品与 HS Code' : 'Products & HS codes'}</span>
            </button>
            <button type="button" className={itemClass(activeView === 'company-dashboard')} onClick={() => navigate('company-dashboard')}>
              <Building2 size={17} />
              <span>{isZh ? '公司网络' : 'Company network'}</span>
            </button>
          </div>

          <div className="workspace-nav-group">
            <p className="workspace-nav-label">{isZh ? '研究' : 'Research'}</p>
            <button type="button" className="workspace-nav-item" onClick={onOpenAssistant}>
              <MessageSquareText size={17} />
              <span>{isZh ? '快速问答' : 'Quick answer'}</span>
              <span className="workspace-nav-key">⌘K</span>
            </button>
            <button type="button" className={itemClass(activeView === 'insight-reports')} onClick={() => navigate('insight-reports')}>
              <FileText size={17} />
              <span>{isZh ? '深度报告' : 'Deep reports'}</span>
            </button>
          </div>
        </nav>

        <div className="workspace-data-status">
          <div className="workspace-data-status-head">
            <span className="workspace-live-dot" />
            <span>{isZh ? '数据服务正常' : 'Data service online'}</span>
            <Radio size={14} />
          </div>
          <p>{isZh ? '最新数据：2026 年 7 月' : 'Latest dataset · Jul 2026'}</p>
        </div>
      </aside>
    </>
  );
};

export default WorkspaceNavigation;
