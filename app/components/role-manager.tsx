'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface UserRole {
  id: string;
  project_id: string;
  gitlab_id: number;
  user_name: string;
  role: 'owner' | 'editor' | 'viewer';
  created_at: string;
}

interface RoleManagerProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

const ROLE_LABELS: Record<string, { label: string; desc: string; color: string }> = {
  owner: { label: '管理员', desc: '可编辑、批注、管理权限', color: 'text-purple-400 bg-purple-400/10' },
  editor: { label: '编辑者', desc: '可编辑文档和批注', color: 'text-blue-400 bg-blue-400/10' },
  viewer: { label: '只读', desc: '仅可查看和批注', color: 'text-amber-400 bg-amber-400/10' },
};

export default function RoleManager({ projectId, isOpen, onClose }: RoleManagerProps) {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [newGitlabId, setNewGitlabId] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newRole, setNewRole] = useState<'owner' | 'editor' | 'viewer'>('editor');
  const [saving, setSaving] = useState(false);

  const loadRoles = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/roles?projectId=${projectId}`);
      const data = await res.json();
      if (data.roles) {
        setRoles(data.roles);
      }
    } catch (err) {
      console.error('Failed to load roles:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) {
      loadRoles();
    }
  }, [isOpen, loadRoles]);

  const [error, setError] = useState('');

  const handleAddRole = async () => {
    if (!newGitlabId.trim()) {
      setError('请输入 GitLab 用户 ID');
      return;
    }
    const gitlabIdNum = parseInt(newGitlabId.trim());
    if (isNaN(gitlabIdNum)) {
      setError('GitLab 用户 ID 必须是数字');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          gitlabId: gitlabIdNum,
          userName: newUserName.trim() || `用户${gitlabIdNum}`,
          role: newRole,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewGitlabId('');
        setNewUserName('');
        setNewRole('editor');
        await loadRoles();
      } else {
        setError(data.error || '添加失败，请重试');
      }
    } catch (err) {
      console.error('Failed to add role:', err);
      setError('网络错误，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async (gitlabId: number, role: string) => {
    try {
      await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, gitlabId, role }),
      });
      loadRoles();
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const handleRemoveRole = async (gitlabId: number) => {
    try {
      await fetch(`/api/roles?projectId=${projectId}&gitlabId=${gitlabId}`, {
        method: 'DELETE',
      });
      loadRoles();
    } catch (err) {
      console.error('Failed to remove role:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">权限管理</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Description */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
            <p className="font-medium mb-1">权限说明</p>
            <ul className="space-y-1 text-xs">
              <li>• <strong>管理员</strong>：编辑文档 + 批注 + 管理用户权限</li>
              <li>• <strong>编辑者</strong>：编辑文档 + 批注（默认权限）</li>
              <li>• <strong>只读</strong>：仅查看文档 + 可在预览中添加批注</li>
            </ul>
            <p className="mt-2 text-xs text-blue-500">未设置角色的用户默认为「编辑者」</p>
          </div>

          {/* Current roles list */}
          {loading ? (
            <div className="text-center py-4 text-gray-400">加载中...</div>
          ) : roles.length === 0 ? (
            <div className="text-center py-4 text-gray-400 text-sm">
              暂未设置任何用户权限<br />
              <span className="text-xs">所有组成员默认为"编辑者"</span>
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {roles.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                      {(r.user_name || '?')[0]}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {r.user_name || `GitLab ID: ${r.gitlab_id}`}
                      </div>
                      <div className="text-xs text-gray-400">ID: {r.gitlab_id}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={r.role}
                      onChange={(e) => handleUpdateRole(r.gitlab_id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-md border-0 ${ROLE_LABELS[r.role].color}`}
                    >
                      <option value="owner">管理员</option>
                      <option value="editor">编辑者</option>
                      <option value="viewer">只读</option>
                    </select>
                    <button
                      onClick={() => handleRemoveRole(r.gitlab_id)}
                      className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                      title="移除（恢复为默认编辑者）"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new role */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">添加用户权限</h3>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="GitLab 用户 ID"
                  value={newGitlabId}
                  onChange={(e) => setNewGitlabId(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="用户名（可选）"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'owner' | 'editor' | 'viewer')}
                  className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="editor">编辑者（可编辑文档）</option>
                  <option value="viewer">只读（仅查看和批注）</option>
                  <option value="owner">管理员（可管理权限）</option>
                </select>
                <button
                  onClick={handleAddRole}
                  disabled={saving || !newGitlabId.trim()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? '添加中...' : '添加'}
                </button>
              </div>
              {error && (
                <p className="text-xs text-red-500 mt-1">{error}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
