# H1-multilevel Security Specification

## 1. Data Invariants
1. **Default Deny**: Any path not explicitly matched is denied (`allow read, write: if false;`).
2. **Verified Authentication**: Every read/write requires `request.auth != null && request.auth.token.email_verified == true`.
3. **Strict Ownership**: Every document in `projects`, `workflows`, `tasks`, `agentRuns`, `deliverables`, `decisions`, `approvals`, `activityLogs`, and `userSettings` must have `ownerId == request.auth.uid`, and `ownerId` is immutable on update.
4. **Relational Existence**: Creating a `workflow` requires `exists(/databases/$(database)/documents/projects/$(incoming().projectId))` and ownership of that project. Creating `tasks`, `agentRuns`, `deliverables`, `decisions`, `approvals`, or `activityLogs` requires `exists(/databases/$(database)/documents/workflows/$(incoming().workflowId))` and ownership of that workflow.
5. **PII Isolation**: `/users/{userId}` can only be read or written when `request.auth.uid == userId`. Role self-escalation (`role == 'admin'`) is blocked unless the user is the bootstrapped admin (`sh5759632@gmail.com` with verified email).
6. **Strict Schema & Bounds**: Every string has `.size() <= MAX`, every ID is validated with `isValidId()`, and every `create`/`update` uses `hasAll`/`hasOnly` and `affectedKeys().hasOnly(...)` with `request.time` timestamp integrity.

## 2. The "Dirty Dozen" Payloads
1. **Identity Spoofing**: Creating a workflow with `ownerId: "victim-uid"` when authenticated as `"attacker-uid"`. -> Rejected by `data.ownerId == request.auth.uid`.
2. **Privilege Escalation**: Creating `/users/attacker-uid` with `role: "admin"` from a non-admin email. -> Rejected by role check.
3. **Unverified Email**: Attempting any write with `request.auth.token.email_verified == false`. -> Rejected by `isVerifiedUser()`.
4. **Shadow Field Injection**: Updating `/workflows/wf-1` with an extra field `isBypassed: true`. -> Rejected by `hasOnly` and `affectedKeys().hasOnly()`.
5. **Orphaned Task Write**: Creating `/tasks/task-1` pointing to a non-existent `workflowId`. -> Rejected by `exists()` and `get().data.ownerId == request.auth.uid`.
6. **Cross-Tenant List Scraping**: Listing `/workflows` without filtering by `ownerId == request.auth.uid`. -> Rejected by `resource.data.ownerId == request.auth.uid`.
7. **PII Leak**: Reading `/users/other-uid` as an authenticated non-owner. -> Rejected by `request.auth.uid == userId`.
8. **ID Poisoning**: Creating a document with a 1500-char ID containing special characters. -> Rejected by `isValidId(id)`.
9. **Denial-of-Wallet String Bomb**: Creating a deliverable with a 500KB `title`. -> Rejected by `data.title.size() <= 200`.
10. **Array Overflow**: Creating a task with 500 items in `dependencies`. -> Rejected by `data.dependencies.size() <= 10`.
11. **Timestamp Forgery**: Creating or updating a record with a backdated `createdAt` or `updatedAt` timestamp instead of `request.time`. -> Rejected by `incoming().createdAt == request.time`.
12. **Immutable Field Mutation**: Updating `createdAt` or `ownerId` or `workflowId` on an existing task. -> Rejected by immutability checks.
