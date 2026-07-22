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
        eyebrow: '半导体供应链情报平台',
        titleA: '在供应链变化之前，',
        titleB: '先看见它。',
        intro: '追踪全球贸易流、企业关系与产品变化，把分散的供应链数据变成可验证、可研究的证据。',
        overview: '进入 Overview',
        imageLabel: '晶圆级视角',
        imageTitle: '从一片晶圆，看到一条全球供应链',
        imageBody: '在国家、产品与企业三个维度之间切换，定位依赖关系、集中度与结构变化。',
        signal: '研究视角',
        signalValue: '贸易流 · 产品 · 企业',
        strip: ['全球贸易流', '产品级 HS 数据', '企业关系网络', 'AI 辅助研究'],
        sectionEyebrow: '两个分析工作区',
        sectionTitle: '从全局信号，深入到结构',
        sectionBody: '使用 Explore 拆解市场和产品流向，或进入 Companies 追踪企业之间的供应链关系。',
        features: [
          ['Explore', '按市场、时间与产品拆解进出口流向，发现集中度、依赖关系和变化趋势。'],
          ['Companies', '从品牌出发查看供应商、交易对手与跨境连接，形成可追踪的企业网络。'],
        ],
        coverageEyebrow: '为半导体供应链而设计',
        coverageTitle: '同一份证据，三种分析尺度。',
        coverageBody: '先从全球流向发现异常，再深入到产品类别与公司关系。每一步都保留当前分析范围，减少重复筛选。',
        coverageItems: ['国家与市场：比较双边贸易和区域暴露', '产品与 HS Code：追踪品类迁移和季度变化', '公司网络：识别供应商与交易对手关系'],
        researchBadge: '特色能力',
        researchEyebrow: 'Research workspace',
        researchTitle: '把一个明确问题，变成一条完整研究路径。',
        researchBody: 'Research 不只是另一个数据页面。它从问题出发，组织证据、分析和结果，适合需要进一步解释供应链变化的任务。',
        researchSteps: ['明确问题', '组织证据', '形成分析'],
        researchCta: '进入 Research',
        footer: 'SemiconFlow · Semiconductor supply-chain intelligence',
        photo: '图片：Maxence Pira / Unsplash',
      }
    : {
        eyebrow: 'Semiconductor supply-chain intelligence',
        titleA: 'See the supply chain',
        titleB: 'before it shifts.',
        intro: 'Trace global trade flows, company relationships and product movement—then turn fragmented supply-chain data into research-ready evidence.',
        overview: 'Open Overview',
        imageLabel: 'Wafer-level perspective',
        imageTitle: 'From one wafer to a global supply chain',
        imageBody: 'Move between countries, products and companies to locate dependencies, concentration and structural change.',
        signal: 'Research lenses',
        signalValue: 'Trade · Products · Companies',
        strip: ['Global trade flows', 'Product-level HS data', 'Company relationship maps', 'AI-assisted research'],
        sectionEyebrow: 'Two analytical workspaces',
        sectionTitle: 'Move from the signal into its structure',
        sectionBody: 'Use Explore to break down markets and product flows, or Companies to trace supply-chain relationships between firms.',
        features: [
          ['Explore', 'Break down import and export flows by market, period and product to surface concentration, dependencies and change.'],
          ['Companies', 'Start with a brand and trace suppliers, counterparties and cross-border relationships.'],
        ],
        coverageEyebrow: 'Built for semiconductor supply chains',
        coverageTitle: 'The same evidence at three analytical scales.',
        coverageBody: 'Start with global movement, then move into product categories and company relationships. Your analysis scope stays with you as the question gets more specific.',
        coverageItems: ['Countries & markets: compare bilateral trade and regional exposure', 'Products & HS codes: track category shifts and quarterly movement', 'Company networks: identify suppliers and trading counterparties'],
        researchBadge: 'Signature capability',
        researchEyebrow: 'Research workspace',
        researchTitle: 'Turn one focused question into a complete research path.',
        researchBody: 'Research is more than another data view. It starts with a question, organizes evidence, analysis and results, and helps explain why supply-chain movement matters.',
        researchSteps: ['Frame the question', 'Organize evidence', 'Form the analysis'],
        researchCta: 'Open Research',
        footer: 'SemiconFlow · Semiconductor supply-chain intelligence',
        photo: 'Photo: Maxence Pira / Unsplash',
      };

  const featureIcons = [BarChart3, Building2];
  const featureRoutes: WorkspaceView[] = ['map-country', 'company-dashboard'];

  return (
    <div className="landing-shell">
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="landing-brand">
            <span className="product-brand-mark" aria-hidden="true"><i /><i /><i /></span>
            <span>SemiconFlow</span>
          </div>
          <div className="landing-header-actions">
            <button type="button" className="landing-language" onClick={() => setLanguage(isZh ? 'en' : 'zh')}>
              {isZh ? 'EN' : '中文'}
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
              <button type="button" className="landing-primary-cta" onClick={() => onEnterWorkspace('global-stats')}>
                {copy.overview}<ArrowRight size={16} />
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
            <span className="landing-photo-credit">{copy.photo}</span>
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
                  <button type="button" onClick={() => onEnterWorkspace(featureRoutes[index])}>
                    {isZh ? `进入 ${title}` : `Open ${title}`}<ArrowRight size={14} />
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

        <section className="landing-research-feature">
          <div className="landing-research-copy">
            <span className="landing-research-badge"><FileSearch size={14} />{copy.researchBadge}</span>
            <p>{copy.researchEyebrow}</p>
            <h2>{copy.researchTitle}</h2>
            <span>{copy.researchBody}</span>
            <button type="button" onClick={() => onEnterWorkspace('insight-reports')}>
              {copy.researchCta}<ArrowRight size={16} />
            </button>
          </div>
          <div className="landing-research-path" aria-label={isZh ? '研究流程' : 'Research path'}>
            {copy.researchSteps.map((step, index) => (
              <div key={step}>
                <span>0{index + 1}</span>
                <strong>{step}</strong>
                {index < copy.researchSteps.length - 1 && <i aria-hidden="true" />}
              </div>
            ))}
          </div>
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
