import React, { useState } from 'react';
import {
  CheckCircle2,
  Play,
  Pause,
  XCircle,
  Edit3,
  Plus,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Check,
  Unlock,
} from 'lucide-react';
import { AgentDefinition, AgentId, PriorityLevel, Task, Workflow } from '../types/h1';
import { calculateCriticalPath, canAddDependency, getEligibleTasks } from '../core/orchestrator';

interface InlineWorkflowCardProps {
  workflow: Workflow;
  tasks: Task[];
  agents: AgentDefinition[];
  isExecuting: boolean;
  onApprovePlan: (workflowId: string, autoRunAll?: boolean) => Promise<void>;
  onRejectPlan: (workflowId: string, reason?: string) => Promise<void>;
  onExecuteNextStep: (workflowId: string) => Promise<void>;
  onWorkflowControl: (
    workflowId: string,
    action: 'pause' | 'resume' | 'cancel' | 'retry_failed' | 'approve_gates'
  ) => Promise<void>;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onCreateTask: (taskPayload: {
    workflowId: string;
    title: string;
    description: string;
    assignedAgent: AgentId;
    priority: PriorityLevel;
    dependencies: string[];
    acceptanceCriteria: string;
    estimatedEffortHours: number;
  }) => Promise<void>;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  awaiting_approval: {
    bg: '#FBEAE2',
    text: '#C78A4A',
    border: '#F2B9A0',
    label: 'Awaiting Approval',
  },
  running: {
    bg: '#FFD6C2',
    text: '#302C29',
    border: '#F2B9A0',
    label: 'Running',
  },
  paused: {
    bg: '#F0EFED',
    text: '#79736E',
    border: '#E8E3DF',
    label: 'Paused',
  },
  completed: {
    bg: '#EDF5F0',
    text: '#679779',
    border: '#B8D4C2',
    label: 'Completed',
  },
  failed: {
    bg: '#FDF0EE',
    text: '#C96D65',
    border: '#E8B8B4',
    label: 'Needs Attention',
  },
  cancelled: {
    bg: '#F0EFED',
    text: '#A39B95',
    border: '#E8E3DF',
    label: 'Cancelled',
  },
  draft: {
    bg: '#FAF8F6',
    text: '#79736E',
    border: '#E8E3DF',
    label: 'Draft',
  },
};

const TASK_STATUS_DOT: Record<string, string> = {
  Completed: '#679779',
  Running: '#C78A4A',
  'Waiting for Approval': '#C78A4A',
  Failed: '#C96D65',
  Blocked: '#C96D65',
  Queued: '#A39B95',
  Idle: '#A39B95',
  Cancelled: '#A39B95',
};

export const InlineWorkflowCard: React.FC<InlineWorkflowCardProps> = ({
  workflow,
  tasks,
  agents,
  isExecuting,
  onApprovePlan,
  onRejectPlan,
  onExecuteNextStep,
  onWorkflowControl,
  onUpdateTask,
  onCreateTask,
}) => {
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [cycleError, setCycleError] = useState<string | null>(null);

  // Add task form state inside Edit Plan mode
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskAgent, setNewTaskAgent] = useState<AgentId>('execution');
  const [newTaskPriority, setNewTaskPriority] = useState<PriorityLevel>('high');
  const [newTaskEffort, setNewTaskEffort] = useState<number>(3);
  const [newTaskDeps, setNewTaskDeps] = useState<string[]>([]);

  const wfTasks = tasks.filter((t) => t.workflowId === workflow.id);
  const criticalPath = calculateCriticalPath(wfTasks);
  const eligibleTasks = getEligibleTasks(wfTasks);
  const statusStyle = STATUS_STYLES[workflow.status] || STATUS_STYLES.draft;

  const hasWaitingApprovalTask = wfTasks.some((t) => t.status === 'Waiting for Approval');
  const hasFailedTask = wfTasks.some((t) => t.status === 'Failed');
  const completedCount = wfTasks.filter((t) => t.status === 'Completed').length;

  const getAgentBadge = (agentId: AgentId) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return { code: 'A', name: agentId, bg: '#FBEAE2' };
    return {
      code: agent.code,
      name: agent.shortName,
      bg: agent.badgeBg || '#FBEAE2',
    };
  };

  const handleToggleDependency = async (task: Task, depId: string) => {
    setCycleError(null);
    const exists = task.dependencies.includes(depId);
    if (exists) {
      await onUpdateTask(task.id, {
        dependencies: task.dependencies.filter((d) => d !== depId),
      });
    } else {
      const check = canAddDependency(wfTasks, task.id, depId);
      if (!check.allowed) {
        setCycleError(check.reason || 'Circular dependency detected.');
        return;
      }
      await onUpdateTask(task.id, {
        dependencies: [...task.dependencies, depId],
      });
    }
  };

  const handleAddNewTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    await onCreateTask({
      workflowId: workflow.id,
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim() || newTaskTitle.trim(),
      assignedAgent: newTaskAgent,
      priority: newTaskPriority,
      dependencies: newTaskDeps,
      acceptanceCriteria: 'Verified output with concrete actionable steps.',
      estimatedEffortHours: Number(newTaskEffort) || 2,
    });
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskDeps([]);
    setShowAddTask(false);
  };

  return (
    <div
      data-testid={`workflow-card-${workflow.id}`}
      className="my-3.5 rounded-2xl border border-[#E8E3DF] bg-[#FFFFFF] shadow-[0_8px_28px_-8px_rgba(48,44,41,0.06)] overflow-hidden transition-all"
    >
      {/* Card Header */}
      <div className="px-4 py-3.5 bg-[#FAF8F6] border-b border-[#E8E3DF] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-[#FFD6C2] text-[#302C29] text-xs font-semibold shrink-0">
            A
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-[14px] font-semibold text-[#302C29] truncate">
                {workflow.title}
              </h4>
              <span
                className="px-2 py-0.5 rounded-md text-[11px] font-medium border shrink-0"
                style={{
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.text,
                  borderColor: statusStyle.border,
                }}
              >
                {statusStyle.label}
              </span>
            </div>
            <p className="text-[12px] text-[#79736E] truncate mt-0.5">{workflow.shortPlan}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right mr-1">
            <span className="text-[11px] font-medium text-[#79736E]">
              {completedCount}/{wfTasks.length} steps ({workflow.progress}%)
            </span>
            <div className="w-24 h-1.5 bg-[#F0EFED] rounded-full overflow-hidden mt-0.5">
              <div
                className="h-full bg-[#679779] transition-all duration-300"
                style={{ width: `${workflow.progress}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsDetailsExpanded((prev) => !prev)}
            className="p-1.5 rounded-lg text-[#79736E] hover:text-[#302C29] hover:bg-[#F0EFED] transition-colors"
            title={isDetailsExpanded ? 'Collapse workflow plan' : 'Expand workflow plan'}
          >
            {isDetailsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Primary Approval Banner when awaiting_approval */}
      {workflow.status === 'awaiting_approval' && (
        <div className="px-4 py-3 bg-[#FBEAE2]/70 border-b border-[#E8E3DF] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[12.5px] text-[#302C29]">
            <Sparkles className="w-4 h-4 text-[#C78A4A] shrink-0" />
            <span>
              <strong>Manager Plan Ready:</strong> Review the {wfTasks.length} coordinated agent tasks before execution.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid={`approve-plan-${workflow.id}`}
              disabled={isExecuting}
              onClick={() => onApprovePlan(workflow.id, true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#302C29] hover:bg-[#302C29]/90 text-[#FFFFFF] text-[12.5px] font-medium shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {isExecuting ? 'Coordinating Agents...' : 'Approve & Execute Plan'}
            </button>
            <button
              type="button"
              data-testid={`edit-plan-${workflow.id}`}
              onClick={() => setIsEditingPlan((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFFFFF] hover:bg-[#F0EFED] text-[#302C29] border border-[#E8E3DF] text-[12.5px] font-medium transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isEditingPlan ? 'Done Editing' : 'Edit Plan'}
            </button>
            <button
              type="button"
              data-testid={`reject-plan-${workflow.id}`}
              disabled={isExecuting}
              onClick={() => onRejectPlan(workflow.id, 'User requested changes before execution.')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FDF0EE] text-[#C96D65] border border-[#E8E3DF] text-[12.5px] font-medium transition-colors cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              Reject Plan
            </button>
          </div>
        </div>
      )}

      {/* Active Lifecycle Toolbar when running, paused, or failed */}
      {workflow.status !== 'awaiting_approval' && workflow.status !== 'cancelled' && (
        <div className="px-4 py-2.5 bg-[#FAF8F6]/60 border-b border-[#E8E3DF] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-[12px] text-[#79736E]">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#C78A4A]" />
              Critical path: <strong>{criticalPath.totalDurationHours}h est.</strong> (Estimate)
            </span>
            {workflow.deadline && (
              <span>Deadline: {new Date(workflow.deadline).toLocaleDateString()}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {workflow.status === 'running' && eligibleTasks.eligible.length > 0 && (
              <button
                type="button"
                disabled={isExecuting}
                onClick={() => onExecuteNextStep(workflow.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFD6C2] hover:bg-[#F2B9A0] text-[#302C29] text-[12px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-3 h-3" />
                {isExecuting ? 'Running Step...' : 'Run Next Step'}
              </button>
            )}

            {hasWaitingApprovalTask && (
              <button
                type="button"
                disabled={isExecuting}
                onClick={() => onWorkflowControl(workflow.id, 'approve_gates')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FBEAE2] hover:bg-[#FFD6C2] text-[#302C29] border border-[#F2B9A0] text-[12px] font-medium transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#C78A4A]" />
                Approve Pending Step
              </button>
            )}

            {hasFailedTask && (
              <button
                type="button"
                disabled={isExecuting}
                onClick={() => onWorkflowControl(workflow.id, 'retry_failed')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FDF0EE] hover:bg-[#FBEAE2] text-[#C96D65] border border-[#E8B8B4] text-[12px] font-medium transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Retry Failed
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsEditingPlan((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFFFFF] hover:bg-[#F0EFED] text-[#79736E] hover:text-[#302C29] border border-[#E8E3DF] text-[12px] transition-colors cursor-pointer"
            >
              <Edit3 className="w-3 h-3" />
              {isEditingPlan ? 'Done Editing' : 'Edit Tasks'}
            </button>

            {workflow.status === 'running' && (
              <button
                type="button"
                onClick={() => onWorkflowControl(workflow.id, 'pause')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFFFFF] hover:bg-[#F0EFED] text-[#79736E] border border-[#E8E3DF] text-[12px] transition-colors cursor-pointer"
              >
                <Pause className="w-3 h-3" />
                Pause
              </button>
            )}

            {workflow.status === 'paused' && (
              <button
                type="button"
                onClick={() => onWorkflowControl(workflow.id, 'resume')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFD6C2] hover:bg-[#F2B9A0] text-[#302C29] text-[12px] font-medium transition-colors cursor-pointer"
              >
                <Play className="w-3 h-3" />
                Resume
              </button>
            )}

            {workflow.status !== 'completed' && (
              <button
                type="button"
                onClick={() => onWorkflowControl(workflow.id, 'cancel')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[#A39B95] hover:text-[#C96D65] text-[12px] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Cycle validation alert */}
      {cycleError && (
        <div className="px-4 py-2 bg-[#FDF0EE] border-b border-[#E8B8B4] flex items-center justify-between text-[12px] text-[#C96D65]">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {cycleError}
          </span>
          <button
            type="button"
            onClick={() => setCycleError(null)}
            className="text-[11px] underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Expandable Task List */}
      {isDetailsExpanded && (
        <div className="divide-y divide-[#E8E3DF]">
          {wfTasks.map((task, index) => {
            const badge = getAgentBadge(task.assignedAgent);
            const isCritical = criticalPath.criticalTaskIds.includes(task.id);
            const isExpanded = expandedTaskId === task.id;
            const depTitles = task.dependencies
              .map((depId) => wfTasks.find((t) => t.id === depId)?.title || depId)
              .join(', ');

            return (
              <div
                key={task.id}
                className={`px-4 py-3 transition-colors ${
                  task.status === 'Running' ? 'bg-[#FBEAE2]/40' : 'hover:bg-[#FAF8F6]/70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <span
                      className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: TASK_STATUS_DOT[task.status] || '#A39B95' }}
                      title={`Status: ${task.status}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-mono text-[#A39B95]">
                          {index + 1}.
                        </span>
                        <span className="text-[13.5px] font-medium text-[#302C29]">
                          {task.title}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded-md text-[11px] font-medium text-[#302C29] border border-[#E8E3DF]"
                          style={{ backgroundColor: badge.bg }}
                        >
                          Agent {badge.code} · {badge.name}
                        </span>
                        <span className="text-[11px] text-[#79736E] px-1.5 py-0.5 rounded bg-[#F0EFED]">
                          {task.priority}
                        </span>
                        <span
                          className="text-[11px] text-[#79736E]"
                          title={task.effortAssumption || 'Model-estimated effort'}
                        >
                          ~{task.estimatedEffortHours}h est.
                        </span>
                        {isCritical && (
                          <span className="text-[10.5px] font-medium text-[#C78A4A] bg-[#FBEAE2] px-1.5 py-0.5 rounded">
                            Critical Path
                          </span>
                        )}
                      </div>

                      <p className="text-[12.5px] text-[#79736E] mt-1 leading-relaxed">
                        {task.description}
                      </p>

                      {task.dependencies.length > 0 && (
                        <div className="text-[11.5px] text-[#A39B95] mt-1">
                          Depends on: <span className="text-[#79736E]">{depTitles}</span>
                          {task.waivedDependencies && (
                            <span className="ml-1.5 text-[#C78A4A]">(Dependencies waived)</span>
                          )}
                        </div>
                      )}

                      {/* Inline Edit Controls when Edit Plan is active */}
                      {isEditingPlan && (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-[#FAF8F6] border border-[#E8E3DF] space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="text-[11px] text-[#79736E] flex items-center gap-1">
                              Agent:
                              <select
                                value={task.assignedAgent}
                                onChange={(e) =>
                                  onUpdateTask(task.id, { assignedAgent: e.target.value as AgentId })
                                }
                                className="px-2 py-1 rounded-lg bg-[#FFFFFF] border border-[#E8E3DF] text-[11.5px] text-[#302C29]"
                              >
                                {agents.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    Agent {a.code} ({a.shortName})
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="text-[11px] text-[#79736E] flex items-center gap-1">
                              Priority:
                              <select
                                value={task.priority}
                                onChange={(e) =>
                                  onUpdateTask(task.id, { priority: e.target.value as PriorityLevel })
                                }
                                className="px-2 py-1 rounded-lg bg-[#FFFFFF] border border-[#E8E3DF] text-[11.5px] text-[#302C29]"
                              >
                                <option value="low">low</option>
                                <option value="medium">medium</option>
                                <option value="high">high</option>
                                <option value="critical">critical</option>
                              </select>
                            </label>

                            <label className="text-[11px] text-[#79736E] flex items-center gap-1">
                              Est. Hours:
                              <input
                                type="number"
                                min={0.5}
                                step={0.5}
                                value={task.estimatedEffortHours}
                                onChange={(e) =>
                                  onUpdateTask(task.id, {
                                    estimatedEffortHours: Math.max(0.5, Number(e.target.value) || 1),
                                  })
                                }
                                className="w-16 px-2 py-1 rounded-lg bg-[#FFFFFF] border border-[#E8E3DF] text-[11.5px] text-[#302C29]"
                              />
                            </label>
                          </div>

                          {/* Dependency toggles */}
                          {wfTasks.length > 1 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-[11px] text-[#79736E]">Prerequisites:</span>
                              {wfTasks
                                .filter((other) => other.id !== task.id)
                                .map((other) => {
                                  const active = task.dependencies.includes(other.id);
                                  return (
                                    <button
                                      key={other.id}
                                      type="button"
                                      onClick={() => handleToggleDependency(task, other.id)}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border transition-colors cursor-pointer ${
                                        active
                                          ? 'bg-[#FFD6C2] border-[#F2B9A0] text-[#302C29] font-medium'
                                          : 'bg-[#FFFFFF] border-[#E8E3DF] text-[#79736E]'
                                      }`}
                                    >
                                      {active ? <Check className="w-3 h-3 shrink-0" /> : <Plus className="w-3 h-3 shrink-0" />}
                                      <span>{other.title.slice(0, 26)}</span>
                                    </button>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expandable Task Output / Verification details */}
                      {isExpanded && (
                        <div className="mt-2.5 p-3 rounded-xl bg-[#FAF8F6] border border-[#E8E3DF] text-[12px] space-y-1.5">
                          <div>
                            <span className="font-semibold text-[#302C29]">Acceptance Criteria: </span>
                            <span className="text-[#79736E]">{task.acceptanceCriteria}</span>
                          </div>
                          {task.output && (
                            <div>
                              <span className="font-semibold text-[#302C29]">Latest Agent Output: </span>
                              <p className="text-[#302C29] mt-0.5 whitespace-pre-wrap">{task.output}</p>
                            </div>
                          )}
                          {task.error && (
                            <div className="text-[#C96D65]">
                              <span className="font-semibold">Error: </span>
                              {task.error}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {task.status !== 'Completed' && (
                              <button
                                type="button"
                                onClick={() => onUpdateTask(task.id, { status: 'Completed' })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FFFFFF] hover:bg-[#EDF5F0] text-[#679779] border border-[#E8E3DF] text-[11px] font-medium cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                Mark Complete
                              </button>
                            )}
                            {task.dependencies.length > 0 && !task.waivedDependencies && task.status !== 'Completed' && (
                              <button
                                type="button"
                                onClick={() => onUpdateTask(task.id, { waivedDependencies: true, status: 'Queued' })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FFFFFF] hover:bg-[#FBEAE2] text-[#C78A4A] border border-[#E8E3DF] text-[11px] font-medium cursor-pointer"
                              >
                                <Unlock className="w-3 h-3" />
                                Waive Dependencies
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side task status & disclosure button */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11.5px] font-medium text-[#79736E]">{task.status}</span>
                    {task.status === 'Waiting for Approval' && (
                      <button
                        type="button"
                        onClick={() => onUpdateTask(task.id, { status: 'Queued', approvalRequired: false })}
                        className="px-2 py-0.5 rounded-lg bg-[#FFD6C2] hover:bg-[#F2B9A0] text-[#302C29] text-[11px] font-medium cursor-pointer"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                      className="text-[11px] text-[#79736E] hover:text-[#302C29] underline cursor-pointer"
                    >
                      {isExpanded ? 'Hide' : 'Details'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add Task button inside Edit Plan mode */}
          {isEditingPlan && (
            <div className="px-4 py-3 bg-[#FAF8F6]">
              {!showAddTask ? (
                <button
                  type="button"
                  onClick={() => setShowAddTask(true)}
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#302C29] hover:text-[#C78A4A] cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add Task to Plan
                </button>
              ) : (
                <form onSubmit={handleAddNewTask} className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Task title..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#E8E3DF] text-[12.5px] text-[#302C29]"
                      required
                    />
                    <select
                      value={newTaskAgent}
                      onChange={(e) => setNewTaskAgent(e.target.value as AgentId)}
                      className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#E8E3DF] text-[12.5px] text-[#302C29]"
                    >
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          Agent {a.code} — {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="Brief description & deliverables..."
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#E8E3DF] text-[12.5px] text-[#302C29]"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-[#302C29] text-[#FFFFFF] text-[12px] font-medium cursor-pointer"
                    >
                      Save Task
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddTask(false)}
                      className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#E8E3DF] text-[12px] text-[#79736E] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
