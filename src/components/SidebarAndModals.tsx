import React, { useState } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  FolderKanban,
  Settings,
  Trash2,
  Edit2,
  Check,
  X,
  PanelLeftClose,
  RotateCcw,
  LogIn,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { Conversation, Project, UserSettings, Workflow } from '../types/h1';
import { H1Logo } from './H1Logo';

interface SidebarProps {
  isOpen: boolean;
  isMobile: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
  onRenameConversation: (conversationId: string, newTitle: string) => Promise<void>;
  onDeleteConversation: (conversationId: string) => Promise<void>;
  projects: Project[];
  workflows: Workflow[];
  onOpenSettings: () => void;
  userEmail: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  isMobile,
  onClose,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  projects,
  workflows,
  onOpenSettings,
  userEmail,
  onSignIn,
  onSignOut,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConvId(conv.id);
    setEditingTitle(conv.title);
    setConfirmDeleteId(null);
  };

  const submitRename = async (convId: string, e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (editingTitle.trim()) {
      await onRenameConversation(convId, editingTitle.trim());
    }
    setEditingConvId(null);
  };

  const handleConfirmDelete = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await onDeleteConversation(convId);
    setConfirmDeleteId(null);
  };

  const sidebarContent = (
    <aside
      data-testid="app-sidebar"
      className="w-[260px] shrink-0 h-full bg-[#FAF8F6] border-r border-[#E8E3DF] flex flex-col select-none z-30"
    >
      {/* Top Brand + Collapse */}
      <div className="px-3.5 pt-3.5 pb-2.5 flex items-center justify-between">
        <button
          type="button"
          onClick={onNewChat}
          className="text-left focus:outline-none cursor-pointer"
        >
          <H1Logo size={28} showWordmark={true} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl text-[#79736E] hover:text-[#302C29] hover:bg-[#F0EFED] transition-colors cursor-pointer"
          aria-label="Toggle sidebar"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="px-3 py-1.5">
        <button
          type="button"
          data-testid="new-chat-button"
          onClick={() => {
            onNewChat();
            if (isMobile) onClose();
          }}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FBEAE2]/70 text-[#302C29] border border-[#E8E3DF] shadow-2xs text-[13.5px] font-medium transition-all cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#C78A4A]" />
            New chat
          </span>
          <Sparkles className="w-3.5 h-3.5 text-[#F2B9A0]" />
        </button>
      </div>

      {/* Search Conversations */}
      <div className="px-3 py-1.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#A39B95] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#F0EFED]/80 focus:bg-[#FFFFFF] border border-transparent focus:border-[#E8E3DF] text-[12.5px] text-[#302C29] placeholder:text-[#A39B95] focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* Scrollable Navigation List */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-5">
        {/* Recent Conversations */}
        <div>
          <div className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#A39B95]">
            Recent Conversations
          </div>
          {filteredConversations.length === 0 ? (
            <div className="px-2 py-2 text-[12px] text-[#A39B95]">No conversations found.</div>
          ) : (
            <div className="space-y-0.5">
              {filteredConversations.map((conv) => {
                const isSelected = activeConversationId === conv.id;
                const isEditing = editingConvId === conv.id;
                const isConfirmingDelete = confirmDeleteId === conv.id;

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      if (!isEditing && !isConfirmingDelete) {
                        onSelectConversation(conv.id);
                        if (isMobile) onClose();
                      }
                    }}
                    className={`group relative flex items-center justify-between px-2.5 py-2 rounded-xl text-[13px] transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#FBEAE2] text-[#302C29] font-medium border border-[#F2B9A0]/60'
                        : 'text-[#302C29] hover:bg-[#F0EFED]'
                    }`}
                  >
                    {isEditing ? (
                      <form
                        onSubmit={(e) => submitRename(conv.id, e)}
                        className="flex items-center gap-1 w-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          autoFocus
                          className="w-full px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#E8E3DF] text-[12.5px] text-[#302C29]"
                        />
                        <button
                          type="submit"
                          className="p-1 text-[#679779] hover:bg-[#FFFFFF] rounded"
                          title="Save title"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingConvId(null)}
                          className="p-1 text-[#79736E] hover:bg-[#FFFFFF] rounded"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    ) : isConfirmingDelete ? (
                      <div
                        className="flex items-center justify-between w-full text-[12px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[#C96D65] font-medium truncate">Delete chat?</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleConfirmDelete(conv.id, e)}
                            className="px-2 py-0.5 rounded bg-[#C96D65] text-[#FFFFFF] text-[11px] font-medium cursor-pointer"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#E8E3DF] text-[#79736E] text-[11px] cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <MessageSquare className="w-3.5 h-3.5 text-[#79736E] shrink-0" />
                          <span className="truncate">{conv.title}</span>
                        </div>
                        <div className="hidden group-hover:flex items-center gap-0.5 pl-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => startRename(conv, e)}
                            className="p-1 rounded hover:bg-[#FFFFFF] text-[#79736E] hover:text-[#302C29]"
                            title="Rename conversation"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(conv.id);
                            }}
                            className="p-1 rounded hover:bg-[#FFFFFF] text-[#79736E] hover:text-[#C96D65]"
                            title="Delete conversation"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Projects & Saved Workflows */}
        <div>
          <div className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#A39B95]">
            Projects & Workflows
          </div>
          <div className="space-y-1">
            {workflows.slice(0, 6).map((wf) => {
              const linkedConv = conversations.find(
                (c) => c.id === wf.conversationId || c.workflowId === wf.id
              );
              const project = projects.find((p) => p.id === wf.projectId);
              return (
                <button
                  key={wf.id}
                  type="button"
                  onClick={() => {
                    if (linkedConv) {
                      onSelectConversation(linkedConv.id);
                      if (isMobile) onClose();
                    }
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[#F0EFED] transition-colors flex items-start gap-2 cursor-pointer"
                >
                  <FolderKanban className="w-3.5 h-3.5 text-[#C78A4A] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium text-[#302C29] truncate">
                      {wf.title}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#79736E] mt-0.5">
                      <span className="truncate">{project?.name || 'Coordinated Workflow'}</span>
                      <span className="shrink-0 font-mono text-[10.5px]">{wf.progress}%</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sidebar Footer: Account & Settings */}
      <div className="p-3 border-t border-[#E8E3DF] bg-[#FAF8F6] space-y-1.5">
        {userEmail ? (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#E8E3DF] text-[12px]">
            <span className="truncate text-[#302C29] font-medium">{userEmail}</span>
            <button
              type="button"
              onClick={onSignOut}
              className="text-[#79736E] hover:text-[#302C29] p-1 cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[#F0EFED] text-[12.5px] text-[#79736E] hover:text-[#302C29] transition-colors cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-[#C78A4A]" />
            <span>Sign in to sync cloud history</span>
          </button>
        )}

        <button
          type="button"
          data-testid="open-settings-button"
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[#F0EFED] text-[13px] text-[#302C29] font-medium transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4 text-[#79736E]" />
          <span>Settings & Preferences</span>
        </button>
      </div>
    </aside>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-40 flex bg-[#302C29]/20 backdrop-blur-[2px]">
        {sidebarContent}
        <div className="flex-1" onClick={onClose} />
      </div>
    );
  }

  return sidebarContent;
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  geminiConfigured: boolean;
  onUpdateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  onResetDemo: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  geminiConfigured,
  onUpdateSettings,
  onResetDemo,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  if (!isOpen) return null;

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await onResetDemo();
      setConfirmReset(false);
      onClose();
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#302C29]/20 backdrop-blur-[3px]">
      <div
        data-testid="settings-modal"
        className="w-full max-w-md rounded-2xl bg-[#FFFFFF] border border-[#E8E3DF] shadow-xl overflow-hidden"
      >
        <div className="px-5 py-4 bg-[#FAF8F6] border-b border-[#E8E3DF] flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-[#302C29]">H1-multilevel Settings</h3>
            <p className="text-[12px] text-[#79736E]">
              Configure multi-agent orchestration & interface preferences
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#79736E] hover:text-[#302C29] hover:bg-[#F0EFED] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-[13px]">
          <div className="flex items-center justify-between py-1">
            <div>
              <div className="font-medium text-[#302C29]">Surface Appearance</div>
              <div className="text-[11.5px] text-[#79736E]">
                Warm off-white and soft peach glass palette
              </div>
            </div>
            <select
              value={settings.theme}
              onChange={(e) =>
                onUpdateSettings({ theme: e.target.value as 'peach_light' | 'warm_ivory' })
              }
              className="px-3 py-1.5 rounded-xl bg-[#FAF8F6] border border-[#E8E3DF] text-[#302C29] text-[12.5px]"
            >
              <option value="peach_light">Peach Light (#FAF8F6)</option>
              <option value="warm_ivory">Warm Ivory</option>
            </select>
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <div className="font-medium text-[#302C29]">Max Parallel Agents</div>
              <div className="text-[11.5px] text-[#79736E]">
                Maximum concurrent agents during workflow execution
              </div>
            </div>
            <input
              type="number"
              min={1}
              max={7}
              value={settings.maxParallelAgents}
              onChange={(e) =>
                onUpdateSettings({ maxParallelAgents: Math.min(7, Math.max(1, Number(e.target.value))) })
              }
              className="w-16 px-2.5 py-1 rounded-xl bg-[#FAF8F6] border border-[#E8E3DF] text-[#302C29] text-center"
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <div className="font-medium text-[#302C29]">Verification Retry Limit</div>
              <div className="text-[11.5px] text-[#79736E]">
                Max correction cycles with Agent F before flagging human review
              </div>
            </div>
            <input
              type="number"
              min={1}
              max={5}
              value={settings.maxRetries}
              onChange={(e) =>
                onUpdateSettings({ maxRetries: Math.min(5, Math.max(1, Number(e.target.value))) })
              }
              className="w-16 px-2.5 py-1 rounded-xl bg-[#FAF8F6] border border-[#E8E3DF] text-[#302C29] text-center"
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <div className="font-medium text-[#302C29]">Reduced Motion</div>
              <div className="text-[11.5px] text-[#79736E]">
                Minimise transition animations across cards
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(e) => onUpdateSettings({ reducedMotion: e.target.checked })}
              className="w-4 h-4 accent-[#C78A4A] cursor-pointer"
            />
          </div>

          <div className="p-3 rounded-xl bg-[#FAF8F6] border border-[#E8E3DF] flex items-center justify-between text-[12px]">
            <span className="text-[#79736E]">Server-Side Gemini Orchestration</span>
            <span className="font-medium text-[#679779]">
              {geminiConfigured ? 'Connected' : 'Structured Fallback Ready'}
            </span>
          </div>

          <div className="pt-2 border-t border-[#E8E3DF]">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-[#FAF8F6] hover:bg-[#FDF0EE] text-[#C96D65] border border-[#E8E3DF] text-[12.5px] font-medium transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Demo Conversations & Workflows
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-[#FDF0EE] border border-[#E8B8B4] space-y-2">
                <p className="text-[12px] text-[#C96D65] font-medium">
                  Restore default seeded conversations and reset all workflow progress?
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isResetting}
                    onClick={handleReset}
                    className="px-3 py-1.5 rounded-lg bg-[#C96D65] text-[#FFFFFF] text-[12px] font-medium cursor-pointer"
                  >
                    {isResetting ? 'Resetting...' : 'Confirm Reset'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#E8E3DF] text-[#79736E] text-[12px] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
