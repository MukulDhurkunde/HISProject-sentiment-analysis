import { Filter, Search } from 'lucide-react';

const REVIEWS_DATA = [
  { id: 'REV-001', polarity: 'Positive', emotion: 'Joy', text: '<span class="bg-emerald-100 text-emerald-800 px-1 rounded font-medium">Great</span> platform, really helped our team! <span class="bg-emerald-100 text-emerald-800 px-1 rounded font-medium">Fast</span> and <span class="bg-emerald-100 text-emerald-800 px-1 rounded font-medium">reliable</span>.' },
  { id: 'REV-002', polarity: 'Negative', emotion: 'Anger', text: 'The UI is a bit <span class="bg-rose-100 text-rose-800 px-1 rounded font-medium">clunky</span> on mobile devices. Very <span class="bg-rose-100 text-rose-800 px-1 rounded font-medium">slow</span> loading.' },
  { id: 'REV-003', polarity: 'Positive', emotion: 'Joy', text: 'Absolutely <span class="bg-emerald-100 text-emerald-800 px-1 rounded font-medium">love</span> the new analytics features! <span class="bg-emerald-100 text-emerald-800 px-1 rounded font-medium">Best</span> update ever.' },
  { id: 'REV-004', polarity: 'Negative', emotion: 'Fear', text: 'I keep getting logged out <span class="bg-rose-100 text-rose-800 px-1 rounded font-medium">randomly</span>. My work goes <span class="bg-rose-100 text-rose-800 px-1 rounded font-medium">missing</span>.' },
  { id: 'REV-005', polarity: 'Positive', emotion: 'Trust', text: 'Customer support was very <span class="bg-emerald-100 text-emerald-800 px-1 rounded font-medium">helpful</span> resolving my issue.' },
  { id: 'REV-006', polarity: 'Negative', emotion: 'Sadness', text: 'Pricing is a bit <span class="bg-rose-100 text-rose-800 px-1 rounded font-medium">steep</span> for small businesses. Too <span class="bg-rose-100 text-rose-800 px-1 rounded font-medium">expensive</span>.' },
  { id: 'REV-007', polarity: 'Neutral', emotion: 'None', text: 'It works okay. Standard features, nothing too special.' },
  { id: 'REV-008', polarity: 'Negative', emotion: 'Anger', text: '<span class="bg-rose-100 text-rose-800 px-1 rounded font-medium">Missing</span> some key integration options. <span class="bg-rose-100 text-rose-800 px-1 rounded font-medium">Broke</span> my workflow.' },
  { id: 'REV-009', polarity: 'Positive', emotion: 'Trust', text: 'Excellent service, <span class="bg-emerald-100 text-emerald-800 px-1 rounded font-medium">reliable</span> and <span class="bg-emerald-100 text-emerald-800 px-1 rounded font-medium">best</span> performance I have seen.' },
  { id: 'REV-010', polarity: 'Negative', emotion: 'Sadness', text: '<span class="bg-rose-100 text-rose-800 px-1 rounded font-medium">Worst</span> experience. Customer service was <span class="bg-rose-100 text-rose-800 px-1 rounded font-medium">bad</span> and <span class="bg-rose-100 text-rose-800 px-1 rounded font-medium">unhelpful</span>.' }
];

export function ReviewExplorer({ selectedSentiment }) {
  // Filter based on donut chart selection if needed
  const displayData = selectedSentiment 
    ? REVIEWS_DATA.filter(r => r.polarity === selectedSentiment)
    : REVIEWS_DATA;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Review Explorer
          </h3>
          <p className="text-xs text-slate-500 mt-1">Explore raw texts with sentiment keyword highlighting</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search reviews..." 
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full md:w-64"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">Review ID</th>
              <th className="px-6 py-4">Polarity</th>
              <th className="px-6 py-4">Primary Emotion</th>
              <th className="px-6 py-4">Source Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayData.map((review) => (
              <tr key={review.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-600">{review.id}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${
                    review.polarity === 'Positive' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    review.polarity === 'Negative' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                    'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    {review.polarity}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-600">{review.emotion}</td>
                <td className="px-6 py-4 text-slate-800">
                  <div dangerouslySetInnerHTML={{ __html: review.text }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
