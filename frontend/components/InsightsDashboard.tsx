import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  LoaderCircle,
  Play,
  RefreshCw,
  XCircle,
} from 'lucide-react';

import { useLanguage } from '../contexts/LanguageContext';
import { insightJobsAPI } from '../services/api';
import type { InsightJob, InsightJobStatus, InsightJobSystemStatus, InsightReport } from '../types';

type StatusFilter = 'all' | InsightJobStatus;

const STATUS_STYLES: Record<InsightJobStatus, string> = {
  queued: 'bg-amber-50 text-amber-700 border-amber-200',
  running: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
};

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
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${STATUS_STYLES[status]}`}>
      <Icon className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {STATUS_LABELS[status][language]}
    </span>
  );
}

export function InsightsDashboard() {
  const { language } = useLanguage();
  const locale = language === 'zh' ? 'zh' : 'en';
  const [systemStatus, setSystemStatus] = useState<InsightJobSystemStatus | null>(null);
  const [jobs, setJobs] = useState<InsightJob[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [report, setReport] = useState<InsightReport | null>(null);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.jobId === selectedJobId) ?? null,
    [jobs, selectedJobId],
  );
  const hasActiveJobs = jobs.some((job) => job.status === 'queued' || job.status === 'running');

  const loadJobs = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const nextJobs = await insightJobsAPI.list({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 50,
      });
      setJobs(nextJobs);
      setSelectedJobId((current) => {
        if (current && nextJobs.some((job) => job.jobId === current)) return current;
        return nextJobs[0]?.jobId ?? null;
      });
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load insight jobs');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([insightJobsAPI.getStatus(), insightJobsAPI.list({
      status: statusFilter === 'all' ? undefined : statusFilter,
      limit: 50,
    })])
      .then(([nextStatus, nextJobs]) => {
        if (!active) return;
        setSystemStatus(nextStatus);
        setJobs(nextJobs);
        setSelectedJobId((current) => {
          if (current && nextJobs.some((job) => job.jobId === current)) return current;
          return nextJobs[0]?.jobId ?? null;
        });
        setError(null);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load insight jobs');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [statusFilter]);

  useEffect(() => {
    if (!hasActiveJobs) return undefined;
    const intervalId = window.setInterval(() => {
      void loadJobs();
    }, 10_000);
    return () => window.clearInterval(intervalId);
  }, [hasActiveJobs, loadJobs]);

  useEffect(() => {
    if (!selectedJob || selectedJob.status !== 'completed') {
      setReport(null);
      setReportLoading(false);
      return undefined;
    }
    let active = true;
    setReportLoading(true);
    insightJobsAPI.getReport(selectedJob.jobId)
      .then((nextReport) => {
        if (!active) return;
        setReport(nextReport);
        setError(null);
      })
      .catch((loadError) => {
        if (!active) return;
        setReport(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load report');
      })
      .finally(() => {
        if (active) setReportLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedJob]);

  const submitJob = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const researchQuestion = question.trim();
    if (researchQuestion.length < 10 || !systemStatus?.enabled) return;
    setSubmitting(true);
    try {
      const created = await insightJobsAPI.create({ researchQuestion });
      setJobs((current) => [created, ...current.filter((job) => job.jobId !== created.jobId)]);
      setSelectedJobId(created.jobId);
      setQuestion('');
      setError(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit insight job');
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
      setError(cancelError instanceof Error ? cancelError.message : 'Unable to cancel job');
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-6 pr-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[#007AFF]">
            <FileText className="h-4 w-4" /> Insight Factory
          </div>
          <h2 className="text-[32px] font-bold tracking-tight text-[#1D1D1F]">
            {locale === 'zh' ? '供应链分析报告' : 'Supply Chain Insight Reports'}
          </h2>
          <p className="mt-1 text-[15px] font-medium text-[#86868B]">
            {locale === 'zh' ? '创建深度分析任务，并集中查看 Insight Factory 生成的历史报告。' : 'Create deep-research jobs and review reports generated by Insight Factory.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadJobs(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#1D1D1F] transition hover:bg-[#F5F5F7]"
        >
          <RefreshCw className="h-4 w-4" />
          {locale === 'zh' ? '刷新' : 'Refresh'}
        </button>
      </header>

      {!systemStatus?.enabled && systemStatus && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">{locale === 'zh' ? '新分析任务暂未开放' : 'New analysis jobs are currently disabled'}</p>
            <p className="mt-1 text-amber-700">
              {locale === 'zh' ? '历史报告仍可查看。部署 Insight Factory worker 并启用后端任务开关后，即可在这里提交任务。' : 'Historical reports remain available. Enable the backend job switch after deploying the Insight Factory worker to submit new work here.'}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={submitJob} className="rounded-[24px] border border-black/5 bg-white p-5 shadow-sm">
        <label htmlFor="insight-question" className="text-sm font-bold text-[#1D1D1F]">
          {locale === 'zh' ? '新的研究问题' : 'New research question'}
        </label>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row">
          <textarea
            id="insight-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            minLength={10}
            maxLength={4000}
            disabled={!systemStatus?.enabled || submitting}
            placeholder={locale === 'zh' ? '例如：过去三年全球先进制程设备贸易流发生了哪些结构性变化？' : 'Example: How have global advanced-node equipment trade flows changed structurally over the past three years?'}
            className="min-h-24 flex-1 resize-y rounded-2xl border border-black/10 bg-[#F5F5F7] px-4 py-3 text-sm outline-none transition focus:border-[#007AFF] focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!systemStatus?.enabled || submitting || question.trim().length < 10}
            className="inline-flex min-w-36 items-center justify-center gap-2 self-stretch rounded-2xl bg-[#007AFF] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0066D6] disabled:cursor-not-allowed disabled:opacity-50 lg:self-auto"
          >
            {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {locale === 'zh' ? '开始分析' : 'Start analysis'}
          </button>
        </div>
        {systemStatus?.defaultDatasetVersion && (
          <p className="mt-2 text-xs text-[#86868B]">
            {locale === 'zh' ? '默认数据版本' : 'Default dataset'}: {systemStatus.defaultDatasetVersion}
          </p>
        )}
      </form>

      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid min-h-[620px] gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col rounded-[24px] border border-black/5 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-black/5 p-4">
            <h3 className="font-bold text-[#1D1D1F]">{locale === 'zh' ? '任务与报告' : 'Jobs & reports'}</h3>
            <select
              aria-label={locale === 'zh' ? '按状态筛选' : 'Filter by status'}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs text-[#1D1D1F]"
            >
              <option value="all">{locale === 'zh' ? '全部' : 'All'}</option>
              {(Object.keys(STATUS_LABELS) as InsightJobStatus[]).map((status) => (
                <option key={status} value={status}>{STATUS_LABELS[status][locale]}</option>
              ))}
            </select>
          </div>

          <div className="max-h-[760px] overflow-y-auto p-3">
            {loading ? (
              <div className="flex h-40 items-center justify-center text-[#86868B]">
                <LoaderCircle className="h-6 w-6 animate-spin" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center px-5 text-center text-sm text-[#86868B]">
                <FileText className="mb-3 h-8 w-8 text-[#C7C7CC]" />
                {locale === 'zh' ? '目前没有符合条件的分析任务。' : 'No matching analysis jobs yet.'}
              </div>
            ) : (
              <ol className="space-y-2">
                {jobs.map((job) => (
                  <li key={job.jobId}>
                    <button
                      type="button"
                      onClick={() => setSelectedJobId(job.jobId)}
                      className={`w-full rounded-2xl border p-3 text-left transition ${selectedJobId === job.jobId ? 'border-[#007AFF] bg-blue-50/60' : 'border-black/5 hover:border-black/10 hover:bg-[#F5F5F7]'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <StatusBadge status={job.status} language={locale} />
                        <span className="text-[10px] text-[#86868B]">{formatDate(job.createdAt, locale)}</span>
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm font-semibold leading-5 text-[#1D1D1F]">{job.researchQuestion}</p>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/5">
                        <div className="h-full rounded-full bg-[#007AFF] transition-all" style={{ width: `${Math.min(100, Math.max(0, job.currentStep / job.targetStep * 100))}%` }} />
                      </div>
                      <p className="mt-1 text-[10px] text-[#86868B]">Step {job.currentStep} / {job.targetStep} · {job.datasetVersion}</p>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <section className="min-w-0 rounded-[24px] border border-black/5 bg-white p-5 shadow-sm">
          {!selectedJob ? (
            <div className="flex h-full min-h-96 flex-col items-center justify-center text-center text-[#86868B]">
              <FileText className="mb-4 h-10 w-10 text-[#C7C7CC]" />
              <p className="font-semibold">{locale === 'zh' ? '选择左侧任务查看详情' : 'Select a job to view its details'}</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/5 pb-5">
                <div className="min-w-0 flex-1">
                  <StatusBadge status={selectedJob.status} language={locale} />
                  <h3 className="mt-3 text-xl font-bold leading-7 text-[#1D1D1F]">{selectedJob.researchQuestion}</h3>
                  <p className="mt-2 text-xs text-[#86868B]">
                    {selectedJob.datasetVersion} · {formatDate(selectedJob.createdAt, locale)}
                  </p>
                </div>
                {(selectedJob.status === 'queued' || selectedJob.status === 'running') && (
                  <button
                    type="button"
                    onClick={() => void cancelJob(selectedJob.jobId)}
                    className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    {locale === 'zh' ? '取消任务' : 'Cancel job'}
                  </button>
                )}
              </div>

              {selectedJob.status === 'completed' ? (
                reportLoading ? (
                  <div className="flex h-80 items-center justify-center text-[#86868B]">
                    <LoaderCircle className="h-7 w-7 animate-spin" />
                  </div>
                ) : report ? (
                  <>
                    {report.executiveSummary && (
                      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#007AFF]">
                          {locale === 'zh' ? '执行摘要' : 'Executive summary'}
                        </h4>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#1D1D1F]">{report.executiveSummary}</p>
                      </div>
                    )}
                    <iframe
                      title={locale === 'zh' ? 'Insight 分析报告' : 'Insight analysis report'}
                      sandbox=""
                      srcDoc={report.reportHtml}
                      className="h-[900px] w-full rounded-2xl border border-black/10 bg-white"
                    />
                    <p className="text-xs text-[#86868B]">Insight Factory {report.factoryVersion}</p>
                  </>
                ) : (
                  <div className="rounded-2xl bg-[#F5F5F7] p-5 text-sm text-[#86868B]">
                    {locale === 'zh' ? '任务已完成，但报告内容尚未写入。' : 'The job completed, but no report content is available.'}
                  </div>
                )
              ) : (
                <div className="rounded-2xl bg-[#F5F5F7] p-5">
                  <p className="font-semibold text-[#1D1D1F]">
                    {selectedJob.status === 'failed'
                      ? (locale === 'zh' ? '分析任务失败' : 'Analysis failed')
                      : selectedJob.status === 'cancelled'
                        ? (locale === 'zh' ? '分析任务已取消' : 'Analysis was cancelled')
                        : (locale === 'zh' ? 'Insight Factory 正在处理该任务' : 'Insight Factory is processing this job')}
                  </p>
                  <p className="mt-2 text-sm text-[#86868B]">
                    {selectedJob.errorMessage || `${locale === 'zh' ? '当前步骤' : 'Current step'}: ${selectedJob.currentStep} / ${selectedJob.targetStep}`}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
