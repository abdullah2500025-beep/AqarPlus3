import { AqarDatabaseState, OfflineQueuedAction, SyncConflictRecord } from '../types/aqar';

export interface SyncBatchUploadResult {
  success: boolean;
  uploaded: number;
  skippedDuplicates: number;
  conflictsDetected: number;
  newConflicts: SyncConflictRecord[];
  errors: string[];
  state?: AqarDatabaseState;
  syncedAt: string;
}

export interface SyncDeltaResponse {
  hasChanges: boolean;
  serverRevision: number;
  lastUpdatedAt: string;
  pendingConflictsCount: number;
  syncConflicts: SyncConflictRecord[];
  state?: AqarDatabaseState;
}

export class SyncEngine {
  static async uploadPendingOperations(
    queue: OfflineQueuedAction[],
    baseLastUpdatedAt?: string,
    authToken?: string | null,
    workspaceId = 'default'
  ): Promise<SyncBatchUploadResult> {
    if (queue.length === 0) {
      return {
        success: true,
        uploaded: 0,
        skippedDuplicates: 0,
        conflictsDetected: 0,
        newConflicts: [],
        errors: [],
        syncedAt: new Date().toISOString(),
      };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-device-name': encodeURIComponent(queue[0].deviceName || 'Web Terminal'),
      'x-workspace-id': workspaceId,
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const res = await fetch('/api/sync/batch', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({
        operations: queue.map((op) => ({
          ...op,
          operationId: op.operationId || op.idempotencyKey || op.id,
        })),
        clientLastUpdatedAt: baseLastUpdatedAt,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Sync batch upload failed');
    }

    return {
      success: true,
      uploaded: data.uploaded || 0,
      skippedDuplicates: data.skippedDuplicates || 0,
      conflictsDetected: data.conflictsDetected || 0,
      newConflicts: data.newConflicts || [],
      errors: data.errors || [],
      state: data.state,
      syncedAt: data.syncedAt || new Date().toISOString(),
    };
  }

  static async fetchDelta(
    sinceIso?: string,
    authToken?: string | null,
    workspaceId = 'default'
  ): Promise<SyncDeltaResponse> {
    const query = sinceIso ? `?since=${encodeURIComponent(sinceIso)}` : '';
    const headers: Record<string, string> = {
      'x-workspace-id': workspaceId,
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    const res = await fetch(`/api/sync/delta${query}`, {
      credentials: 'include',
      headers,
    });
    if (!res.ok) {
      throw new Error('Failed to fetch sync delta');
    }
    return res.json();
  }
}
