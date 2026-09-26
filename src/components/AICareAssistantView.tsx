import React, { useState } from 'react';
import { Sparkles, Send, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';
import { toFriendlyErrorMessage } from '../lib/friendlyErrors.ts';

interface AICareAssistantViewProps {
  authToken: string;
  patients: any[];
  encounters: any[];
  followUps: any[];
  alerts: any[];
  onNavigate: (tab: string) => void;
}

interface AssistantExchange {
  id: string;
  question: string;
  answer: string;
  keyPoints: string[];
  suggestedFollowUpQuestion: string;
  timestamp: string;
}

const STARTER_PROMPTS = [
  'Summarize our current clinic patients, recent visits, and any pending follow-ups.',
  'What vital sign checks should I prioritize during a maternal antenatal visit?',
  'How should we organize home follow-up visits for patients with high fever or elevated blood pressure?',
  'Give me a quick checklist for registering a new child patient and scheduling immunizations.',
];

export const AICareAssistantView: React.FC<AICareAssistantViewProps> = ({
  authToken,
  patients,
  encounters,
  followUps,
  alerts,
  onNavigate,
}) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AssistantExchange[]>([]);

  const handleAsk = async (promptText?: string) => {
    const query = (promptText ?? question).trim();
    if (!query || loading) return;

    setLoading(true);
    setError(null);
    if (!promptText) {
      setQuestion('');
    }

    try {
      const liveContext = {
        totalPatients: patients.length,
        recentPatients: patients.slice(0, 8).map((p) => ({
          patientId: p.patientId,
          fullName: p.fullName,
          sex: p.sex,
          dateOfBirth: p.dateOfBirth,
          community: p.community,
        })),
        totalVisits: encounters.length,
        recentVisits: encounters.slice(0, 8).map((e) => ({
          encounterCode: e.encounterCode,
          patientName: e.patientName,
          encounterType: e.encounterType,
          encounterDate: e.encounterDate,
          temperature: e.temperature,
          bloodPressure: e.bloodPressure,
          reasonForVisit: e.reasonForVisit,
        })),
        openFollowUpsCount: followUps.filter((f) => f.status !== 'Completed').length,
        openAlertsCount: alerts.filter((a) => a.status === 'Open').length,
      };

      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ question: query, liveContext }),
      });

      const data = await res.json();
      if (!res.ok || !data.reply) {
        throw new Error(data.error || 'AI request failed');
      }

      const newEntry: AssistantExchange = {
        id: `ai-${Date.now()}`,
        question: query,
        answer: data.reply.answer || 'Here is the guidance based on your live clinic records.',
        keyPoints: Array.isArray(data.reply.keyPoints) ? data.reply.keyPoints : [],
        suggestedFollowUpQuestion: data.reply.suggestedFollowUpQuestion || '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setHistory((prev) => [newEntry, ...prev]);
    } catch (err) {
      setError(toFriendlyErrorMessage(err, 'ai'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="text-xs font-semibold text-teal-700">
            AI Care &amp; Clinic Assistant · Connected to Live Clinic Data
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Smart Care &amp; Workflow Assistant
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Ask questions about your live patients ({patients.length}), recorded visits (
            {encounters.length}), follow-up schedules, or community care guidelines.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('new-encounter')}
            className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            + Record Visit with AI
          </button>
          <button
            type="button"
            onClick={() => onNavigate('intelligence')}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            View AI Clinic Brief
          </button>
        </div>
      </div>

      {/* Prompt Input Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything about your patients, visits, follow-ups, or care checklists..."
            className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
                <span>Thinking...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4 text-teal-400" />
                <span>Ask AI Assistant</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Starter Prompts */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-500">
            Suggested Questions (Click to Ask):
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {STARTER_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                disabled={loading}
                onClick={() => handleAsk(prompt)}
                className="text-left p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50/60 hover:border-teal-600/40 text-xs text-slate-700 transition-colors flex items-center justify-between gap-2"
              >
                <span className="line-clamp-1">{prompt}</span>
                <ArrowRight className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900">
            {error}
          </div>
        )}
      </div>

      {/* Responses List or Friendly Empty State */}
      {history.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center mx-auto">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-sm font-bold text-slate-900">
              Your AI Care &amp; Clinic Assistant is Ready
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Select any suggested question above or type your own question to get clear,
              plain-language insights grounded in your live clinic records.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 animate-fade-in"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="text-xs sm:text-sm font-bold text-slate-900">
                  “{item.question}”
                </div>
                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                  {item.timestamp}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{item.answer}</p>

              {item.keyPoints.length > 0 && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 space-y-2">
                  <div className="text-xs font-bold text-slate-900">Key Action Points</div>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {item.keyPoints.map((pt, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {item.suggestedFollowUpQuestion && (
                <div className="pt-1 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleAsk(item.suggestedFollowUpQuestion)}
                    className="text-xs font-semibold text-teal-700 hover:underline flex items-center gap-1.5"
                  >
                    <span>Ask next: “{item.suggestedFollowUpQuestion}”</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
