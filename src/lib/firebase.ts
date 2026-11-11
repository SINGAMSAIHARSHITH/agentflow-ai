import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  Auth,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Firestore,
} from 'firebase/firestore';
import {
  ChatMessage,
  Conversation,
  DecisionRecord,
  Deliverable,
  Task,
  UserSettings,
  Workflow,
} from '../types/h1';

const env = import.meta.env || {};

const firebaseConfig = {
  apiKey: (env.VITE_FIREBASE_API_KEY || '').trim(),
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN || '').trim(),
  projectId: (env.VITE_FIREBASE_PROJECT_ID || '').trim(),
  storageBucket: (env.VITE_FIREBASE_STORAGE_BUCKET || '').trim(),
  messagingSenderId: (env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
  appId: (env.VITE_FIREBASE_APP_ID || '').trim(),
  firestoreDatabaseId: (env.VITE_FIREBASE_DATABASE_ID || '').trim(),
};

function hasValidFirebaseEnv(): boolean {
  const { apiKey, projectId } = firebaseConfig;
  if (!apiKey || !projectId) return false;
  if (apiKey.includes('YOUR_') || projectId.includes('YOUR_')) return false;
  return true;
}

export const isFirebaseConfigured = hasValidFirebaseEnv();

let app: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

try {
  if (isFirebaseConfigured) {
    app = initializeApp(firebaseConfig);
    dbInstance = firebaseConfig.firestoreDatabaseId
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
    authInstance = getAuth(app);
  }
} catch (err) {
  console.warn('[H1-multilevel] Firebase optional cloud sync unavailable in this environment:', err);
}

export const db = dbInstance as Firestore;
export const auth = authInstance as Auth;

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  if (!authInstance) {
    callback(null);
    return () => {};
  }
  try {
    return onAuthStateChanged(
      authInstance,
      (user) => callback(user),
      () => callback(null)
    );
  } catch {
    callback(null);
    return () => {};
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;
export async function testFirestoreConnection(): Promise<boolean> {
  if (connectionTested) return true;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'admins', 'connection-check'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

export async function signInWithGoogle(): Promise<User | null> {
  if (!authInstance || !dbInstance) return null;
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(authInstance, provider);
  if (cred.user) {
    const userPath = `users/${cred.user.uid}`;
    try {
      await setDoc(
        doc(dbInstance, 'users', cred.user.uid),
        {
          uid: cred.user.uid,
          displayName: (cred.user.displayName || 'H1 Operator').slice(0, 120),
          email: (cred.user.email || '').slice(0, 254),
          role: cred.user.email === 'sh5759632@gmail.com' ? 'admin' : 'member',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, OperationType.WRITE, userPath);
      }
    }
  }
  return cred.user;
}

export async function signOutUser(): Promise<void> {
  if (!authInstance) return;
  await fbSignOut(authInstance);
}

export async function syncConversationToFirestore(conv: Conversation): Promise<void> {
  const currentUser = authInstance?.currentUser;
  if (!currentUser || !dbInstance) return;
  const path = `conversations/${conv.id}`;
  try {
    const payload: Record<string, unknown> = {
      id: conv.id.slice(0, 128),
      ownerId: currentUser.uid,
      title: (conv.title || 'New Conversation').slice(0, 200),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (conv.projectId) payload.projectId = conv.projectId.slice(0, 128);
    if (conv.workflowId) payload.workflowId = conv.workflowId.slice(0, 128);
    if (typeof conv.pinned === 'boolean') payload.pinned = conv.pinned;
    await setDoc(doc(dbInstance, 'conversations', conv.id), payload, { merge: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function syncMessageToFirestore(msg: ChatMessage): Promise<void> {
  const currentUser = authInstance?.currentUser;
  if (!currentUser || !dbInstance) return;
  const path = `messages/${msg.id}`;
  try {
    const payload: Record<string, unknown> = {
      id: msg.id.slice(0, 128),
      ownerId: currentUser.uid,
      conversationId: msg.conversationId.slice(0, 128),
      role: msg.role,
      content: (msg.content || ' ').slice(0, 30000),
      createdAt: serverTimestamp(),
    };
    if (msg.agentId) payload.agentId = msg.agentId;
    if (msg.workflowId) payload.workflowId = msg.workflowId.slice(0, 128);
    if (msg.decisionId) payload.decisionId = msg.decisionId.slice(0, 128);
    if (Array.isArray(msg.deliverableIds)) {
      payload.deliverableIds = msg.deliverableIds.slice(0, 10).map((d) => d.slice(0, 128));
    }
    await setDoc(doc(dbInstance, 'messages', msg.id), payload);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}

export async function deleteConversationFromFirestore(conversationId: string): Promise<void> {
  const currentUser = authInstance?.currentUser;
  if (!currentUser || !dbInstance) return;
  const path = `conversations/${conversationId}`;
  try {
    await deleteDoc(doc(dbInstance, 'conversations', conversationId));
  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

export async function syncWorkflowToFirestore(wf: Workflow): Promise<void> {
  const currentUser = authInstance?.currentUser;
  if (!currentUser || !dbInstance) return;
  const path = `workflows/${wf.id}`;
  try {
    await setDoc(
      doc(dbInstance, 'workflows', wf.id),
      {
        id: wf.id.slice(0, 128),
        ownerId: currentUser.uid,
        projectId: wf.projectId.slice(0, 128),
        title: wf.title.slice(0, 200),
        description: wf.description.slice(0, 3000),
        desiredOutcome: wf.desiredOutcome.slice(0, 1000),
        deadline: wf.deadline.slice(0, 64),
        timezone: (wf.timezone || 'UTC').slice(0, 64),
        priority: wf.priority,
        status: wf.status,
        progress: Math.min(100, Math.max(0, wf.progress)),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function syncTaskToFirestore(task: Task): Promise<void> {
  const currentUser = authInstance?.currentUser;
  if (!currentUser || !dbInstance) return;
  const path = `tasks/${task.id}`;
  try {
    await setDoc(
      doc(dbInstance, 'tasks', task.id),
      {
        id: task.id.slice(0, 128),
        ownerId: currentUser.uid,
        workflowId: task.workflowId.slice(0, 128),
        title: task.title.slice(0, 200),
        description: task.description.slice(0, 3000),
        assignedAgent: task.assignedAgent,
        status: task.status,
        priority: task.priority,
        dependencies: (task.dependencies || []).slice(0, 25),
        acceptanceCriteria: task.acceptanceCriteria.slice(0, 1500),
        estimatedEffortHours: Math.min(1000, Math.max(0, task.estimatedEffortHours)),
        input: (task.input || '').slice(0, 4000),
        output: (task.output || '').slice(0, 15000),
        completionSource: task.completionSource,
        attempts: Math.min(20, Math.max(0, task.attempts)),
        error: (task.error || '').slice(0, 2000),
        approvalRequired: Boolean(task.approvalRequired),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function syncDeliverableToFirestore(del: Deliverable): Promise<void> {
  const currentUser = authInstance?.currentUser;
  if (!currentUser || !dbInstance) return;
  const path = `deliverables/${del.id}`;
  try {
    await setDoc(
      doc(dbInstance, 'deliverables', del.id),
      {
        id: del.id.slice(0, 128),
        ownerId: currentUser.uid,
        workflowId: del.workflowId.slice(0, 128),
        taskId: del.taskId.slice(0, 128),
        title: del.title.slice(0, 200),
        category: del.category,
        contentMarkdown: del.contentMarkdown.slice(0, 50000),
        verificationStatus: del.verificationStatus,
        verificationNotes: (del.verificationNotes || '').slice(0, 2000),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function syncDecisionToFirestore(dec: DecisionRecord): Promise<void> {
  const currentUser = authInstance?.currentUser;
  if (!currentUser || !dbInstance) return;
  const path = `decisions/${dec.id}`;
  try {
    await setDoc(
      doc(dbInstance, 'decisions', dec.id),
      {
        id: dec.id.slice(0, 128),
        ownerId: currentUser.uid,
        workflowId: dec.workflowId.slice(0, 128),
        question: dec.question.slice(0, 500),
        context: dec.context.slice(0, 2000),
        budget: dec.budget.slice(0, 200),
        constraints: dec.constraints.slice(0, 1000),
        timeframe: dec.timeframe.slice(0, 200),
        riskTolerance: dec.riskTolerance,
        criteriaJson: JSON.stringify(dec.criteria).slice(0, 10000),
        alternativesJson: JSON.stringify(dec.alternatives).slice(0, 20000),
        recommendedOption: dec.recommendedOption.slice(0, 200),
        rationale: dec.rationale.slice(0, 4000),
        assumptionsAndUncertainty: dec.assumptionsAndUncertainty.slice(0, 2000),
        supportingEvidence: dec.supportingEvidence.slice(0, 2000),
        reversalConditions: dec.reversalConditions.slice(0, 2000),
        isEstimated: Boolean(dec.isEstimated),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function syncUserSettingsToFirestore(settings: UserSettings): Promise<void> {
  const currentUser = authInstance?.currentUser;
  if (!currentUser || !dbInstance) return;
  const path = `userSettings/${currentUser.uid}`;
  try {
    await setDoc(
      doc(dbInstance, 'userSettings', currentUser.uid),
      {
        ownerId: currentUser.uid,
        theme: settings.theme,
        reducedMotion: Boolean(settings.reducedMotion),
        maxParallelAgents: Math.min(7, Math.max(1, settings.maxParallelAgents)),
        maxRetries: Math.min(5, Math.max(1, settings.maxRetries)),
        defaultViewMode: settings.defaultViewMode,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export { onAuthStateChanged };
export type { User };
