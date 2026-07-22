import {
  BarChart3,
  Building2,
  FileText,
  Menu,
  Search,
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
  onToggleMobile: () => void;
  onCloseMobile: () => void;
  onNavigate: (view: WorkspaceView) => void;
  onOpenAssistant: () => void;
  onToggleLanguage: () => void;
}

const navigation = [
  { view: 'global-stats' as const, label: 'Overview', zhLabel: '概览', icon: BarChart3 },
  { view: 'map-country' as const, label: 'Explore', zhLabel: '探索', icon: Search },
  { view: 'company-dashboard' as const, label: 'Companies', zhLabel: '公司', icon: Building2 },
  { view: 'insight-reports' as const, label: 'Research', zhLabel: '研究', icon: FileText },
];

function WorkspaceNavigation({
  activeView,
  language,
  mobileOpen,
  onToggleMobile,
  onCloseMobile,
  onNavigate,
  onOpenAssistant,
  onToggleLanguage,
}: WorkspaceNavigationProps) {
  const isZh = language === 'zh';

  const navigate = (view: WorkspaceView) => {
    onNavigate(view);
    onCloseMobile();
  };

  return (
    <header className="product-header">
      <div className="product-header-inner">
        <button
          type="button"
          className="product-mobile-menu"
          onClick={onToggleMobile}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen
            ? (isZh ? '关闭导航' : 'Close navigation')
            : (isZh ? '打开导航' : 'Open navigation')}
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <button type="button" className="product-brand" onClick={() => navigate('global-stats')}>
          <span className="product-brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>SemiconFlow</span>
        </button>

        <nav className={`product-primary-nav${mobileOpen ? ' is-open' : ''}`} aria-label={isZh ? '主要导航' : 'Primary navigation'}>
          {navigation.map(({ view, label, zhLabel, icon: Icon }) => {
            const isExplore = view === 'map-country';
            const active = isExplore
              ? activeView === 'map-country' || activeView === 'map-hscode'
              : activeView === view;
            return (
              <button
                type="button"
                key={view}
                className={`product-nav-item${active ? ' is-active' : ''}`}
                onClick={() => navigate(view)}
              >
                <Icon size={15} />
                {isZh ? zhLabel : label}
              </button>
            );
          })}
        </nav>

        <div className="product-header-actions">
          <button type="button" className="product-command" onClick={onOpenAssistant}>
            <Search size={15} />
            <span>{isZh ? '搜索或提问' : 'Search or ask'}</span>
            <kbd>⌘K</kbd>
          </button>
          <span className="product-data-status" title={isZh ? '数据服务正常' : 'Data service online'}>
            <i />
            {isZh ? '数据已更新' : 'Data current'}
          </span>
          <button type="button" className="product-language" onClick={onToggleLanguage}>
            {isZh ? 'EN' : '中文'}
          </button>
        </div>
      </div>
    </header>
  );
}

export default WorkspaceNavigation;
