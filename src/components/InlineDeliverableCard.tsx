import React, { useState } from 'react';
import {
  FileText,
  Copy,
  Check,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from 'lucide-react';
import { Deliverable } from '../types/h1';
import { MarkdownRenderer } from './MarkdownRenderer';

interface InlineDeliverableCardProps {
  deliverable: Deliverable;
  onReviseDeliverable: (deliverableId: string, instructions: string) => Promise<void>;
}

const CATEGORY_LABELS: Record<string, string> = {
  research_report: 'Research Report',
  project_plan: 'Project Plan',
  decision_report: 'Decision Report',
  task_summary: 'Task Summary',
  checklist: 'Action Checklist',
  implementation_plan: 'Implementation Plan',
  progress_report: 'Progress Report',
};

export const InlineDeliverableCard: React.FC<InlineDeliverableCardProps> = ({
  deliverable,
  onReviseDeliverable,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showReviseInput, setShowReviseInput] = useState(false);
  const [revisionInstructions, setRevisionInstructions] = useState('');
  const [isRevising, setIsRevising] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(deliverable.contentMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback copy
    }
  };

  const handleDownload = (ext: 'md' | 'txt') => {
    const mime = ext === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
    const blob = new Blob([deliverable.contentMarkdown], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = deliverable.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    a.href = url;
    a.download = `${safeName || 'deliverable'}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReviseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionInstructions.trim()) return;
    setIsRevising(true);
    try {
      await onReviseDeliverable(deliverable.id, revisionInstructions.trim());
      setRevisionInstructions('');
      setShowReviseInput(false);
    } finally {
      setIsRevising(false);
    }
  };

  return (
    <div
      data-testid={`deliverable-card-${deliverable.id}`}
      className="my-3.5 rounded-2xl border border-[#E8E3DF] bg-[#FFFFFF] shadow-[0_8px_28px_-8px_rgba(48,44,41,0.06)] overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-[#FAF8F6] border-b border-[#E8E3DF] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#FBEAE2] border border-[#F2B9A0] flex items-center justify-center text-[#302C29] shrink-0">
            <FileText className="w-3.5 h-3.5 text-[#C78A4A]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-[13.5px] font-semibold text-[#302C29] truncate">
                {deliverable.title}
              </h4>
              <span className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-[#F0EFED] text-[#79736E]">
                {CATEGORY_LABELS[deliverable.category] || 'Deliverable'}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-[#EDF5F0] text-[#679779] border border-[#B8D4C2]">
                <ShieldCheck className="w-3 h-3" />
                {deliverable.verificationStatus === 'verified'
                  ? 'Verified by Agent F'
                  : 'Accepted'}
              </span>
            </div>
            {deliverable.verificationNotes && (
              <p className="text-[11.5px] text-[#79736E] truncate mt-0.5">
                {deliverable.verificationNotes}
              </p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFFFFF] hover:bg-[#F0EFED] text-[#302C29] border border-[#E8E3DF] text-[11.5px] font-medium transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-[#679779]" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-[#79736E]" />
                Copy
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleDownload('md')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFFFFF] hover:bg-[#F0EFED] text-[#302C29] border border-[#E8E3DF] text-[11.5px] font-medium transition-colors cursor-pointer"
          >
            <Download className="w-3 h-3 text-[#79736E]" />
            .MD
          </button>

          <button
            type="button"
            onClick={() => handleDownload('txt')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFFFFF] hover:bg-[#F0EFED] text-[#302C29] border border-[#E8E3DF] text-[11.5px] font-medium transition-colors cursor-pointer"
          >
            <Download className="w-3 h-3 text-[#79736E]" />
            .TXT
          </button>

          <button
            type="button"
            onClick={() => setShowReviseInput((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FBEAE2] hover:bg-[#FFD6C2] text-[#302C29] border border-[#F2B9A0] text-[11.5px] font-medium transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3 text-[#C78A4A]" />
            Revise
          </button>

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="p-1.5 rounded-lg text-[#79736E] hover:text-[#302C29] hover:bg-[#F0EFED] transition-colors cursor-pointer"
            title={expanded ? 'Collapse deliverable' : 'Expand deliverable'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Inline Revision Prompt */}
      {showReviseInput && (
        <form
          onSubmit={handleReviseSubmit}
          className="px-4 py-2.5 bg-[#FBEAE2]/50 border-b border-[#E8E3DF] flex items-center gap-2"
        >
          <input
            type="text"
            value={revisionInstructions}
            onChange={(e) => setRevisionInstructions(e.target.value)}
            placeholder="Describe how Agent D & Agent F should revise or expand this deliverable..."
            className="flex-1 px-3 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#E8E3DF] text-[12.5px] text-[#302C29]"
            required
          />
          <button
            type="submit"
            disabled={isRevising}
            className="px-3 py-1.5 rounded-xl bg-[#302C29] text-[#FFFFFF] text-[12px] font-medium cursor-pointer disabled:opacity-50"
          >
            {isRevising ? 'Revising...' : 'Update Deliverable'}
          </button>
        </form>
      )}

      {/* Markdown Body */}
      {expanded && (
        <div className="p-4 bg-[#FFFFFF] max-h-96 overflow-y-auto">
          <MarkdownRenderer content={deliverable.contentMarkdown} />
        </div>
      )}
    </div>
  );
};
