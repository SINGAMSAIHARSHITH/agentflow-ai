import React, { useEffect, useRef, useState } from 'react';
import {
  PanelLeftOpen,
  Plus,
  Send,
  Paperclip,
  Copy,
  Check,
  RotateCcw,
  Activity,
  Sparkles,
  X,
  FileText,
  Compass,
  Search,
  Scale,
  ListChecks,
  AlertCircle,
} from 'lucide-react';
import {
  ChatAttachment,
  ChatMessage,
  Conversation,
  DecisionRecord,
  H1StateSnapshot,
  PriorityLevel,
  Task,
  UserSettings,
  AgentId,
} from './types/h1';
import { HOME_SUGGESTION_CARDS, INITIAL_AGENTS } from './core/agents';
import { buildAppRoute, clientApi, parseAppRoute } from './core/clientApi';
import { H1Logo, H1WelcomeMark } from './components/H1Logo';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { InlineWorkflowCard } from './components/InlineWorkflowCard';
import { InlineDecisionCard } from './components/InlineDecisionCard';
import { InlineDeliverableCard } from './components/InlineDeliverableCard';
import { AgentActivityPanel } from './components/AgentActivityPanel';
import { Sidebar, SettingsModal } from './components/SidebarAndModals';
import {
  auth,
  signInWithGoogle,
  signOutUser,
  syncConversationToFirestore,
  syncMessageToFirestore,
  deleteConversationFromFirestore,
  syncWorkflowToFirestore,
  syncTaskToFirestore,
  syncDecisionToFirestore,
  syncDeliverableToFirestore,
  syncUserSettingsToFirestore,
} from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const SUGGESTION_ICONS: Record<string, React.ReactNode> = {
  plan: <Compass className="w-4 h-4 text-[#C78A4A]" />,
  research: <Search className="w-4 h-4 text-[#C78A4A]" />,
  decision: <Scale className="w-4 h-4 text-[#C78A4A]" />,
  tasks: <ListChecks className="w-4 h-4 text-[#C78A4A]" />,
};

const APP_BASE_URL = import.meta.env.BASE_URL || '/agentflow-ai/';

export default function App() {
  const initialRoute =
    typeof window !== 'undefined'
      ? parseAppRoute(window.location.pathname, APP_BASE_URL)
      : { conversationId: null, panel: null };

  const [snapshot, setSnapshot] = useState<H1StateSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Active conversation: null means "New Chat" home screen
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialRoute.conversationId
  );

  // Composer state
  const [composerText, setComposerText] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [executingWorkflowId, setExecutingWorkflowId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Layout & panels state
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [activityPanelOpen, setActivityPanelOpen] = useState(initialRoute.panel === 'activity');
  const [settingsModalOpen, setSettingsModalOpen] = useState(initialRoute.panel === 'settings');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Sync browser URL with active conversation for SPA deep-linking on GitHub Pages
  const navigateToConversation = (conversationId: string | null, replace = false) => {
    setActiveConversationId(conversationId);
    if (typeof window !== 'undefined') {
      const nextUrl = buildAppRoute({ conversationId, panel: null }, APP_BASE_URL);
      if (window.location.pathname !== nextUrl) {
        if (replace) {
          window.history.replaceState({ conversationId }, '', nextUrl);
        } else {
          window.history.pushState({ conversationId }, '', nextUrl);
        }
      }
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const route = parseAppRoute(window.location.pathname, APP_BASE_URL);
      setActiveConversationId(route.conversationId);
      setActivityPanelOpen(route.panel === 'activity');
      setSettingsModalOpen(route.panel === 'settings');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUserEmail(user?.email || null);
    });
    return () => unsub();
  }, []);

  const fetchState = async () => {
    try {
      const data = await clientApi.getState();
      setSnapshot(data);
      setErrorBanner(null);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Unable to initialise H1-multilevel workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  const activeConversation: Conversation | null =
    snapshot?.conversations.find((c) => c.id === activeConversationId) || null;

  const activeMessages: ChatMessage[] = snapshot
    ? snapshot.messages
        .filter((m) => m.conversationId === activeConversationId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, isSending]);

  const handleSelectSuggestion = (promptText: string) => {
    setComposerText(promptText);
    setTimeout(() => {
      if (composerRef.current) {
        composerRef.current.focus();
      }
    }, 30);
  };

  const handleNewChat = () => {
    navigateToConversation(null);
    setComposerText('');
    setAttachments([]);
    setTimeout(() => composerRef.current?.focus(), 30);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: ChatAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let preview = '';
      try {
        const text = await file.text();
        preview = text.slice(0, 600);
      } catch {
        preview = `[Attached file: ${file.name}]`;
      }
      newAttachments.push({
        id: `att-${Date.now()}-${i}`,
        name: file.name,
        mimeType: file.type || 'text/plain',
        sizeBytes: file.size,
        contentPreview: preview,
      });
    }
    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const handleSendMessage = async (overrideContent?: string) => {
    const contentToSend = (overrideContent ?? composerText).trim();
    if (!contentToSend || isSending) return;

    setIsSending(true);
    setErrorBanner(null);
    const currentAttachments = [...attachments];
    if (!overrideContent) {
      setComposerText('');
      setAttachments([]);
    }

    try {
      let targetConvId = activeConversationId;

      if (!targetConvId) {
        const createData = await clientApi.createConversation(contentToSend.slice(0, 56));
        targetConvId = createData.conversation.id;
        navigateToConversation(targetConvId);
        setSnapshot(createData.state);
        await syncConversationToFirestore(createData.conversation);
      }

      const msgData = await clientApi.sendMessage(targetConvId, contentToSend, currentAttachments);
      setSnapshot(msgData.state);
      await syncMessageToFirestore(msgData.userMessage);
      await syncMessageToFirestore(msgData.assistantMessage);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleRenameConversation = async (conversationId: string, newTitle: string) => {
    try {
      const data = await clientApi.renameConversation(conversationId, newTitle);
      setSnapshot(data.state);
      if (data.conversation) await syncConversationToFirestore(data.conversation);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Could not rename conversation.');
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      const data = await clientApi.deleteConversation(conversationId);
      setSnapshot(data.state);
      if (activeConversationId === conversationId) {
        navigateToConversation(null);
      }
      await deleteConversationFromFirestore(conversationId);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Could not delete conversation.');
    }
  };

  const handleApprovePlan = async (workflowId: string, autoRunAll = true) => {
    setExecutingWorkflowId(workflowId);
    setErrorBanner(null);
    try {
      const data = await clientApi.approvePlan(workflowId, autoRunAll);
      setSnapshot(data.state);
      if (data.workflow) await syncWorkflowToFirestore(data.workflow);
      if (data.deliverable) await syncDeliverableToFirestore(data.deliverable);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Workflow execution encountered an error.');
    } finally {
      setExecutingWorkflowId(null);
    }
  };

  const handleRejectPlan = async (workflowId: string, reason?: string) => {
    setExecutingWorkflowId(workflowId);
    try {
      const data = await clientApi.rejectPlan(workflowId, reason);
      setSnapshot(data.state);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Could not reject plan.');
    } finally {
      setExecutingWorkflowId(null);
    }
  };

  const handleExecuteNextStep = async (workflowId: string) => {
    setExecutingWorkflowId(workflowId);
    try {
      const data = await clientApi.executeNextStep(workflowId);
      setSnapshot(data.state);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Step execution failed.');
    } finally {
      setExecutingWorkflowId(null);
    }
  };

  const handleWorkflowControl = async (
    workflowId: string,
    action: 'pause' | 'resume' | 'cancel' | 'retry_failed' | 'approve_gates'
  ) => {
    setExecutingWorkflowId(workflowId);
    try {
      const data = await clientApi.workflowControl(workflowId, action);
      setSnapshot(data.state);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Failed to update workflow state.');
    } finally {
      setExecutingWorkflowId(null);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const data = await clientApi.updateTask(taskId, updates);
      setSnapshot(data.state);
      if (data.task) await syncTaskToFirestore(data.task);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Task update failed.');
    }
  };

  const handleCreateTask = async (taskPayload: {
    workflowId: string;
    title: string;
    description: string;
    assignedAgent: AgentId;
    priority: PriorityLevel;
    dependencies: string[];
    acceptanceCriteria: string;
    estimatedEffortHours: number;
  }) => {
    try {
      const data = await clientApi.createTask(taskPayload);
      setSnapshot(data.state);
      if (data.task) await syncTaskToFirestore(data.task);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Task creation failed.');
    }
  };

  const handleUpdateDecision = async (decisionId: string, updates: Partial<DecisionRecord>) => {
    try {
      const data = await clientApi.updateDecision(decisionId, updates);
      setSnapshot(data.state);
      if (data.decision) await syncDecisionToFirestore(data.decision);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Decision update failed.');
    }
  };

  const handleReviseDeliverable = async (deliverableId: string, instructions: string) => {
    try {
      const data = await clientApi.reviseDeliverable(deliverableId, instructions);
      setSnapshot(data.state);
      if (data.deliverable) await syncDeliverableToFirestore(data.deliverable);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Could not revise deliverable.');
    }
  };

  const handleUpdateSettings = async (updates: Partial<UserSettings>) => {
    try {
      const data = await clientApi.updateSettings(updates);
      setSnapshot(data.state);
      if (data.settings) await syncUserSettingsToFirestore(data.settings);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Settings update failed.');
    }
  };

  const handleResetDemo = async () => {
    try {
      const data = await clientApi.resetDemo();
      setSnapshot(data);
      navigateToConversation(null);
    } catch (err: any) {
      setErrorBanner(err?.message || 'Could not reset demo data.');
    }
  };

  const handleCopyMessage = async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedMessageId(msg.id);
      setTimeout(() => setCopiedMessageId(null), 1800);
    } catch {
      // ignore
    }
  };

  const agents = snapshot?.agents || INITIAL_AGENTS;
  const activeAgentCount = agents.filter((a) => a.status === 'Running').length;

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#FAF8F6] text-[#302C29] font-sans">
      {/* Slim Left Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        isMobile={isMobile}
        onClose={() => setSidebarOpen(false)}
        conversations={snapshot?.conversations || []}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => navigateToConversation(id)}
        onNewChat={handleNewChat}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        projects={snapshot?.projects || []}
        workflows={snapshot?.workflows || []}
        onOpenSettings={() => setSettingsModalOpen(true)}
        userEmail={userEmail}
        onSignIn={() => signInWithGoogle()}
        onSignOut={() => signOutUser()}
      />

      {/* Central Conversation Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative bg-[#FAF8F6]">
        {/* Minimal Top Header */}
        <header className="h-14 px-4 sm:px-6 border-b border-[#E8E3DF]/80 bg-[#FAF8F6]/90 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            {(!sidebarOpen || isMobile) && (
              <button
                type="button"
                data-testid="open-sidebar-button"
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-xl text-[#79736E] hover:text-[#302C29] hover:bg-[#F0EFED] transition-colors cursor-pointer"
                aria-label="Open sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            {(!sidebarOpen || isMobile) && (
              <button
                type="button"
                onClick={handleNewChat}
                className="focus:outline-none cursor-pointer"
              >
                <H1Logo size={24} showWordmark={!isMobile} />
              </button>
            )}

            <div className="min-w-0">
              <h1 className="text-[14px] font-semibold text-[#302C29] truncate">
                {activeConversation ? activeConversation.title : 'H1-multilevel'}
              </h1>
              <p className="text-[11px] text-[#79736E] truncate hidden sm:block">
                One conversation. Multiple intelligent agents.
              </p>
            </div>
          </div>

          {/* Right Top Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid="agent-activity-toggle"
              onClick={() => setActivityPanelOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FBEAE2]/70 text-[#302C29] border border-[#E8E3DF] text-[12px] font-medium shadow-2xs transition-colors cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-[#C78A4A]" />
              <span>Agent activity</span>
              <span className="px-1.5 py-0.2 rounded-md bg-[#FBEAE2] text-[#302C29] text-[10.5px] font-semibold">
                {activeAgentCount > 0 ? `${activeAgentCount} active` : '7 ready'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleNewChat}
              className="p-2 rounded-xl bg-[#FFFFFF] hover:bg-[#F0EFED] text-[#302C29] border border-[#E8E3DF] transition-colors cursor-pointer sm:hidden"
              title="New chat"
              aria-label="New chat"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Error / Retry Notification Banner */}
        {errorBanner && (
          <div className="mx-auto max-w-3xl w-full px-4 pt-3 z-20">
            <div className="px-4 py-2.5 rounded-xl bg-[#FDF0EE] border border-[#E8B8B4] flex items-center justify-between gap-3 text-[12.5px] text-[#C96D65]">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errorBanner}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={fetchState}
                  className="px-2.5 py-1 rounded-lg bg-[#FFFFFF] border border-[#E8B8B4] text-[#302C29] text-[11.5px] font-medium cursor-pointer"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => setErrorBanner(null)}
                  className="p-1 text-[#C96D65] hover:text-[#302C29] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Scrollable Conversation Stream or Home Screen */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 pb-8 pt-4">
          {loading ? (
            <div className="max-w-3xl mx-auto py-16 text-center space-y-3">
              <H1WelcomeMark />
              <p className="text-[14px] text-[#79736E]">
                Initialising H1-multilevel agent workspace...
              </p>
            </div>
          ) : !activeConversationId || activeMessages.length === 0 ? (
            /* HOME SCREEN (EMPTY / NEW CONVERSATION STATE) */
            <div
              data-testid="home-welcome-screen"
              className="max-w-2xl mx-auto min-h-[calc(100%-2rem)] flex flex-col items-center justify-center py-8 sm:py-14 text-center"
            >
              <div className="mb-4">
                <H1WelcomeMark />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FBEAE2] border border-[#F2B9A0]/60 text-[12px] font-medium text-[#302C29] mb-3">
                <Sparkles className="w-3.5 h-3.5 text-[#C78A4A]" />
                <span>H1-multilevel</span>
              </div>

              <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#302C29]">
                How can I help you today?
              </h2>
              <p className="text-[14.5px] text-[#79736E] mt-2 max-w-md">
                Your AI agents, working together to get things done.
              </p>

              {/* 4 Subtle Suggestion Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-8 text-left">
                {HOME_SUGGESTION_CARDS.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    data-testid={`suggestion-card-${card.intent}`}
                    onClick={() => handleSelectSuggestion(card.prompt)}
                    className="group p-4 rounded-2xl bg-[#FFFFFF] hover:bg-[#FBEAE2]/55 border border-[#E8E3DF] hover:border-[#F2B9A0] shadow-[0_4px_16px_-6px_rgba(48,44,41,0.05)] transition-all flex items-start gap-3 cursor-pointer text-left"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#FAF8F6] group-hover:bg-[#FFFFFF] border border-[#E8E3DF] flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                      {SUGGESTION_ICONS[card.intent]}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-[#302C29] group-hover:text-[#302C29]">
                        {card.label}
                      </div>
                      <div className="text-[12px] text-[#79736E] mt-0.5 line-clamp-2">
                        {card.subtitle}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Recent Seeded Conversations Quick Access */}
              {snapshot && snapshot.conversations.length > 0 && (
                <div className="w-full mt-8 pt-6 border-t border-[#E8E3DF]/70 text-left">
                  <div className="text-[11.5px] font-semibold uppercase tracking-wider text-[#A39B95] mb-2.5">
                    Continue Active Agent Sessions
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {snapshot.conversations.slice(0, 3).map((conv) => (
                      <button
                        key={conv.id}
                        type="button"
                        onClick={() => navigateToConversation(conv.id)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#FFFFFF] hover:bg-[#F0EFED] border border-[#E8E3DF] text-[12.5px] text-[#302C29] font-medium transition-colors cursor-pointer"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#C78A4A]" />
                        <span className="truncate max-w-[260px]">{conv.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ACTIVE CONVERSATION STREAM */
            <div
              data-testid="conversation-stream"
              className="max-w-3xl mx-auto space-y-6 py-4"
            >
              {activeMessages.map((msg) => {
                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[85%] sm:max-w-[78%] rounded-2xl rounded-tr-sm px-4 py-3 bg-[#FBEAE2] border border-[#F2B9A0]/50 text-[#302C29] shadow-2xs">
                        <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </p>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-[#F2B9A0]/40 flex flex-wrap gap-1.5">
                            {msg.attachments.map((att) => (
                              <span
                                key={att.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FFFFFF]/80 text-[11.5px] text-[#302C29]"
                              >
                                <FileText className="w-3 h-3 text-[#C78A4A]" />
                                {att.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Assistant Message
                const linkedWorkflow = msg.workflowId
                  ? snapshot?.workflows.find((w) => w.id === msg.workflowId)
                  : undefined;

                const linkedDecision = msg.decisionId
                  ? snapshot?.decisions.find((d) => d.id === msg.decisionId)
                  : undefined;

                // Deliverables explicitly linked to this message OR belonging to the linked workflow when completed
                const messageDeliverables = (snapshot?.deliverables || []).filter(
                  (del) =>
                    msg.deliverableIds?.includes(del.id) ||
                    (linkedWorkflow &&
                      del.workflowId === linkedWorkflow.id &&
                      !activeMessages.some(
                        (other) => other.id !== msg.id && other.deliverableIds?.includes(del.id)
                      ))
                );

                const participating = (msg.participatingAgents || [msg.agentId || 'orchestrator'])
                  .map((id) => agents.find((a) => a.id === id))
                  .filter(Boolean);

                return (
                  <div key={msg.id} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-xl bg-[#FBEAE2] border border-[#F2B9A0] flex items-center justify-center shrink-0 mt-0.5 text-[11.5px] font-semibold text-[#302C29]">
                      H1
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Participating Agent Badges + Expandable Activity Pill */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {participating.map((agent) =>
                          agent ? (
                            <span
                              key={agent.id}
                              className="px-2 py-0.5 rounded-md text-[11px] font-medium text-[#302C29] border border-[#E8E3DF]"
                              style={{ backgroundColor: agent.badgeBg || '#FBEAE2' }}
                            >
                              Agent {agent.code} · {agent.shortName}
                            </span>
                          ) : null
                        )}

                        <button
                          type="button"
                          onClick={() => setActivityPanelOpen(true)}
                          className="text-[11px] text-[#79736E] hover:text-[#302C29] underline ml-1 cursor-pointer"
                        >
                          Agent activity
                        </button>
                      </div>

                      {/* Assistant Markdown Content */}
                      <div className="text-[#302C29]">
                        <MarkdownRenderer content={msg.content} />
                      </div>

                      {/* Clarification Quick-Reply Chips if present */}
                      {msg.clarificationQuestions && msg.clarificationQuestions.length > 0 && (
                        <div className="p-3.5 rounded-2xl bg-[#FFFFFF] border border-[#E8E3DF] space-y-2 my-2">
                          <div className="text-[12px] font-semibold text-[#302C29]">
                            Quick Clarifications (Click to populate composer with details):
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleSelectSuggestion(
                                  'Goal: Launch our B2B onboarding workflow refactor within 4 weeks with a $35k budget, 3 engineers, and target 99.9% reliability.'
                                )
                              }
                              className="px-3 py-1.5 rounded-xl bg-[#FAF8F6] hover:bg-[#FBEAE2] border border-[#E8E3DF] text-[12px] text-[#302C29] transition-colors cursor-pointer"
                            >
                              Provide 4-week timeline, $35k budget & success criteria
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inline Workflow Plan Card */}
                      {linkedWorkflow && snapshot && (
                        <InlineWorkflowCard
                          workflow={linkedWorkflow}
                          tasks={snapshot.tasks}
                          agents={agents}
                          isExecuting={executingWorkflowId === linkedWorkflow.id}
                          onApprovePlan={handleApprovePlan}
                          onRejectPlan={handleRejectPlan}
                          onExecuteNextStep={handleExecuteNextStep}
                          onWorkflowControl={handleWorkflowControl}
                          onUpdateTask={handleUpdateTask}
                          onCreateTask={handleCreateTask}
                        />
                      )}

                      {/* Inline Decision Support Card */}
                      {linkedDecision && (
                        <InlineDecisionCard
                          decision={linkedDecision}
                          onUpdateDecision={handleUpdateDecision}
                        />
                      )}

                      {/* Inline Deliverable Cards */}
                      {messageDeliverables.map((del) => (
                        <InlineDeliverableCard
                          key={del.id}
                          deliverable={del}
                          onReviseDeliverable={handleReviseDeliverable}
                        />
                      ))}

                      {/* Assistant Message Footer Actions */}
                      <div className="flex items-center gap-3 pt-1 text-[11.5px] text-[#A39B95]">
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg)}
                          className="inline-flex items-center gap-1 hover:text-[#302C29] transition-colors cursor-pointer"
                        >
                          {copiedMessageId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-[#679779]" />
                              <span className="text-[#679779]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy response</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const prevUserMsg = [...activeMessages]
                              .reverse()
                              .find((m) => m.role === 'user');
                            if (prevUserMsg) {
                              handleSendMessage(prevUserMsg.content);
                            }
                          }}
                          className="inline-flex items-center gap-1 hover:text-[#302C29] transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {isSending && (
                <div className="flex items-center gap-3 text-[13px] text-[#79736E] py-2">
                  <div className="w-7 h-7 rounded-xl bg-[#FFD6C2] flex items-center justify-center text-[11px] font-semibold text-[#302C29] animate-pulse">
                    H1
                  </div>
                  <span>Agent A (Orchestrator) is coordinating specialised agents...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Bottom Rounded White Glass Message Composer */}
        <div className="px-4 sm:px-6 pb-4 pt-2 bg-gradient-to-t from-[#FAF8F6] via-[#FAF8F6]/95 to-transparent shrink-0 z-20">
          <div className="max-w-3xl mx-auto">
            <div className="glass-composer rounded-3xl p-2.5 sm:p-3 transition-all focus-within:border-[#F2B9A0]">
              {/* Attached files row */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-2 pb-2 mb-1.5 border-b border-[#E8E3DF]">
                  {attachments.map((att) => (
                    <span
                      key={att.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FBEAE2] text-[12px] text-[#302C29]"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#C78A4A]" />
                      <span className="truncate max-w-[180px]">{att.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((prev) => prev.filter((item) => item.id !== att.id))
                        }
                        className="text-[#79736E] hover:text-[#302C29] cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.md,.csv,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-2xl text-[#79736E] hover:text-[#302C29] hover:bg-[#F0EFED] transition-colors shrink-0 cursor-pointer"
                  title="Attach context file (.txt, .md, .csv, .json)"
                  aria-label="Attach file"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <textarea
                  ref={composerRef}
                  data-testid="chat-composer-input"
                  rows={composerText.split('\n').length > 2 ? 3 : 1}
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Describe a goal, project, decision, or task for H1-multilevel..."
                  className="flex-1 max-h-36 py-1.5 px-1 bg-transparent text-[14.5px] text-[#302C29] placeholder:text-[#A39B95] focus:outline-none resize-none leading-relaxed"
                />

                <button
                  type="button"
                  data-testid="chat-send-button"
                  disabled={!composerText.trim() || isSending}
                  onClick={() => handleSendMessage()}
                  className="w-9 h-9 rounded-full bg-[#FFD6C2] hover:bg-[#F2B9A0] disabled:bg-[#F0EFED] text-[#302C29] disabled:text-[#A39B95] flex items-center justify-center transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed shadow-2xs"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mt-2 text-center text-[11px] text-[#A39B95]">
              H1-multilevel coordinates 7 specialised AI agents. Review workflow plans and estimates before critical execution.
            </div>
          </div>
        </div>
      </div>

      {/* Lightweight Agent Activity Disclosure Panel */}
      <AgentActivityPanel
        isOpen={activityPanelOpen}
        onClose={() => setActivityPanelOpen(false)}
        agents={agents}
        agentRuns={snapshot?.agentRuns || []}
        riskAlerts={snapshot?.riskAlerts || []}
      />

      {/* Settings Modal */}
      {snapshot && (
        <SettingsModal
          isOpen={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          settings={snapshot.settings}
          geminiConfigured={snapshot.geminiConfigured}
          onUpdateSettings={handleUpdateSettings}
          onResetDemo={handleResetDemo}
        />
      )}
    </div>
  );
}
