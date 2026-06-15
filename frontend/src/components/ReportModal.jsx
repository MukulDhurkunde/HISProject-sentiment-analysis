import React, { useMemo } from 'react';
import { X, Printer, FileText, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useDataset } from '../context/DatasetContext';
import frankfurtImg from '../assets/Frankfurt_University.png';

// ── Constants ────────────────────────────────────────────────────────────────

const LEXICON_NAMES = { bing: 'Bing Lexicon', afinn: 'AFINN Lexicon', nrc: 'NRC Lexicon' };
const MODEL_NAMES = {
  naive_bayes: 'Naive Bayes',
  svm: 'Support Vector Machine (SVM)',
  random_forest: 'Random Forest',
};
const CONFIG_LABELS = {
  lowercase: 'Lowercase conversion',
  removeUrlsHtml: 'URL / HTML removal',
  stopwords: 'Stopword removal',
  punctuation: 'Punctuation removal',
  specialChars: 'Special character removal',
  numbers: 'Number removal',
};
const MISSING_LABELS = { deletion: 'Row Deletion', replace: 'Skip in Analysis' };

// ── Stat helpers ─────────────────────────────────────────────────────────────

const avg = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const wordCount = str => str.trim().split(/\s+/).filter(w => w).length;
const truncate = (str, n = 110) => (str.length > n ? str.slice(0, n) + '…' : str);

// ── Main component ────────────────────────────────────────────────────────────

export function ReportModal({ onClose }) {
  const {
    fileInfo,
    selectedTextColumn,
    labelColumn,
    analysisConfig,
    analysisResults,
    ingestionStats,
    appliedPreprocessConfig,
  } = useDataset();

  const lexicon     = analysisConfig?.lexicon || 'afinn';
  const mlModel     = analysisConfig?.mlModel || analysisConfig?.model;
  const sensitivity = analysisConfig?.sensitivity ?? 50;
  const ml          = analysisResults?.ml_metrics || null;
  const insights    = analysisResults?.insights   || null;
  const rows        = analysisResults?.processed_rows || [];
  const textCol     = selectedTextColumn || '';

  const generatedDate = new Date().toLocaleString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // ── Computed analytics (all derived from processed_rows) ──────────────────

  const computed = useMemo(() => {
    if (!rows.length) return null;

    // 1. Per-class score + length stats
    const byClass = { Positive: { scores: [], lengths: [] }, Neutral: { scores: [], lengths: [] }, Negative: { scores: [], lengths: [] } };
    rows.forEach(row => {
      const c = row.sentiment_label;
      const s = Number(row.sentiment_score || 0);
      const wc = wordCount(String(row[textCol] || ''));
      if (c in byClass) {
        byClass[c].scores.push(s);
        byClass[c].lengths.push(wc);
      }
    });

    const classStats = {};
    ['Positive', 'Neutral', 'Negative'].forEach(c => {
      const { scores, lengths } = byClass[c];
      classStats[c] = {
        count: scores.length,
        avgScore: avg(scores),
        avgLength: avg(lengths),
        maxScore: scores.length ? Math.max(...scores) : 0,
        minScore: scores.length ? Math.min(...scores) : 0,
      };
    });

    // 2. Extreme examples
    const enriched = rows.map(row => ({
      score: Number(row.sentiment_score || 0),
      label: row.sentiment_label,
      text: String(row[textCol] || ''),
    }));

    const byScore = [...enriched].sort((a, b) => b.score - a.score);
    const topPositive = byScore.filter(r => r.score > 0).slice(0, 5);
    const topNegative = [...byScore].reverse().filter(r => r.score < 0).slice(0, 5);
    const borderline  = [...enriched]
      .sort((a, b) => Math.abs(a.score) - Math.abs(b.score))
      .slice(0, 5);

    // 3. Lexicon coverage
    const posSet = new Set(insights?.lexicon_words?.positive || []);
    const negSet = new Set(insights?.lexicon_words?.negative || []);
    const lexSet = new Set([...posSet, ...negSet]);
    let totalWords = 0, coveredWords = 0;
    rows.forEach(row => {
      const words = String(row[textCol] || '').toLowerCase().split(/\W+/).filter(w => w.length > 1);
      totalWords += words.length;
      coveredWords += words.filter(w => lexSet.has(w)).length;
    });
    const coverage = totalWords > 0 ? Math.round((coveredWords / totalWords) * 100) : 0;

    // 4. Low-confidence count (score very close to zero)
    const lowConfThreshold = 0.05;
    const lowConfCount = enriched.filter(r => Math.abs(r.score) < lowConfThreshold).length;
    const lowConfPct   = Math.round((lowConfCount / rows.length) * 100);

    // 5. Dominant sentiment
    const total = rows.length;
    const counts = { Positive: classStats.Positive.count, Neutral: classStats.Neutral.count, Negative: classStats.Negative.count };
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const dominantPct = Math.round((dominant[1] / total) * 100);

    // 6. Text length insight
    const avgPos = classStats.Positive.avgLength;
    const avgNeg = classStats.Negative.avgLength;
    const lengthDiffPct = avgPos > 0 ? Math.round(((avgNeg - avgPos) / avgPos) * 100) : 0;

    return {
      classStats, topPositive, topNegative, borderline,
      coverage, lowConfCount, lowConfPct,
      total, counts, dominant, dominantPct,
      avgPos, avgNeg, lengthDiffPct,
    };
  }, [rows, textCol, insights]);

  const pre  = appliedPreprocessConfig || {};
  const preConfig = pre.config || {};
  const appliedOptions = Object.entries(preConfig).filter(([, v]) => v).map(([k]) => CONFIG_LABELS[k] || k);

  // Coverage quality label
  const coverageLabel = !computed ? null
    : computed.coverage >= 30 ? { text: 'Good', icon: 'ok' }
    : computed.coverage >= 15 ? { text: 'Moderate', icon: 'warn' }
    : { text: 'Low', icon: 'bad' };

  // Class balance quality label
  const balanceLabel = !computed ? null
    : computed.dominantPct >= 80 ? { text: 'Heavily Imbalanced', icon: 'bad' }
    : computed.dominantPct >= 60 ? { text: 'Moderately Imbalanced', icon: 'warn' }
    : { text: 'Balanced', icon: 'ok' };

  const completeness = ingestionStats
    ? Math.round(((ingestionStats.totalRecords - ingestionStats.missingCount / Math.max(ingestionStats.columnsCount, 1)) / ingestionStats.totalRecords) * 100)
    : 100;
  const completenessLabel = completeness >= 95 ? { text: `${completeness}%`, icon: 'ok' }
    : completeness >= 80 ? { text: `${completeness}%`, icon: 'warn' }
    : { text: `${completeness}%`, icon: 'bad' };

  return (
    <div className="print-modal-root fixed inset-0 z-50 flex items-stretch">
      <div className="absolute inset-0 bg-black/60 no-print" onClick={onClose} />

      <div className="print-content-wrapper relative z-10 flex flex-col h-full w-full max-w-5xl mx-auto bg-white shadow-2xl">

        {/* Modal header — hidden during print */}
        <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-indigo-400" />
            <span className="text-sm font-semibold">Report Preview</span>
            <span className="text-xs text-slate-400">— scroll to see all sections, then Print / Save as PDF</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                // Clone the report into a top-level container (sibling of #root)
                // so it's free of all parent overflow/height/position constraints
                const report = document.querySelector('.report-printable');
                if (!report) return;

                const container = document.createElement('div');
                container.id = 'print-container';
                container.appendChild(report.cloneNode(true));
                document.body.appendChild(container);
                document.body.classList.add('printing-active');

                window.print();

                // Clean up after print dialog closes (save or cancel)
                const cleanup = () => {
                  document.body.classList.remove('printing-active');
                  container.remove();
                  window.removeEventListener('afterprint', cleanup);
                };
                window.addEventListener('afterprint', cleanup);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print / Save as PDF
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Report body */}
        <div className="print-content-wrapper flex-1 overflow-y-auto bg-slate-100">
          <div className="report-printable max-w-[820px] mx-auto bg-white shadow-sm my-6 text-slate-800">

            {/* ══ COVER ═══════════════════════════════════════════════════════ */}
            <div className="bg-slate-900 text-white px-12 pt-10 pb-8">
              <div className="flex items-start justify-between mb-6">
                <img src={frankfurtImg} alt="Frankfurt University of Applied Sciences" className="h-10 object-contain opacity-90" />
                <div className="text-right">
                  <p className="text-xs text-slate-400">Generated</p>
                  <p className="text-sm text-slate-300 font-medium">{generatedDate}</p>
                </div>
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-1">Sentiment Analysis Report</h1>
              {fileInfo && (
                <p className="text-indigo-300 text-sm font-medium mb-6">{fileInfo.name}</p>
              )}

              {/* Headline stats row */}
              {computed && (
                <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-700">
                  <CoverStat label="Total Records" value={(ingestionStats?.totalRecords ?? computed.total).toLocaleString()} />
                  <CoverStat label="Dominant Sentiment" value={`${computed.dominant[0]}`} sub={`${computed.dominantPct}% of dataset`} accent />
                  <CoverStat label="Analysis Method" value={LEXICON_NAMES[lexicon] || lexicon} />
                  <CoverStat label="ML Model" value={ml ? (MODEL_NAMES[ml.model_name] || ml.model_name) : 'Not used'} />
                </div>
              )}
            </div>

            {/* ══ BODY SECTIONS ════════════════════════════════════════════════ */}
            <div className="print-body-sections px-12 py-8 space-y-10">

              {/* ── 1. Data Pipeline Journey ────────────────────────────────── */}
              <Section title="1. Data Pipeline Journey" subtitle="How your raw input transformed through each stage">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <PipelineCard stage="Raw Input" color="bg-slate-100 border-slate-300">
                    <StatRow k="Total Records" v={(ingestionStats?.totalRecords ?? computed?.total ?? '—').toLocaleString()} />
                    <StatRow k="Columns"       v={ingestionStats?.columnsCount ?? '—'} />
                    <StatRow k="Language"      v={ingestionStats ? `${ingestionStats.detectedLanguage}` : '—'} />
                    <StatRow k="Missing Cells" v={ingestionStats ? `${ingestionStats.missingCount} (${ingestionStats.missingPercent}%)` : '—'} />
                  </PipelineCard>

                  <PipelineCard stage="After Preprocessing" color="bg-indigo-50 border-indigo-200">
                    <StatRow k="Records Kept"    v={pre.processedCount != null ? `${pre.processedCount.toLocaleString()}` : '—'} />
                    <StatRow k="Rows Removed"    v={
                      (pre.originalCount != null && pre.processedCount != null)
                        ? `${(pre.originalCount - pre.processedCount)} (-${Math.round(((pre.originalCount - pre.processedCount) / pre.originalCount) * 100)}%)`
                        : '—'
                    } />
                    <StatRow k="Unique Vocab"    v={pre.vocabSize ? `${pre.vocabSize.toLocaleString()} words` : '—'} />
                    <StatRow k="Noise Reduced"   v={pre.noiseReduction != null ? `${pre.noiseReduction}% of raw chars` : '—'} />
                  </PipelineCard>

                  <PipelineCard stage="Analysis Ready" color="bg-emerald-50 border-emerald-200">
                    <StatRow k="Records Scored"  v={computed?.total.toLocaleString() ?? '—'} />
                    <StatRow k="Positive"         v={computed ? `${computed.counts.Positive} (${Math.round(computed.counts.Positive/computed.total*100)}%)` : '—'} />
                    <StatRow k="Neutral"          v={computed ? `${computed.counts.Neutral} (${Math.round(computed.counts.Neutral/computed.total*100)}%)` : '—'} />
                    <StatRow k="Negative"         v={computed ? `${computed.counts.Negative} (${Math.round(computed.counts.Negative/computed.total*100)}%)` : '—'} />
                  </PipelineCard>
                </div>

                {/* Preprocessing config applied */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm">
                  <span className="font-semibold text-slate-700">Preprocessing applied: </span>
                  {appliedOptions.length > 0
                    ? <span className="text-slate-600">{appliedOptions.join(' · ')}</span>
                    : <span className="text-slate-400 italic">No normalization applied</span>}
                  <span className="mx-2 text-slate-300">|</span>
                  <span className="font-semibold text-slate-700">Missing text: </span>
                  <span className="text-slate-600">{MISSING_LABELS[pre.missingHandling] || '—'}</span>
                </div>
              </Section>

              {/* ── 2. Sentiment Distribution + Score Statistics ─────────────── */}
              <Section title="2. Sentiment Distribution & Score Analysis" subtitle="Distribution counts enriched with score and text-length statistics per class">
                {computed ? (
                  <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-3 font-semibold text-slate-700">Class</th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-700">Count</th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-700">Share</th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-700">Avg Score</th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-700">Avg Length</th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-700">Max Score</th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-700">Min Score</th>
                        <th className="px-4 py-3 font-semibold text-slate-700 w-32">Bar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Positive', bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-white' },
                        { label: 'Neutral',  bar: 'bg-slate-400',   text: 'text-slate-500',   bg: 'bg-slate-50' },
                        { label: 'Negative', bar: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-white' },
                      ].map(({ label, bar, text, bg }) => {
                        const s = computed.classStats[label];
                        const pct = Math.round((s.count / computed.total) * 100);
                        return (
                          <tr key={label} className={`border-b border-slate-100 ${bg}`}>
                            <td className={`px-4 py-3 font-bold ${text}`}>{label}</td>
                            <td className="px-4 py-3 text-right font-mono">{s.count.toLocaleString()}</td>
                            <td className={`px-4 py-3 text-right font-bold ${text}`}>{pct}%</td>
                            <td className="px-4 py-3 text-right font-mono">{s.avgScore >= 0 ? '+' : ''}{s.avgScore.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-mono">{Math.round(s.avgLength)} words</td>
                            <td className="px-4 py-3 text-right font-mono text-emerald-600">{s.maxScore >= 0 ? '+' : ''}{s.maxScore.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-mono text-red-600">{s.minScore.toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <div className="w-full bg-slate-100 rounded-full h-2.5">
                                <div className={`h-2.5 rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50 border-t-2 border-slate-200">
                        <td className="px-4 py-2.5 font-bold text-slate-700">Total</td>
                        <td className="px-4 py-2.5 text-right font-bold font-mono">{computed.total.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-bold">100%</td>
                        <td colSpan={5} />
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <Empty />
                )}

                {/* Length insight callout */}
                {computed && Math.abs(computed.lengthDiffPct) >= 5 && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                    <span className="font-bold">Text length insight: </span>
                    {computed.avgNeg > computed.avgPos
                      ? `Negative reviews are ${Math.abs(computed.lengthDiffPct)}% longer on average than positive ones (${Math.round(computed.avgNeg)} vs ${Math.round(computed.avgPos)} words). Users tend to elaborate more when expressing dissatisfaction.`
                      : `Positive reviews are ${Math.abs(computed.lengthDiffPct)}% longer on average than negative ones (${Math.round(computed.avgPos)} vs ${Math.round(computed.avgNeg)} words). This may indicate that satisfied users write more detailed feedback.`
                    }
                  </div>
                )}
              </Section>

              {/* ── 3. Extreme Examples ─────────────────────────────────────── */}
              <Section title="3. Most Revealing Examples" subtitle="Automatically selected by score magnitude — these are not arbitrary first rows">
                {computed ? (
                  <div className="space-y-5">
                    <ExtremeTable title="Top 5 Most Positive Reviews" rows={computed.topPositive} accent="emerald" />
                    <ExtremeTable title="Top 5 Most Negative Reviews" rows={computed.topNegative} accent="red" />
                    <ExtremeTable
                      title="Top 5 Borderline Reviews (Hardest to Classify)"
                      subtitle="Score closest to zero — highest ambiguity, most likely to be misclassified"
                      rows={computed.borderline}
                      accent="amber"
                      showLabel
                    />
                  </div>
                ) : (
                  <Empty />
                )}
              </Section>

              {/* ── 4. Lexicon-Specific Analysis ────────────────────────────── */}
              <Section
                title={`4. ${LEXICON_NAMES[lexicon] || lexicon.toUpperCase()} — Detailed Results`}
                subtitle={
                  lexicon === 'bing'  ? 'Top words driving positive and negative classifications' :
                  lexicon === 'afinn' ? 'Distribution of texts across the -5 to +5 scoring range' :
                  'Average emotion intensity by sentiment class'
                }
              >
                {lexicon === 'bing' && insights?.bing_word_freqs ? (
                  <div className="grid grid-cols-2 gap-6">
                    <WordFreqTable title="Top 10 Positive Words" words={insights.bing_word_freqs.positive || []} accent="emerald" />
                    <WordFreqTable title="Top 10 Negative Words" words={insights.bing_word_freqs.negative || []} accent="red" />
                  </div>
                ) : lexicon === 'afinn' && computed ? (
                  <AfinnDistTable rows={rows} total={computed.total} />
                ) : lexicon === 'nrc' && insights?.nrc_emotion_matrix ? (
                  <NrcMatrixTable matrix={insights.nrc_emotion_matrix} />
                ) : (
                  <Empty />
                )}
              </Section>

              {/* ── 5. Key Insights ─────────────────────────────────────────── */}
              <Section title="5. Key Insights" subtitle="R-generated analytical findings plus additional computed observations">
                <div className="space-y-3">
                  {/* R-generated */}
                  {insights ? (
                    <>
                      <InsightItem label="Conflict Detection"         text={insights.conflict_detection}        border="border-rose-500"   bg="bg-rose-50"   />
                      <InsightItem label="Confidence Warning"          text={insights.confidence_warning}         border="border-amber-500"  bg="bg-amber-50"  />
                      <InsightItem label="Actionable Recommendation"   text={insights.actionable_recommendation}  border="border-emerald-500" bg="bg-emerald-50" />
                    </>
                  ) : (
                    <p className="text-sm text-slate-400 italic">No insights available.</p>
                  )}

                  {/* Computed insights */}
                  {computed && (
                    <>
                      <InsightItem
                        label="Lexicon Coverage"
                        border={computed.coverage >= 30 ? 'border-emerald-500' : computed.coverage >= 15 ? 'border-amber-500' : 'border-red-500'}
                        bg={computed.coverage >= 30 ? 'bg-emerald-50' : computed.coverage >= 15 ? 'bg-amber-50' : 'bg-red-50'}
                        text={
                          computed.coverage >= 30
                            ? `${computed.coverage}% of words in your dataset matched the ${LEXICON_NAMES[lexicon]} — good dictionary coverage for reliable results.`
                            : computed.coverage >= 15
                            ? `${computed.coverage}% of words matched the ${LEXICON_NAMES[lexicon]}. Moderate coverage — results are directional but may miss domain-specific language.`
                            : `Only ${computed.coverage}% of words matched the ${LEXICON_NAMES[lexicon]}. Low coverage — the lexicon may not suit this domain. Consider a different lexicon or pre-training a custom vocabulary.`
                        }
                      />
                      {computed.dominantPct >= 60 && (
                        <InsightItem
                          label="Class Imbalance Notice"
                          border="border-amber-500"
                          bg="bg-amber-50"
                          text={`${computed.dominant[0]} class dominates at ${computed.dominantPct}% of all records. If you plan to use ML models, consider collecting more samples from under-represented classes to prevent bias.`}
                        />
                      )}
                      {computed.lowConfPct >= 10 && (
                        <InsightItem
                          label="High Ambiguity Volume"
                          border="border-violet-500"
                          bg="bg-violet-50"
                          text={`${computed.lowConfCount} reviews (${computed.lowConfPct}%) scored very close to zero — these are highly ambiguous and the assigned label may not reflect true sentiment. Manual review of this subset is recommended.`}
                        />
                      )}
                    </>
                  )}
                </div>
              </Section>

              {/* ── 6. ML Performance ───────────────────────────────────────── */}
              <Section title="6. Machine Learning Model Performance" subtitle="Metrics evaluated on a held-out 20% test set using stratified splitting">
                {ml && ml.accuracy != null ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                      <MetricCard label="Accuracy"  value={`${ml.accuracy}%`}  color="text-emerald-700 bg-emerald-50 border-emerald-200" />
                      <MetricCard label="F1-Score"  value={`${ml.f1_score}%`}  color="text-indigo-700 bg-indigo-50 border-indigo-200"   />
                      <MetricCard label="Precision" value={`${ml.precision}%`} color="text-violet-700 bg-violet-50 border-violet-200"   />
                      <MetricCard label="Recall"    value={`${ml.recall}%`}    color="text-amber-700 bg-amber-50 border-amber-200"     />
                    </div>
                    <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                      <tbody>
                        <tr className="bg-slate-50"><td className="px-4 py-2.5 font-medium text-slate-500 w-48 border-r border-slate-100">Model Used</td><td className="px-4 py-2.5">{MODEL_NAMES[ml.model_name] || ml.model_name}</td></tr>
                        <tr className="bg-white">  <td className="px-4 py-2.5 font-medium text-slate-500 border-r border-slate-100">Training Feature</td><td className="px-4 py-2.5">{selectedTextColumn} → {labelColumn}</td></tr>
                        <tr className="bg-slate-50"><td className="px-4 py-2.5 font-medium text-slate-500 border-r border-slate-100">Train/Test Split</td><td className="px-4 py-2.5">80% / 20% stratified</td></tr>
                        <tr className="bg-white">  <td className="px-4 py-2.5 font-medium text-slate-500 border-r border-slate-100">Test Set Size</td><td className="px-4 py-2.5">{ml.test_size} samples</td></tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic bg-slate-50 rounded-lg p-4 border border-slate-200">
                    No ML model was used. To enable ML metrics, select a label column on the Data Ingestion page and choose a model on the Analysis Engine page.
                  </p>
                )}
              </Section>

              {/* ── 7. Data Quality Scorecard ───────────────────────────────── */}
              <Section title="7. Data Quality Scorecard" subtitle="Assessment of dataset suitability and result reliability">
                <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden mb-4">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">Metric</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">Value</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <QualityRow label="Data Completeness"         value={completenessLabel?.text}                        status={completenessLabel?.icon} />
                    <QualityRow label={`${LEXICON_NAMES[lexicon]} Coverage`} value={computed ? `${computed.coverage}%` : '—'} status={coverageLabel?.icon} />
                    <QualityRow label="Class Balance"             value={computed ? `${computed.dominant[0]} at ${computed.dominantPct}%` : '—'} status={balanceLabel?.icon} />
                    <QualityRow label="Low-Confidence Results"    value={computed ? `${computed.lowConfCount} records (${computed.lowConfPct}%)` : '—'} status={computed ? (computed.lowConfPct < 10 ? 'ok' : computed.lowConfPct < 25 ? 'warn' : 'bad') : null} />
                    <QualityRow label="Text Column"               value={selectedTextColumn || '—'} status={selectedTextColumn ? 'ok' : 'bad'} />
                    <QualityRow label="ML Model"                  value={ml ? 'Trained & Evaluated' : 'Not used'} status={ml ? 'ok' : 'warn'} />
                  </tbody>
                </table>

                {/* Recommendations */}
                {computed && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Recommendations</p>
                    <ul className="space-y-1.5 text-sm text-slate-700">
                      {computed.coverage < 15 && (
                        <li className="flex gap-2"><span className="text-red-500 shrink-0">•</span> Low lexicon coverage detected. Try the NRC lexicon for broader emotional vocabulary, or verify that your text column has been properly cleaned.</li>
                      )}
                      {computed.coverage >= 15 && computed.coverage < 30 && (
                        <li className="flex gap-2"><span className="text-amber-500 shrink-0">•</span> Moderate lexicon coverage. Applying stopword removal and lowercasing may improve match rates.</li>
                      )}
                      {computed.dominantPct >= 70 && (
                        <li className="flex gap-2"><span className="text-amber-500 shrink-0">•</span> Dataset is heavily skewed toward {computed.dominant[0]}. ML models trained on this data may be biased — consider augmenting with more balanced samples.</li>
                      )}
                      {computed.lowConfPct >= 20 && (
                        <li className="flex gap-2"><span className="text-violet-500 shrink-0">•</span> {computed.lowConfPct}% of results are low-confidence. Increasing the sensitivity threshold on the Analysis page will reclassify borderline texts more aggressively.</li>
                      )}
                      {!ml && labelColumn && (
                        <li className="flex gap-2"><span className="text-indigo-500 shrink-0">•</span> A label column was detected but ML was not trained. Re-running the analysis with an ML model selected will provide classification accuracy metrics.</li>
                      )}
                      {computed.coverage >= 30 && computed.dominantPct < 60 && computed.lowConfPct < 10 && (
                        <li className="flex gap-2"><span className="text-emerald-500 shrink-0">•</span> Dataset quality is good. Results are reliable for the selected lexicon.</li>
                      )}
                    </ul>
                  </div>
                )}
              </Section>

              {/* ── Footer ──────────────────────────────────────────────────── */}
              <div className="report-footer border-t-2 border-slate-100 pt-6 text-center space-y-1">
                <p className="text-xs text-slate-400 font-medium">Sentiment Analysis Pipeline — Frankfurt University of Applied Sciences</p>
                <p className="text-xs text-slate-400">Report generated on {generatedDate}</p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, subtitle, children }) {
  return (
    <div className="space-y-3">
      <div className="border-b border-slate-100 pb-2">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function CoverStat({ label, value, sub, accent }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-lg font-bold ${accent ? 'text-indigo-300' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function PipelineCard({ stage, color, children }) {
  return (
    <div className={`rounded-lg border p-4 ${color} avoid-page-break`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">{stage}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function StatRow({ k, v }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-slate-500 shrink-0">{k}</span>
      <span className="font-semibold text-slate-800 text-right">{v}</span>
    </div>
  );
}

function InsightItem({ label, text, border, bg }) {
  return (
    <div className={`flex gap-3 p-4 rounded-lg border-l-4 ${border} ${bg} avoid-page-break`}>
      <div>
        <h4 className="text-sm font-bold text-slate-900 mb-1">{label}</h4>
        <p className="text-sm text-slate-700 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function ExtremeTable({ title, subtitle, rows, accent, showLabel }) {
  const accentMap = {
    emerald: { header: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800', score: 'text-emerald-600' },
    red:     { header: 'text-red-700',     badge: 'bg-red-100 text-red-800',         score: 'text-red-600' },
    amber:   { header: 'text-amber-700',   badge: 'bg-amber-100 text-amber-800',     score: 'text-amber-700' },
  };
  const c = accentMap[accent] || accentMap.amber;

  if (!rows.length) return null;

  return (
    <div className="avoid-page-break">
      <h4 className={`text-sm font-bold mb-1 ${c.header}`}>{title}</h4>
      {subtitle && <p className="text-xs text-slate-400 mb-2">{subtitle}</p>}
      <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-right px-3 py-2 font-semibold text-slate-600 w-16">Score</th>
            {showLabel && <th className="text-left px-3 py-2 font-semibold text-slate-600 w-20">Label</th>}
            <th className="text-left px-3 py-2 font-semibold text-slate-600">Text</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
              <td className={`px-3 py-2.5 text-right font-bold font-mono ${c.score}`}>
                {r.score >= 0 ? '+' : ''}{r.score.toFixed(2)}
              </td>
              {showLabel && (
                <td className="px-3 py-2.5">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    r.label === 'Positive' ? 'bg-emerald-100 text-emerald-800' :
                    r.label === 'Negative' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'
                  }`}>{r.label}</span>
                </td>
              )}
              <td className="px-3 py-2.5 text-slate-700 leading-relaxed">{truncate(r.text)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WordFreqTable({ title, words, accent }) {
  const color = accent === 'emerald' ? 'text-emerald-700' : 'text-red-700';
  return (
    <div className="avoid-page-break">
      <h4 className={`text-sm font-bold mb-2 ${color}`}>{title}</h4>
      <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-3 py-2 font-semibold text-slate-600 w-8">#</th>
            <th className="text-left px-3 py-2 font-semibold text-slate-600">Word</th>
            <th className="text-right px-3 py-2 font-semibold text-slate-600">Frequency</th>
            <th className="px-3 py-2 font-semibold text-slate-600 w-24">Bar</th>
          </tr>
        </thead>
        <tbody>
          {words.length === 0 ? (
            <tr><td colSpan={4} className="px-3 py-3 text-center text-slate-400 italic text-xs">No data</td></tr>
          ) : (() => {
            const maxCount = Math.max(...words.map(w => w.count), 1);
            return words.map((w, i) => (
              <tr key={i} className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                <td className="px-3 py-2 text-slate-400 font-mono text-xs">{i + 1}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{w.word}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700">{w.count}</td>
                <td className="px-3 py-2">
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className={accent === 'emerald' ? 'h-2 rounded-full bg-emerald-500' : 'h-2 rounded-full bg-red-500'}
                      style={{ width: `${(w.count / maxCount) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ));
          })()}
        </tbody>
      </table>
    </div>
  );
}

function AfinnDistTable({ rows, total }) {
  const bins = {};
  for (let s = -5; s <= 5; s++) bins[s] = 0;
  rows.forEach(row => {
    const raw = row.sentiment_score;
    if (raw == null || Number.isNaN(Number(raw))) return;
    const clamped = Math.max(-5, Math.min(5, Math.round(Number(raw))));
    bins[clamped]++;
  });
  const maxCount = Math.max(...Object.values(bins), 1);

  return (
    <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200">
          <th className="text-left px-4 py-3 font-semibold text-slate-700 w-20">Score</th>
          <th className="text-left px-4 py-3 font-semibold text-slate-700 w-24">Valence</th>
          <th className="text-right px-4 py-3 font-semibold text-slate-700 w-24">Count</th>
          <th className="text-right px-4 py-3 font-semibold text-slate-700 w-16">%</th>
          <th className="px-4 py-3 font-semibold text-slate-700">Distribution</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(bins).map(([score, count], i) => {
          const s = Number(score);
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const valence = s < 0 ? 'Negative' : s === 0 ? 'Neutral' : 'Positive';
          const barColor = s < 0 ? 'bg-red-400' : s === 0 ? 'bg-slate-300' : 'bg-emerald-400';
          const textColor = s < 0 ? 'text-red-600' : s === 0 ? 'text-slate-500' : 'text-emerald-600';
          return (
            <tr key={score} className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
              <td className="px-4 py-2 font-bold font-mono">{s > 0 ? `+${s}` : s}</td>
              <td className={`px-4 py-2 font-medium ${textColor}`}>{valence}</td>
              <td className="px-4 py-2 text-right font-mono">{count.toLocaleString()}</td>
              <td className="px-4 py-2 text-right font-mono">{pct}%</td>
              <td className="px-4 py-2">
                <div className="w-full bg-slate-100 rounded-full h-2.5">
                  <div className={`h-2.5 rounded-full ${barColor}`} style={{ width: `${(count / maxCount) * 100}%` }} />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function NrcMatrixTable({ matrix }) {
  const { emotions, by_polarity } = matrix;
  const polarities = ['Positive', 'Neutral', 'Negative'];

  // Global max for relative shading
  let maxVal = 0;
  polarities.forEach(p => emotions.forEach(e => { const v = by_polarity[p]?.[e] ?? 0; if (v > maxVal) maxVal = v; }));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-3 py-3 font-semibold text-slate-700 w-24">Polarity</th>
            {emotions.map(e => (
              <th key={e} className="text-center px-2 py-3 font-semibold text-slate-700 capitalize whitespace-nowrap">{e}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {polarities.map((pol, i) => {
            const row = by_polarity[pol] || {};
            return (
              <tr key={pol} className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                <td className="px-3 py-3 font-semibold text-slate-700">{pol}</td>
                {emotions.map(e => {
                  const v = row[e] ?? 0;
                  const intensity = maxVal > 0 ? v / maxVal : 0;
                  const hue = 240 - intensity * 240;
                  return (
                    <td key={e} className="px-2 py-1 text-center">
                      <div
                        className="rounded px-1 py-1.5 text-white font-bold shadow-sm text-[10px]"
                        style={{ backgroundColor: `hsl(${hue}, 75%, 52%)` }}
                        title={`${pol} · ${e}: ${v.toFixed(2)}`}
                      >
                        {v.toFixed(2)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[10px] text-slate-400 mt-2 text-center">Color scale: Cool blue = low intensity → Warm red = high intensity</p>
    </div>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${color} avoid-page-break`}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-1 opacity-70">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function QualityRow({ label, value, status }) {
  const icons = {
    ok:   <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
    warn: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
    bad:  <XCircle className="w-4 h-4 text-red-500 shrink-0" />,
  };
  const rowColors = { ok: 'bg-white', warn: 'bg-amber-50/50', bad: 'bg-red-50/50' };
  return (
    <tr className={`border-b border-slate-100 ${rowColors[status] || 'bg-white'}`}>
      <td className="px-4 py-3 font-medium text-slate-700">{label}</td>
      <td className="px-4 py-3 text-slate-600">{value ?? '—'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {icons[status] || null}
          <span className="text-xs font-semibold text-slate-500">
            {status === 'ok' ? 'Good' : status === 'warn' ? 'Review' : status === 'bad' ? 'Action needed' : ''}
          </span>
        </div>
      </td>
    </tr>
  );
}

function Empty() {
  return <p className="text-sm text-slate-400 italic">No data available for this section.</p>;
}
