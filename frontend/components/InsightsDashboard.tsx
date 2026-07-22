import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  FileClock,
  FileText,
  LoaderCircle,
  Play,
  RefreshCw,
  X,
  XCircle,
} from 'lucide-react';

import { useLanguage } from '../contexts/LanguageContext';
import { insightJobsAPI } from '../services/api';
import type { InsightJob, InsightJobStatus, InsightJobSystemStatus, InsightReport } from '../types';

const STATUS_LABELS: Record<InsightJobStatus, { en: string; zh: string }> = {
  queued: { en: 'Queued', zh: '等待中' },
  running: { en: 'Running', zh: '分析中' },
  completed: { en: 'Completed', zh: '已完成' },
  failed: { en: 'Failed', zh: '失败' },
  cancelled: { en: 'Cancelled', zh: '已取消' },
};

function formatDate(value: string, language: 'en' | 'zh') {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function StatusBadge({ status, language }: { status: InsightJobStatus; language: 'en' | 'zh' }) {
  const Icon = status === 'completed'
    ? CheckCircle2
    : status === 'failed' || status === 'cancelled'
      ? XCircle
      : status === 'running'
        ? LoaderCircle
        : Clock3;

  return (
    <span className={`research-status is-${status}`}>
      <Icon className={status === 'running' ? 'animate-spin' : ''} size={13} />
      {STATUS_LABELS[status][language]}
    </span>
  );
}

export function InsightsDashboard() {
  const { language } = useLanguage();
  const locale = language === 'zh' ? 'zh' : 'en';
  const [systemStatus, setSystemStatus] = useState<InsightJobSystemStatus | null>(null);
  const [jobs, setJobs] = useState<InsightJob[]>([]);
  const [question, setQuestion] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [report, setReport] = useState<InsightReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.jobId === selectedJobId) ?? null,
    [jobs, selectedJobId],
  );
  const hasActiveJobs = jobs.some((job) => job.status === 'queued' || job.status === 'running');

  const loadJobs = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const nextJobs = await insightJobsAPI.list({ limit: 50 });
      setJobs(nextJobs);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load research history');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([insightJobsAPI.getStatus(), insightJobsAPI.list({ limit: 50 })])
      .then(([nextStatus, nextJobs]) => {
        if (!active) return;
        setSystemStatus(nextStatus);
        setJobs(nextJobs);
        setError(null);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load research workspace');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hasActiveJobs) return undefined;
    const intervalId = window.setInterval(() => {
      void loadJobs();
    }, 10_000);
    return () => window.clearInterval(intervalId);
  }, [hasActiveJobs, loadJobs]);

  useEffect(() => {
    if (!historyOpen && !reportOpen) return undefined;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (reportOpen) setReportOpen(false);
      else setHistoryOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [historyOpen, reportOpen]);

  const submitJob = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const researchQuestion = question.trim();
    if (researchQuestion.length < 10 || !systemStatus?.enabled) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const created = await insightJobsAPI.create({ researchQuestion });
      setJobs((current) => [created, ...current.filter((job) => job.jobId !== created.jobId)]);
      setQuestion('');
      setError(null);
      setNotice(locale === 'zh' ? '研究任务已提交。可在历史记录中查看进度。' : 'Research submitted. Track its progress in history.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit research');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      const cancelled = await insightJobsAPI.cancel(jobId);
      setJobs((current) => current.map((job) => job.jobId === jobId ? cancelled : job));
      setError(null);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Unable to cancel research');
    }
  };

  const openReport = async (job: InsightJob) => {
    if (job.status !== 'completed') return;
    setSelectedJobId(job.jobId);
    setReport(null);
    setReportOpen(true);
    setReportLoading(true);
    try {
      const nextReport = await insightJobsAPI.getReport(job.jobId);
      setReport(nextReport);
      setError(null);
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : 'Unable to load report');
      setReportOpen(false);
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="research-minimal">
      <form onSubmit={submitJob} className="research-composer">
        <div className="research-composer-heading">
          <label htmlFor="insight-question">
            {locale === 'zh' ? '你希望研究什么？' : 'What should we research?'}
          </label>
          <button type="button" onClick={() => setHistoryOpen(true)} className="research-history-trigger">
            <FileClock size={15} />
            {locale === 'zh' ? '历史记录' : 'History'}
            {jobs.length > 0 && <span>{jobs.length}</span>}
          </button>
        </div>
        <textarea
          id="insight-question"
          value={question}
          onChange={(event) => {
            setQuestion(event.target.value);
            setNotice(null);
          }}
          minLength={10}
          maxLength={4000}
          disabled={!systemStatus?.enabled || submitting}
          placeholder={locale === 'zh'
            ? '例如：过去三年全球先进制程设备贸易流发生了哪些结构性变化？'
            : 'Example: How have global advanced-node equipment trade flows changed structurally over the past three years?'}
        />
        <div className="research-composer-footer">
          <span>
            {systemStatus?.enabled === false
              ? (locale === 'zh' ? '研究服务当前未启用' : 'Research service is currently unavailable')
              : (locale === 'zh' ? '深度研究可能需要较长时间' : 'Deep research may take considerable time')}
          </span>
          <button type="submit" disabled={!systemStatus?.enabled || submitting || question.trim().length < 10}>
            {submitting ? <LoaderCircle className="animate-spin" size={15} /> : <Play size={15} />}
            {locale === 'zh' ? '开始研究' : 'Start research'}
          </button>
        </div>
      </form>

      {notice && <p className="research-notice" role="status">{notice}</p>}
      {error && <p className="research-error" role="alert">{error}</p>}

      {historyOpen && (
        <div className="research-overlay" role="presentation" onMouseDown={() => setHistoryOpen(false)}>
          <aside className="research-history-drawer" role="dialog" aria-modal="true" aria-label={locale === 'zh' ? '研究历史' : 'Research history'} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p>{locale === 'zh' ? '研究历史' : 'Research history'}</p>
                <span>{locale === 'zh' ? '历史问题和生成状态' : 'Previous questions and generation status'}</span>
              </div>
              <div>
                <button type="button" onClick={() => void loadJobs(true)} aria-label={locale === 'zh' ? '刷新历史' : 'Refresh history'}>
                  <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
                </button>
                <button type="button" onClick={() => setHistoryOpen(false)} aria-label={locale === 'zh' ? '关闭历史' : 'Close history'}>
                  <X size={18} />
                </button>
              </div>
            </header>
            <div className="research-history-list custom-scrollbar">
              {loading ? (
                <div className="research-history-empty"><LoaderCircle className="animate-spin" size={22} /></div>
              ) : jobs.length === 0 ? (
                <div className="research-history-empty">
                  <FileText size={28} />
                  <p>{locale === 'zh' ? '还没有研究记录' : 'No research history yet'}</p>
                </div>
              ) : (
                <ol>
                  {jobs.map((job) => (
                    <li key={job.jobId}>
                      <article>
                        <div className="research-history-meta">
                          <StatusBadge status={job.status} language={locale} />
                          <time>{formatDate(job.createdAt, locale)}</time>
                        </div>
                        <p>{job.researchQuestion}</p>
                        <div className="research-history-actions">
                          <span>{job.datasetVersion} · {locale === 'zh' ? '步骤' : 'Step'} {job.currentStep}/{job.targetStep}</span>
                          {job.status === 'completed' && (
                            <button type="button" onClick={() => void openReport(job)}>
                              {locale === 'zh' ? '查看报告' : 'View report'}
                            </button>
                          )}
                          {(job.status === 'queued' || job.status === 'running') && (
                            <button type="button" className="is-danger" onClick={() => void cancelJob(job.jobId)}>
                              {locale === 'zh' ? '取消' : 'Cancel'}
                            </button>
                          )}
                        </div>
                      </article>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
        </div>
      )}

      {reportOpen && (
        <div className="research-report-overlay" role="presentation" onMouseDown={() => setReportOpen(false)}>
          <section className="research-report-dialog" role="dialog" aria-modal="true" aria-label={locale === 'zh' ? '研究报告' : 'Research report'} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <StatusBadge status="completed" language={locale} />
                <p>{selectedJob?.researchQuestion}</p>
              </div>
              <button type="button" onClick={() => setReportOpen(false)} aria-label={locale === 'zh' ? '关闭报告' : 'Close report'}>
                <X size={18} />
              </button>
            </header>
            <div className="research-report-content">
              {reportLoading ? (
                <LoaderCircle className="animate-spin" size={28} />
              ) : report ? (
                <>
                  {report.executiveSummary && <p className="research-report-summary">{report.executiveSummary}</p>}
                  <iframe title={locale === 'zh' ? 'Insight 分析报告' : 'Insight analysis report'} sandbox="" srcDoc={report.reportHtml} />
                </>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
