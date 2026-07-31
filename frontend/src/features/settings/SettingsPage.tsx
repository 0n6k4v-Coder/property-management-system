// File: src/features/settings/SettingsPage.tsx
// System settings page with audit log viewer and system configuration.
// SCR-SETTINGS: GET /admin/audit-logs, GET /admin/config, PATCH /admin/config/{key}

import { useReducer } from 'react';
import { useProperties } from '@/features/property/api';
import { useAuditLogs, useSystemConfig, useUpdateSystemConfig } from './api';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { TableSkeleton, Skeleton } from '@/shared/ui';
import { useToast } from '@/shared/ui/Toast';

function formatTimestamp(date: string): string {
  return new Date(date).toLocaleString('en-GB');
}

type State = {
  activeTab: 'audit' | 'config';
  auditPage: number;
  auditPropertyId: string;
  editingConfigKey: string | null;
  editValue: string;
};

type Action =
  | { type: 'SET_ACTIVE_TAB'; payload: 'audit' | 'config' }
  | { type: 'SET_AUDIT_PAGE'; payload: number }
  | { type: 'SET_AUDIT_PROPERTY_ID'; payload: string }
  | { type: 'SET_EDITING_CONFIG_KEY'; payload: string | null }
  | { type: 'SET_EDIT_VALUE'; payload: string }
  | { type: 'RESET' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload, auditPage: 1 };
    case 'SET_AUDIT_PAGE':
      return { ...state, auditPage: action.payload };
    case 'SET_AUDIT_PROPERTY_ID':
      return { ...state, auditPropertyId: action.payload };
    case 'SET_EDITING_CONFIG_KEY':
      return { ...state, editingConfigKey: action.payload };
    case 'SET_EDIT_VALUE':
      return { ...state, editValue: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const initialState: State = {
  activeTab: 'audit',
  auditPage: 1,
  auditPropertyId: '',
  editingConfigKey: null,
  editValue: '',
};

export default function SettingsPage() {
  const { showToast } = useToast();
  const { data: properties } = useProperties();
  const [state, dispatch] = useReducer(reducer, initialState);

  const { data: auditData, isLoading: auditLoading } = useAuditLogs(
    state.auditPropertyId || undefined,
    state.auditPage,
    20,
  );
  const { data: configData, isLoading: configLoading } = useSystemConfig();
  const updateConfigMutation = useUpdateSystemConfig();

  const auditLogs = auditData?.data ?? [];
  const auditMeta = auditData?.meta ?? {};
  const totalItems = (auditMeta.total as number) ?? 0;
  const totalPages = Math.ceil(totalItems / 20);

  function handleConfigEdit(key: string, currentValue: string) {
    dispatch({ type: 'SET_EDITING_CONFIG_KEY', payload: key });
    dispatch({ type: 'SET_EDIT_VALUE', payload: currentValue });
  }

  async function handleConfigSave(key: string) {
    try {
      await updateConfigMutation.mutateAsync({ key, value: state.editValue });
      showToast('Configuration updated', 'success');
      dispatch({ type: 'SET_EDITING_CONFIG_KEY', payload: null });
      dispatch({ type: 'SET_EDIT_VALUE', payload: '' });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">System Settings</h1>
        <p className="mt-1 text-sm text-surface-500">Audit logs and system configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-200" role="tablist" aria-label="Settings tabs">
        <button
          role="tab"
          type="button"
          aria-selected={state.activeTab === 'audit'}
          onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'audit' })}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            state.activeTab === 'audit'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-surface-500 hover:text-surface-700'
          }`}
        >
          Audit Logs
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={state.activeTab === 'config'}
          onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'config' })}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            state.activeTab === 'config'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-surface-500 hover:text-surface-700'
          }`}
        >
          System Config
        </button>
      </div>

      {/* Audit Logs Tab */}
      {state.activeTab === 'audit' && (
        <Card>
          <CardHeader title="Audit Logs" />
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label htmlFor="audit-property" className="text-sm font-medium text-surface-700">
              Property:
            </label>
            <select
              id="audit-property"
              value={state.auditPropertyId}
              onChange={(e) => {
                dispatch({ type: 'SET_AUDIT_PROPERTY_ID', payload: e.target.value });
                dispatch({ type: 'SET_AUDIT_PAGE', payload: 1 });
              }}
              className="block w-full max-w-xs rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500"
            >
              <option value="">All properties</option>
              {(properties ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {auditLoading && <TableSkeleton rows={5} />}

          {!auditLoading && auditLogs.length === 0 && (
            <div className="text-center py-8 text-surface-400">No audit logs found.</div>
          )}

          {!auditLoading && auditLogs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50 text-left text-xs font-medium uppercase tracking-wide text-surface-500">
                    <th scope="col" className="px-4 py-3">Timestamp</th>
                    <th scope="col" className="px-4 py-3">Action</th>
                    <th scope="col" className="px-4 py-3">Resource</th>
                    <th scope="col" className="px-4 py-3">User</th>
                    <th scope="col" className="px-4 py-3">Property</th>
                    <th scope="col" className="px-4 py-3">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-surface-100">
                      <td className="px-4 py-3 text-surface-600">{formatTimestamp(log.timestamp)}</td>
                      <td className="px-4 py-3 font-medium text-surface-900">{log.action}</td>
                      <td className="px-4 py-3 text-surface-600">
                        {log.resource_type} {log.resource_id?.slice(0, 8) ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-surface-600">{log.user_id?.slice(0, 8) ?? 'System'}</td>
                      <td className="px-4 py-3 text-surface-600">{log.property_id?.slice(0, 8) ?? 'Global'}</td>
                      <td className="px-4 py-3 text-surface-500 font-mono text-xs">{log.ip_address ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!auditLoading && totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-surface-500">
                Page {state.auditPage} of {totalPages} ({totalItems} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => dispatch({ type: 'SET_AUDIT_PAGE', payload: Math.max(1, state.auditPage - 1) })}
                  disabled={state.auditPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => dispatch({ type: 'SET_AUDIT_PAGE', payload: Math.min(totalPages, state.auditPage + 1) })}
                  disabled={state.auditPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* System Config Tab */}
      {state.activeTab === 'config' && (
        <Card>
          <CardHeader title="System Configuration" subtitle="Some values are masked for security" />
          {configLoading && <Skeleton className="h-64" />}

          {!configLoading && configData?.data?.length === 0 && (
            <div className="text-center py-8 text-surface-400">No configuration entries.</div>
          )}

          {!configLoading && configData?.data && configData.data.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left text-xs font-medium uppercase tracking-wide text-surface-500">
                  <th scope="col" className="px-4 py-3">Key</th>
                  <th scope="col" className="px-4 py-3">Value</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {configData.data.map((cfg) => (
                  <tr key={cfg.key} className="border-b border-surface-100">
                    <td className="px-4 py-3 font-medium text-surface-900 font-mono">{cfg.key}</td>
                    <td className="px-4 py-3">
                      {state.editingConfigKey === cfg.key ? (
                        <div className="flex gap-2">
                          <label htmlFor={`config-edit-${cfg.key}`} className="sr-only">
                            Edit configuration value for {cfg.key}
                          </label>
                          <input
                            id={`config-edit-${cfg.key}`}
                            type="text"
                            value={state.editValue}
                            onChange={(e) => dispatch({ type: 'SET_EDIT_VALUE', payload: e.target.value })}
                            className="flex-1 rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500"
                            aria-label={`Edit value for ${cfg.key}`}
                          />
                          <Button size="sm" onClick={() => handleConfigSave(cfg.key)}>Save</Button>
                          <Button size="sm" variant="secondary" onClick={() => {
                            dispatch({ type: 'SET_EDITING_CONFIG_KEY', payload: null });
                            dispatch({ type: 'SET_EDIT_VALUE', payload: '' });
                          }}>Cancel</Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className={cfg.masked ? 'text-surface-400 font-mono' : 'text-surface-600 font-mono'}>
                            {cfg.masked ? '••••••••' : cfg.value}
                          </span>
                          <Button size="sm" variant="secondary" onClick={() => handleConfigEdit(cfg.key, cfg.value)}>
                            Edit
                          </Button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {cfg.masked && <Badge variant="info">Masked</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}