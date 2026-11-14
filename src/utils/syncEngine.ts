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
    baseLastUpdatedAt?: string
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

    const res = await fetch('/api/sync/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': queue[0].userId,
        'x-device-name': encodeURIComponent(queue[0].deviceName || 'Web Terminal'),
      },
      body: JSON.stringify({
        operations: queue,
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

  static async fetchDelta(userId: string, sinceIso?: string): Promise<SyncDeltaResponse> {
    const query = sinceIso ? `?since=${encodeURIComponent(sinceIso)}` : '';
    const res = await fetch(`/api/sync/delta${query}`, {
      headers: { 'x-user-id': userId },
    });
    if (!res.ok) {
      throw new Error('Failed to fetch sync delta');
    }
    return res.json();
  }
}
