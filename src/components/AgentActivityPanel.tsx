import React from 'react';
import { X, Activity, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { AgentDefinition, AgentRun, RiskAlert } from '../types/h1';

interface AgentActivityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AgentDefinition[];
  agentRuns: AgentRun[];
  riskAlerts: RiskAlert[];
}

export const AgentActivityPanel: React.FC<AgentActivityPanelProps> = ({
  isOpen,
  onClose,
  agents,
  agentRuns,
  riskAlerts,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[#302C29]/15 backdrop-blur-[2px]">
      <div
        data-testid="agent-activity-panel"
        className="w-full max-w-md h-full bg-[#FAF8F6] border-l border-[#E8E3DF] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#FFFFFF] border-b border-[#E8E3DF] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FBEAE2] border border-[#F2B9A0] flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#C78A4A]" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[#302C29]">
                Specialised Agent Activity
              </h3>
              <p className="text-[12px] text-[#79736E]">
                7 coordinated H1-multilevel agents & monitoring checks
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#79736E] hover:text-[#302C29] hover:bg-[#F0EFED] transition-colors cursor-pointer"
            aria-label="Close agent activity panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Monitoring Alerts from Agent G */}
          {riskAlerts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[12px] font-semibold uppercase tracking-wider text-[#79736E]">
                Agent G Monitoring Alerts ({riskAlerts.length})
              </h4>
              {riskAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 rounded-xl bg-[#FDF0EE] border border-[#E8B8B4] text-[12.5px] space-y-1"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-[#C96D65]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{alert.title}</span>
                  </div>
                  <p className="text-[#302C29] text-[12px]">{alert.description}</p>
                  <p className="text-[#79736E] text-[11.5px]">
                    <strong>Suggested Action:</strong> {alert.correctiveAction}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* 7 Specialised Agents Roster */}
          <div className="space-y-2.5">
            <h4 className="text-[12px] font-semibold uppercase tracking-wider text-[#79736E]">
              Active Agent Roster (Agents A–G)
            </h4>
            {agents.map((agent) => {
              const isRunning = agent.status === 'Running';
              const isCompleted = agent.status === 'Completed';
              return (
                <div
                  key={agent.id}
                  className="p-3.5 rounded-2xl bg-[#FFFFFF] border border-[#E8E3DF] shadow-2xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[11.5px] font-semibold text-[#302C29] border border-[#E8E3DF]"
                        style={{ backgroundColor: agent.badgeBg || '#FBEAE2' }}
                      >
                        {agent.code}
                      </span>
                      <div>
                        <div className="text-[13.5px] font-semibold text-[#302C29]">
                          {agent.name}
                        </div>
                        <div className="text-[11.5px] text-[#79736E]">{agent.role}</div>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
                        isRunning
                          ? 'bg-[#FFD6C2] text-[#302C29]'
                          : isCompleted
                          ? 'bg-[#EDF5F0] text-[#679779]'
                          : 'bg-[#F0EFED] text-[#79736E]'
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>

                  {agent.latestOutputSummary && (
                    <div className="pt-1.5 border-t border-[#FAF8F6] text-[12px] text-[#79736E]">
                      <span className="font-medium text-[#302C29]">Latest output: </span>
                      {agent.latestOutputSummary}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Recent Execution Runs */}
          <div className="space-y-2">
            <h4 className="text-[12px] font-semibold uppercase tracking-wider text-[#79736E]">
              Recent Execution Runs ({agentRuns.length})
            </h4>
            {agentRuns.length === 0 ? (
              <p className="text-[12.5px] text-[#A39B95]">
                No agent execution steps recorded in this session yet.
              </p>
            ) : (
              agentRuns.slice(0, 8).map((run) => (
                <div
                  key={run.id}
                  className="p-3 rounded-xl bg-[#FFFFFF] border border-[#E8E3DF] text-[12px] space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#302C29] uppercase text-[11px]">
                      {run.agentId} · Attempt #{run.attempt}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#679779]">
                      <CheckCircle2 className="w-3 h-3" />
                      {run.status}
                    </span>
                  </div>
                  <p className="text-[#79736E] line-clamp-2">{run.outputSummary}</p>
                  <div className="flex items-center gap-1 text-[10.5px] text-[#A39B95]">
                    <Clock className="w-3 h-3" />
                    {new Date(run.completedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
