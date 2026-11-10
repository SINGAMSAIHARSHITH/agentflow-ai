import React, { useState } from 'react';
import { Sliders, AlertCircle, RotateCcw, Sparkles } from 'lucide-react';
import { DecisionCriterion, DecisionRecord } from '../types/h1';
import { calculateDecisionScores } from '../core/orchestrator';

interface InlineDecisionCardProps {
  decision: DecisionRecord;
  onUpdateDecision: (decisionId: string, updates: Partial<DecisionRecord>) => Promise<void>;
}

export const InlineDecisionCard: React.FC<InlineDecisionCardProps> = ({
  decision,
  onUpdateDecision,
}) => {
  const [localCriteria, setLocalCriteria] = useState<DecisionCriterion[]>(decision.criteria);
  const [showSliders, setShowSliders] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const scoreResult = calculateDecisionScores(localCriteria, decision.alternatives);
  const topChoiceName = scoreResult.topRecommendation || decision.recommendedOption;

  const handleWeightChange = (criterionId: string, weight: number) => {
    setLocalCriteria((prev) =>
      prev.map((c) => (c.id === criterionId ? { ...c, weight } : c))
    );
  };

  const handleSaveWeights = async () => {
    setIsSaving(true);
    try {
      await onUpdateDecision(decision.id, {
        criteria: localCriteria,
        recommendedOption: topChoiceName,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      data-testid={`decision-card-${decision.id}`}
      className="my-3.5 rounded-2xl border border-[#E8E3DF] bg-[#FFFFFF] shadow-[0_8px_28px_-8px_rgba(48,44,41,0.06)] overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3.5 bg-[#FAF8F6] border-b border-[#E8E3DF] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-[#FFD6C2] text-[#302C29] text-xs font-semibold">
            E
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-[14px] font-semibold text-[#302C29]">{decision.question}</h4>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#FBEAE2] text-[#C78A4A] border border-[#F2B9A0]">
                {decision.isEstimated ? 'Model-Generated Estimates' : 'Verified Grounded Data'}
              </span>
            </div>
            <p className="text-[12px] text-[#79736E] mt-0.5">
              Budget: {decision.budget} · Timeframe: {decision.timeframe} · Risk Tolerance:{' '}
              <span className="capitalize">{decision.riskTolerance}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowSliders((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFFFFF] hover:bg-[#F0EFED] text-[#302C29] border border-[#E8E3DF] text-[12px] font-medium transition-colors cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5 text-[#C78A4A]" />
          {showSliders ? 'Hide Criteria Weights' : 'Adjust Criteria Weights'}
        </button>
      </div>

      {/* Interactive Criteria Sliders */}
      {showSliders && (
        <div className="px-4 py-3.5 bg-[#FAF8F6]/70 border-b border-[#E8E3DF] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#302C29]">
              Weighted Decision Criteria (Adjust sliders to recalculate rankings in real time)
            </span>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveWeights}
              className="px-3 py-1 rounded-lg bg-[#302C29] text-[#FFFFFF] text-[11.5px] font-medium cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Weights'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {localCriteria.map((criterion) => (
              <div
                key={criterion.id}
                className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#E8E3DF]"
              >
                <div className="flex items-center justify-between text-[12px] mb-1">
                  <span className="font-medium text-[#302C29]">{criterion.name}</span>
                  <span className="font-mono text-[#C78A4A] font-semibold">
                    Weight: {criterion.weight}
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={criterion.weight}
                  onChange={(e) => handleWeightChange(criterion.id, Number(e.target.value))}
                  className="w-full accent-[#C78A4A] cursor-pointer"
                />
                <p className="text-[11px] text-[#79736E] mt-0.5">{criterion.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ranked Alternatives */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {scoreResult.rankedAlternatives.map((item, idx) => {
            const alt = item.alternative;
            const rank = idx + 1;
            const isWinner = rank === 1;

            return (
              <div
                key={alt.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isWinner
                    ? 'bg-[#FBEAE2]/45 border-[#F2B9A0] shadow-xs'
                    : 'bg-[#FAF8F6]/60 border-[#E8E3DF]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#79736E]">
                      Rank #{rank} {isWinner ? '· Recommended' : ''}
                    </span>
                    <h5 className="text-[13.5px] font-semibold text-[#302C29] mt-0.5">
                      {alt.name}
                    </h5>
                  </div>
                  <div className="px-2 py-1 rounded-lg bg-[#FFFFFF] border border-[#E8E3DF] text-right shrink-0">
                    <div className="text-[13px] font-bold text-[#302C29]">
                      {item.weightedScore.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-[#79736E]">/ 100</div>
                  </div>
                </div>

                <p className="text-[12px] text-[#79736E] mt-1.5">{alt.description}</p>
                <div className="text-[11.5px] font-medium text-[#302C29] mt-2">
                  Est. Cost: <span className="text-[#79736E] font-normal">{alt.estimatedCost}</span>
                </div>

                <div className="mt-2.5 space-y-1.5 text-[11.5px]">
                  <div>
                    <span className="font-semibold text-[#679779]">Pros: </span>
                    <span className="text-[#302C29]">{alt.pros.join(' · ')}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#C78A4A]">Cons: </span>
                    <span className="text-[#79736E]">{alt.cons.join(' · ')}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#C96D65]">Risks: </span>
                    <span className="text-[#79736E]">{alt.risks.join(' · ')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recommendation, Sensitivity, Uncertainty, and Reversal Conditions */}
        <div className="p-3.5 rounded-xl bg-[#FAF8F6] border border-[#E8E3DF] space-y-2 text-[12.5px]">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-[#C78A4A] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#302C29]">
                Recommended Option ({topChoiceName}):{' '}
              </span>
              <span className="text-[#302C29]">{decision.rationale}</span>
              <div className="text-[11.5px] text-[#79736E] mt-0.5">
                {scoreResult.sensitivityNote}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 text-[12px] text-[#79736E]">
            <AlertCircle className="w-3.5 h-3.5 text-[#C78A4A] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#302C29]">Assumptions & Uncertainty: </strong>
              {decision.assumptionsAndUncertainty}
            </div>
          </div>
          <div className="flex items-start gap-2 text-[12px] text-[#79736E]">
            <RotateCcw className="w-3.5 h-3.5 text-[#79736E] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#302C29]">Reversal Conditions: </strong>
              {decision.reversalConditions}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
