import {
  ArrowRight,
  BarChart3,
  Building2,
  Database,
  FileSearch,
  Globe2,
  Network,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import type { WorkspaceView } from '../workspace/WorkspaceNavigation';

interface LandingPageProps {
  onEnterWorkspace: (view: WorkspaceView) => void;
}

const HERO_IMAGE = 'https://images.unsplash.com/photo-1672307613484-3254a04651fd?auto=format&fit=crop&fm=jpg&q=84&w=2200';

function LandingPage({ onEnterWorkspace }: LandingPageProps) {
  const { language, setLanguage } = useLanguage();
  const isZh = language === 'zh';

  const copy = isZh
    ? {
        navPlatform: '平台',
        navCoverage: '数据能力',
        navResearch: '研究',
        open: '进入工作区',
        eyebrow: '半导体供应链情报平台',
        titleA: '在供应链变化之前，',
        titleB: '先看见它。',
        intro: '追踪全球贸易流、企业关系与产品变化，把分散的供应链数据变成可验证、可研究的证据。',
        explore: '探索贸易数据',
        company: '查看企业网络',
        imageLabel: '晶圆级视角',
        imageTitle: '从一片晶圆，看到一条全球供应链',
        imageBody: '在国家、产品与企业三个维度之间切换，定位依赖关系、集中度与结构变化。',
        signal: '研究视角',
        signalValue: '贸易流 · 产品 · 企业',
        strip: ['全球贸易流', '产品级 HS 数据', '企业关系网络', 'AI 辅助研究'],
        sectionEyebrow: '一个工作区，完整研究路径',
        sectionTitle: '从原始记录到可用判断',
        sectionBody: '不需要在地图、表格和报告之间来回拼接。SemiconFlow 把供应链分析最常用的步骤放进同一套工作流。',
        features: [
          ['观察贸易结构', '按市场、时间与产品拆解进出口流向，快速发现集中度和变化趋势。'],
          ['理解企业关系', '从品牌出发查看供应商、交易对手与跨境连接，形成可追踪的企业网络。'],
          ['提出研究问题', '带着当前页面的筛选范围直接提问，让 AI 在明确上下文中辅助分析。'],
        ],
        coverageEyebrow: '为半导体供应链而设计',
        coverageTitle: '同一份证据，三种分析尺度。',
        coverageBody: '先从全球流向发现异常，再深入到产品类别与公司关系。每一步都保留当前分析范围，减少重复筛选。',
        coverageItems: ['国家与市场：比较双边贸易和区域暴露', '产品与 HS Code：追踪品类迁移和季度变化', '公司网络：识别供应商与交易对手关系'],
        researchEyebrow: 'Research workspace',
        researchTitle: '把一个明确问题，变成一条研究路径。',
        researchBody: '深度研究入口保持简单：输入一个问题，启动研究，需要时再查看历史记录。',
        researchCta: '开始研究',
        footer: 'SemiconFlow · Semiconductor supply-chain intelligence',
        photo: '图片：Maxence Pira / Unsplash',
      }
    : {
        navPlatform: 'Platform',
        navCoverage: 'Coverage',
        navResearch: 'Research',
        open: 'Open workspace',
        eyebrow: 'Semiconductor supply-chain intelligence',
        titleA: 'See the supply chain',
        titleB: 'before it shifts.',
        intro: 'Trace global trade flows, company relationships and product movement—then turn fragmented supply-chain data into research-ready evidence.',
        explore: 'Explore trade data',
        company: 'View company network',
        imageLabel: 'Wafer-level perspective',
        imageTitle: 'From one wafer to a global supply chain',
        imageBody: 'Move between countries, products and companies to locate dependencies, concentration and structural change.',
        signal: 'Research lenses',
        signalValue: 'Trade · Products · Companies',
        strip: ['Global trade flows', 'Product-level HS data', 'Company relationship maps', 'AI-assisted research'],
        sectionEyebrow: 'One workspace, one research path',
        sectionTitle: 'From raw records to a usable view',
        sectionBody: 'Stop stitching together maps, tables and reports. SemiconFlow keeps the core steps of supply-chain analysis in one coherent workflow.',
        features: [
          ['Observe trade structure', 'Break down import and export flows by market, period and product to surface concentration and change.'],
          ['Understand companies', 'Start with a brand and trace suppliers, counterparties and cross-border relationships.'],
          ['Ask in context', 'Ask AI from the view you are already using, with the active analysis scope carried into the conversation.'],
        ],
        coverageEyebrow: 'Built for semiconductor supply chains',
        coverageTitle: 'The same evidence at three analytical scales.',
        coverageBody: 'Start with global movement, then move into product categories and company relationships. Your analysis scope stays with you as the question gets more specific.',
        coverageItems: ['Countries & markets: compare bilateral trade and regional exposure', 'Products & HS codes: track category shifts and quarterly movement', 'Company networks: identify suppliers and trading counterparties'],
        researchEyebrow: 'Research workspace',
        researchTitle: 'Turn one focused question into a research path.',
        researchBody: 'Deep research stays intentionally simple: enter one question, start the run, and open history only when you need it.',
        researchCta: 'Start research',
        footer: 'SemiconFlow · Semiconductor supply-chain intelligence',
        photo: 'Photo: Maxence Pira / Unsplash',
      };

  const featureIcons = [BarChart3, Building2, FileSearch];

  return (
    <div className="landing-shell">
      <header className="landing-header">
        <div className="landing-header-inner">
          <a className="landing-brand" href="#top" aria-label="SemiconFlow home">
            <span className="product-brand-mark" aria-hidden="true"><i /><i /><i /></span>
            <span>SemiconFlow</span>
          </a>
          <nav className="landing-nav" aria-label={isZh ? '首页导航' : 'Landing navigation'}>
            <a href="#platform">{copy.navPlatform}</a>
            <a href="#coverage">{copy.navCoverage}</a>
            <a href="#research">{copy.navResearch}</a>
          </nav>
          <div className="landing-header-actions">
            <button type="button" className="landing-language" onClick={() => setLanguage(isZh ? 'en' : 'zh')}>
              {isZh ? 'EN' : '中文'}
            </button>
            <button type="button" className="landing-open" onClick={() => onEnterWorkspace('global-stats')}>
              {copy.open}<ArrowRight size={15} />
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <p className="landing-kicker"><span />{copy.eyebrow}</p>
            <h1>{copy.titleA}<br /><em>{copy.titleB}</em></h1>
            <p className="landing-intro">{copy.intro}</p>
            <div className="landing-hero-actions">
              <button type="button" className="landing-primary-cta" onClick={() => onEnterWorkspace('map-country')}>
                {copy.explore}<ArrowRight size={16} />
              </button>
              <button type="button" className="landing-secondary-cta" onClick={() => onEnterWorkspace('company-dashboard')}>
                {copy.company}
              </button>
            </div>
          </div>

          <div className="landing-hero-visual">
            <img src={HERO_IMAGE} alt={isZh ? '半导体晶圆的微距照片' : 'Macro photograph of a semiconductor wafer'} />
            <div className="landing-image-wash" />
            <div className="landing-visual-copy">
              <p>{copy.imageLabel}</p>
              <h2>{copy.imageTitle}</h2>
              <span>{copy.imageBody}</span>
            </div>
            <div className="landing-signal-card">
              <Network size={18} />
              <span><small>{copy.signal}</small><strong>{copy.signalValue}</strong></span>
            </div>
            <a className="landing-photo-credit" href="https://unsplash.com/s/photos/semiconductor-wafer" target="_blank" rel="noreferrer">
              {copy.photo}
            </a>
          </div>
        </section>

        <div className="landing-capability-strip" aria-label={isZh ? '平台能力' : 'Platform capabilities'}>
          {copy.strip.map((item, index) => {
            const Icon = [Globe2, Database, Network, FileSearch][index];
            return <span key={item}><Icon size={15} />{item}</span>;
          })}
        </div>

        <section className="landing-section" id="platform">
          <div className="landing-section-heading">
            <p>{copy.sectionEyebrow}</p>
            <h2>{copy.sectionTitle}</h2>
            <span>{copy.sectionBody}</span>
          </div>
          <div className="landing-feature-grid">
            {copy.features.map(([title, body], index) => {
              const Icon = featureIcons[index];
              return (
                <article key={title}>
                  <div className="landing-feature-number">0{index + 1}</div>
                  <Icon size={21} />
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <button type="button" onClick={() => onEnterWorkspace((['map-country', 'company-dashboard', 'global-stats'] as WorkspaceView[])[index])}>
                    {isZh ? '打开' : 'Open'}<ArrowRight size={14} />
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="landing-coverage" id="coverage">
          <div className="landing-coverage-map" aria-hidden="true">
            <span className="landing-orbit orbit-one" />
            <span className="landing-orbit orbit-two" />
            <span className="landing-map-node node-one">NL</span>
            <span className="landing-map-node node-two">TW</span>
            <span className="landing-map-node node-three">KR</span>
            <span className="landing-map-node node-four">US</span>
            <div className="landing-map-core"><Globe2 size={25} /><strong>SemiconFlow</strong><small>Global evidence layer</small></div>
          </div>
          <div className="landing-coverage-copy">
            <p>{copy.coverageEyebrow}</p>
            <h2>{copy.coverageTitle}</h2>
            <span>{copy.coverageBody}</span>
            <ul>
              {copy.coverageItems.map((item) => <li key={item}><ArrowRight size={14} />{item}</li>)}
            </ul>
          </div>
        </section>

        <section className="landing-research" id="research">
          <div>
            <p>{copy.researchEyebrow}</p>
            <h2>{copy.researchTitle}</h2>
            <span>{copy.researchBody}</span>
          </div>
          <button type="button" onClick={() => onEnterWorkspace('insight-reports')}>
            {copy.researchCta}<ArrowRight size={16} />
          </button>
        </section>
      </main>

      <footer className="landing-footer">
        <span>{copy.footer}</span>
        <span>HK · Global coverage</span>
      </footer>
    </div>
  );
}

export default LandingPage;
