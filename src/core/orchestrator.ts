import {
  AgentId,
  DecisionAlternative,
  DecisionCriterion,
  GoalValidationResult,
  PriorityLevel,
  RiskAlert,
  Task,
  Workflow,
} from '../types/h1';
import {
  AGENT_PROMPTS,
  HOME_SUGGESTION_CARDS,
  INITIAL_AGENTS,
  PEACH_LIGHT_PALETTE,
} from './agents';

export {
  AGENT_PROMPTS,
  HOME_SUGGESTION_CARDS,
  INITIAL_AGENTS,
  PEACH_LIGHT_PALETTE,
};

export type ConversationIntent =
  | 'workflow_plan'
  | 'decision_analysis'
  | 'clarification_needed'
  | 'direct_chat';

export interface ClassifiedPrompt {
  intent: ConversationIntent;
  suggestedTitle: string;
  participatingAgents: AgentId[];
  clarificationQuestions: string[];
  extractedPriority: PriorityLevel;
  extractedBudget: string;
  extractedDeadlineDays: number;
}

/**
 * Pure classifier that inspects a user's natural-language message to determine
 * how the Manager/Orchestrator should route it across the 7 specialized agents.
 */
export function classifyConversationPrompt(rawText: string): ClassifiedPrompt {
  const text = (rawText || '').trim();
  const lower = text.toLowerCase();

  const words = text.split(/\s+/).filter(Boolean);
  const rawShort =
    text
      .replace(/^(plan|research|analyse|analyze|organise|organize|help me|please)\s+/i, '')
      .split(/[.?!;\n]/)[0]
      .trim()
      .slice(0, 72) || 'New Multi-Agent Goal';
  const shortTitle = rawShort.charAt(0).toUpperCase() + rawShort.slice(1);

  // Detect budget if mentioned
  const budgetMatch = text.match(/\$[0-9,]+(\s*\/?\s*(mo|month|k|credit|budget|limit))?/i);
  const extractedBudget = budgetMatch ? budgetMatch[0] : 'Standard workspace allocation';

  // Detect deadline days if mentioned
  const daysMatch = text.match(/(\d+)\s*[- ]?\s*(day|week|month)/i);
  let extractedDeadlineDays = 7;
  if (daysMatch) {
    const num = parseInt(daysMatch[1], 10) || 7;
    const unit = daysMatch[2].toLowerCase();
    extractedDeadlineDays = unit.startsWith('week')
      ? num * 7
      : unit.startsWith('month')
      ? num * 30
      : num;
  }

  let extractedPriority: PriorityLevel = 'high';
  if (/\b(critical|urgent|immediate|zero-downtime|sla)\b/i.test(text)) {
    extractedPriority = 'critical';
  } else if (/\b(low priority|whenever|optional)\b/i.test(text)) {
    extractedPriority = 'low';
  }

  // Check if the user wrote a very short/underspecified goal that needs clarification
  const isGoalKeyword =
    /\b(plan|project|launch|build|migrate|organise|organize|schedule|workflow|execute|roadmap|research|report)\b/i.test(
      lower
    );
  const isDecisionKeyword =
    /\b(analyse a decision|analyze a decision|compare|should we|which option|trade-off|tradeoff|versus|\bvs\.?\b|choose between|decision matrix)\b/i.test(
      lower
    );

  if (isGoalKeyword && words.length < 6) {
    return {
      intent: 'clarification_needed',
      suggestedTitle: shortTitle,
      participatingAgents: ['orchestrator', 'strategy'],
      clarificationQuestions: [
        'What is your target deadline or timeframe for completing this goal?',
        'Are there specific budget limits, technical constraints, or team resources the agents should respect?',
        'What concrete deliverables (e.g., research report, project plan, decision matrix, or checklist) would you like produced?',
      ],
      extractedPriority,
      extractedBudget,
      extractedDeadlineDays,
    };
  }

  if (isDecisionKeyword) {
    return {
      intent: 'decision_analysis',
      suggestedTitle: shortTitle,
      participatingAgents: ['orchestrator', 'research', 'decision', 'verification'],
      clarificationQuestions: [],
      extractedPriority,
      extractedBudget,
      extractedDeadlineDays,
    };
  }

  if (isGoalKeyword || words.length >= 10) {
    return {
      intent: 'workflow_plan',
      suggestedTitle: shortTitle,
      participatingAgents: [
        'orchestrator',
        'research',
        'strategy',
        'decision',
        'execution',
        'verification',
        'monitoring',
      ],
      clarificationQuestions: [],
      extractedPriority,
      extractedBudget,
      extractedDeadlineDays,
    };
  }

  return {
    intent: 'direct_chat',
    suggestedTitle: shortTitle,
    participatingAgents: ['orchestrator', 'research'],
    clarificationQuestions: [],
    extractedPriority,
    extractedBudget,
    extractedDeadlineDays,
  };
}

/**
 * Pure validation and missing-detail detector for Goal / Plan Creation.
 * Never silently guesses critical constraints; surfaces focused clarification questions when needed.
 */
export function validateAndAnalyzeGoal(input: {
  title?: string;
  description?: string;
  desiredOutcome?: string;
  deadline?: string;
  priority?: string;
  constraints?: string;
  successCriteria?: string;
  expectedDeliverables?: string;
}): GoalValidationResult {
  const errors: string[] = [];
  const missingDetails: string[] = [];
  const clarificationQuestions: string[] = [];

  const title = (input.title || '').trim();
  const description = (input.description || '').trim();
  const desiredOutcome = (input.desiredOutcome || '').trim();
  const deadline = (input.deadline || '').trim();
  const constraints = (input.constraints || '').trim();
  const successCriteria = (input.successCriteria || '').trim();
  const expectedDeliverables = (input.expectedDeliverables || '').trim();

  if (!title || title.length < 3) {
    errors.push('Goal title is required (at least 3 characters).');
  }
  if (!description || description.length < 10) {
    errors.push('Please provide a natural-language description (at least 10 characters).');
  }
  if (!desiredOutcome) {
    errors.push('Desired outcome is required so agents know what target state to achieve.');
  }
  if (!deadline) {
    errors.push('A target deadline is required for critical-path scheduling.');
  }

  if (!constraints) {
    missingDetails.push('Operational or budget constraints');
    clarificationQuestions.push(
      'Are there strict budget limits, technology restrictions, or compliance boundaries the agents must respect?'
    );
  }
  if (!successCriteria) {
    missingDetails.push('Measurable success criteria');
    clarificationQuestions.push(
      'What specific metrics or acceptance criteria should the Verification Agent use to audit the final output?'
    );
  }
  if (!expectedDeliverables) {
    missingDetails.push('Expected deliverable formats');
    clarificationQuestions.push(
      'Which concrete artifacts (e.g., research report, weighted decision matrix, implementation checklist) should be generated?'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    missingDetails,
    clarificationQuestions,
  };
}

/**
 * Detects whether a task graph contains any dependency cycles using DFS three-color marking.
 * Returns { hasCycle: boolean, cyclePath: string[] }.
 */
export function detectDependencyCycle(
  tasks: Pick<Task, 'id' | 'dependencies'>[]
): { hasCycle: boolean; cyclePath: string[] } {
  const adj = new Map<string, string[]>();
  const taskIds = new Set(tasks.map((t) => t.id));

  for (const t of tasks) {
    adj.set(
      t.id,
      (t.dependencies || []).filter((depId) => taskIds.has(depId))
    );
  }

  const state = new Map<string, 0 | 1 | 2>(); // 0 = unvisited, 1 = visiting, 2 = visited

  for (const t of tasks) {
    state.set(t.id, 0);
  }

  for (const t of tasks) {
    if (state.get(t.id) === 0) {
      const stack: string[] = [];
      const found = dfs(t.id, stack);
      if (found) {
        return { hasCycle: true, cyclePath: found };
      }
    }
  }

  function dfs(nodeId: string, pathStack: string[]): string[] | null {
    state.set(nodeId, 1);
    pathStack.push(nodeId);

    const neighbors = adj.get(nodeId) || [];
    for (const nextId of neighbors) {
      const nextState = state.get(nextId) ?? 0;
      if (nextState === 1) {
        const cycleStartIndex = pathStack.indexOf(nextId);
        return [...pathStack.slice(cycleStartIndex), nextId];
      }
      if (nextState === 0) {
        const res = dfs(nextId, pathStack);
        if (res) return res;
      }
    }

    pathStack.pop();
    state.set(nodeId, 2);
    return null;
  }

  return { hasCycle: false, cyclePath: [] };
}

/**
 * Checks if adding a dependency `taskId` -> `dependsOnTaskId` is safe (no self-loop and no cycle).
 */
export function canAddDependency(
  tasks: Pick<Task, 'id' | 'dependencies'>[],
  taskId: string,
  dependsOnTaskId: string
): { allowed: boolean; reason?: string } {
  if (taskId === dependsOnTaskId) {
    return { allowed: false, reason: 'A task cannot depend on itself.' };
  }
  const cloned = tasks.map((t) =>
    t.id === taskId
      ? { ...t, dependencies: Array.from(new Set([...t.dependencies, dependsOnTaskId])) }
      : { ...t, dependencies: [...t.dependencies] }
  );
  const check = detectDependencyCycle(cloned);
  if (check.hasCycle) {
    return {
      allowed: false,
      reason: `Dependency cycle rejected: ${check.cyclePath.join(' → ')}`,
    };
  }
  return { allowed: true };
}

/**
 * Calculates the Critical Path (longest duration path through the task DAG)
 * and topological execution order.
 */
export function calculateCriticalPath(
  tasks: Pick<Task, 'id' | 'title' | 'dependencies' | 'estimatedEffortHours'>[]
): {
  totalDurationHours: number;
  criticalTaskIds: string[];
  topologicalOrder: string[];
  earliestStart: Record<string, number>;
  earliestFinish: Record<string, number>;
} {
  const cycleCheck = detectDependencyCycle(tasks);
  if (cycleCheck.hasCycle || tasks.length === 0) {
    return {
      totalDurationHours: 0,
      criticalTaskIds: [],
      topologicalOrder: tasks.map((t) => t.id),
      earliestStart: {},
      earliestFinish: {},
    };
  }

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const t of tasks) {
    inDegree.set(t.id, 0);
    dependents.set(t.id, []);
  }

  for (const t of tasks) {
    const validDeps = t.dependencies.filter((d) => taskMap.has(d));
    inDegree.set(t.id, validDeps.length);
    for (const dep of validDeps) {
      dependents.get(dep)?.push(t.id);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  const topologicalOrder: string[] = [];
  const earliestStart: Record<string, number> = {};
  const earliestFinish: Record<string, number> = {};
  const predecessorOnCritical = new Map<string, string | null>();

  for (const t of tasks) {
    earliestStart[t.id] = 0;
    earliestFinish[t.id] = Math.max(0.5, Number(t.estimatedEffortHours) || 1);
    predecessorOnCritical.set(t.id, null);
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    topologicalOrder.push(currentId);
    const currentFinish = earliestFinish[currentId];

    for (const nextId of dependents.get(currentId) || []) {
      const nextTask = taskMap.get(nextId)!;
      const effort = Math.max(0.5, Number(nextTask.estimatedEffortHours) || 1);
      if (currentFinish > earliestStart[nextId]) {
        earliestStart[nextId] = currentFinish;
        earliestFinish[nextId] = currentFinish + effort;
        predecessorOnCritical.set(nextId, currentId);
      }
      const newDeg = (inDegree.get(nextId) || 1) - 1;
      inDegree.set(nextId, newDeg);
      if (newDeg === 0) queue.push(nextId);
    }
  }

  let maxFinish = 0;
  let endTaskId: string | null = null;
  for (const t of tasks) {
    if (earliestFinish[t.id] >= maxFinish) {
      maxFinish = earliestFinish[t.id];
      endTaskId = t.id;
    }
  }

  const criticalTaskIds: string[] = [];
  let cursor = endTaskId;
  while (cursor) {
    criticalTaskIds.unshift(cursor);
    cursor = predecessorOnCritical.get(cursor) || null;
  }

  return {
    totalDurationHours: Math.round(maxFinish * 10) / 10,
    criticalTaskIds,
    topologicalOrder,
    earliestStart,
    earliestFinish,
  };
}

const PRIORITY_WEIGHT: Record<PriorityLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Dependency-aware scheduler: returns tasks eligible for immediate execution,
 * respecting completed or explicitly waived dependencies, approval gates, and bounded parallelism.
 */
export function getEligibleTasks(
  tasks: Task[],
  maxParallelAgents: number = 3
): {
  eligible: Task[];
  blockedByFailure: Task[];
  awaitingApprovalGate: Task[];
  currentlyRunningCount: number;
} {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const runningTasks = tasks.filter((t) => t.status === 'Running');
  const availableSlots = Math.max(0, maxParallelAgents - runningTasks.length);

  const candidates: Task[] = [];
  const blockedByFailure: Task[] = [];
  const awaitingApprovalGate: Task[] = [];

  for (const task of tasks) {
    if (task.status !== 'Idle' && task.status !== 'Queued') {
      if (task.status === 'Waiting for Approval') {
        awaitingApprovalGate.push(task);
      }
      continue;
    }

    const deps = (task.dependencies || []).map((id) => taskMap.get(id)).filter(Boolean) as Task[];
    const anyFailedOrCancelled = deps.some(
      (d) => d.status === 'Failed' || d.status === 'Cancelled' || d.status === 'Blocked'
    );

    if (anyFailedOrCancelled && !task.waivedDependencies) {
      blockedByFailure.push(task);
      continue;
    }

    const allCompleted =
      task.waivedDependencies || deps.every((d) => d.status === 'Completed');

    if (allCompleted) {
      if (task.approvalRequired && task.status === 'Idle') {
        awaitingApprovalGate.push(task);
      } else {
        candidates.push(task);
      }
    }
  }

  candidates.sort((a, b) => {
    const pDiff = (PRIORITY_WEIGHT[b.priority] || 1) - (PRIORITY_WEIGHT[a.priority] || 1);
    if (pDiff !== 0) return pDiff;
    return a.createdAt.localeCompare(b.createdAt);
  });

  return {
    eligible: candidates.slice(0, availableSlots),
    blockedByFailure,
    awaitingApprovalGate,
    currentlyRunningCount: runningTasks.length,
  };
}

/**
 * Pure weighted multi-criteria Decision Intelligence scoring calculator.
 * Normalizes user weights to 100%, computes weighted scores on a 0..100 scale,
 * ranks alternatives, and identifies sensitivity margin.
 */
export function calculateDecisionScores(
  criteria: DecisionCriterion[],
  alternatives: DecisionAlternative[]
): {
  rankedAlternatives: Array<{
    alternative: DecisionAlternative;
    weightedScore: number; // 0 to 100
    normalizedBreakdown: Array<{
      criterionId: string;
      criterionName: string;
      normalizedWeight: number;
      rawScore: number;
      weightedContribution: number;
    }>;
  }>;
  topRecommendation: string;
  runnerUp: string | null;
  scoreMargin: number;
  sensitivityNote: string;
} {
  const totalWeight = criteria.reduce((sum, c) => sum + Math.max(0, Number(c.weight) || 0), 0);
  const safeTotal = totalWeight > 0 ? totalWeight : 1;

  const ranked = alternatives.map((alt) => {
    let totalWeighted = 0;
    const breakdown = criteria.map((crit) => {
      const normWeight = Math.max(0, Number(crit.weight) || 0) / safeTotal;
      const rawScore = Math.min(10, Math.max(0, Number(alt.scores[crit.id]) || 0));
      const contribution = normWeight * rawScore * 10; // out of 100
      totalWeighted += contribution;
      return {
        criterionId: crit.id,
        criterionName: crit.name,
        normalizedWeight: Math.round(normWeight * 1000) / 10,
        rawScore,
        weightedContribution: Math.round(contribution * 10) / 10,
      };
    });

    return {
      alternative: alt,
      weightedScore: Math.round(totalWeighted * 10) / 10,
      normalizedBreakdown: breakdown,
    };
  });

  ranked.sort((a, b) => b.weightedScore - a.weightedScore);

  const top = ranked[0];
  const second = ranked[1] || null;
  const margin =
    top && second ? Math.round((top.weightedScore - second.weightedScore) * 10) / 10 : 0;

  let sensitivityNote = 'Single alternative evaluated.';
  if (top && second) {
    if (margin < 4) {
      sensitivityNote = `High sensitivity: ${top.alternative.name} leads ${second.alternative.name} by only ${margin} pts. A ±10% shift in top-weighted criteria could flip the recommendation.`;
    } else if (margin < 10) {
      sensitivityNote = `Moderate sensitivity: ${top.alternative.name} holds a ${margin}-pt lead over ${second.alternative.name}. Validate primary cost and risk assumptions before locking.`;
    } else {
      sensitivityNote = `Robust lead: ${top.alternative.name} outperforms ${second.alternative.name} by ${margin} pts across the current weight distribution.`;
    }
  }

  return {
    rankedAlternatives: ranked,
    topRecommendation: top ? top.alternative.name : 'None',
    runnerUp: second ? second.alternative.name : null,
    scoreMargin: margin,
    sensitivityNote,
  };
}

/**
 * Pure risk assessment engine for Agent G (Monitoring Agent).
 * Inspects real workflow and task records to surface genuine blockers, overdue items, and retry risks.
 */
export function analyzeWorkflowRisks(
  workflows: Workflow[],
  tasks: Task[],
  nowIso: string = new Date().toISOString()
): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  const nowMs = Date.parse(nowIso);
  const wfMap = new Map(workflows.map((w) => [w.id, w]));

  for (const task of tasks) {
    const wf = wfMap.get(task.workflowId);
    if (!wf || wf.status === 'cancelled' || wf.status === 'completed') continue;

    if (task.status === 'Failed') {
      alerts.push({
        id: `risk-fail-${task.id}`,
        workflowId: wf.id,
        workflowTitle: wf.title,
        taskId: task.id,
        severity: 'critical',
        category: 'repeated_failure',
        title: `Task Failed: ${task.title}`,
        description: `Assigned agent (${task.assignedAgent}) encountered an error after ${task.attempts} attempt(s): ${task.error || 'Execution failure'}.`,
        correctiveAction: 'Inspect task error details, adjust acceptance criteria or input context, and trigger Retry.',
        detectedAt: nowIso,
      });
    } else if (task.status === 'Blocked') {
      alerts.push({
        id: `risk-block-${task.id}`,
        workflowId: wf.id,
        workflowTitle: wf.title,
        taskId: task.id,
        severity: 'high',
        category: 'blocker',
        title: `Prerequisite Blocked: ${task.title}`,
        description: `Task cannot proceed because one or more upstream dependencies failed or are blocked.`,
        correctiveAction: 'Resolve upstream dependency failure or waive dependency constraint in the plan editor.',
        detectedAt: nowIso,
      });
    } else if (task.status === 'Waiting for Approval') {
      alerts.push({
        id: `risk-gate-${task.id}`,
        workflowId: wf.id,
        workflowTitle: wf.title,
        taskId: task.id,
        severity: 'medium',
        category: 'approval_bottleneck',
        title: `Human Approval Gate Pending: ${task.title}`,
        description: `Downstream tasks are paused awaiting explicit human sign-off on "${task.title}".`,
        correctiveAction: 'Review the task output or gate requirements and click Approve Gate to resume execution.',
        detectedAt: nowIso,
      });
    }

    const deadlineStr = task.deadline || wf.deadline;
    if (deadlineStr && task.status !== 'Completed' && task.status !== 'Cancelled') {
      const deadlineMs = Date.parse(deadlineStr);
      if (!Number.isNaN(deadlineMs) && deadlineMs < nowMs) {
        alerts.push({
          id: `risk-overdue-${task.id}`,
          workflowId: wf.id,
          workflowTitle: wf.title,
          taskId: task.id,
          severity: 'high',
          category: 'overdue',
          title: `Overdue Task: ${task.title}`,
          description: `Target deadline (${deadlineStr.slice(0, 10)}) has passed while task is still in "${task.status}" state.`,
          correctiveAction: 'Re-prioritize task to Critical or adjust workflow deadline schedule.',
          detectedAt: nowIso,
        });
      }
    }
  }

  return alerts;
}
