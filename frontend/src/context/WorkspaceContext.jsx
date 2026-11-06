import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { workspaceService } from '../services/api';
import { useAuth } from './AuthContext';

const WorkspaceContext = createContext(null);

export const WorkspaceProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInvitations = useCallback(async () => {
    if (!isAuthenticated) {
      setInvitations([]);
      return [];
    }
    try {
      const data = await workspaceService.getInvitations();
      setInvitations(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch pending invitations:', err);
      return [];
    }
  }, [isAuthenticated]);

  const fetchWorkspaces = useCallback(async (preferredWorkspaceId = null) => {
    if (!isAuthenticated) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setLoading(false);
      return [];
    }

    try {
      setLoading(true);
      setError(null);
      const data = await workspaceService.getWorkspaces();
      setWorkspaces(data);

      const targetId = preferredWorkspaceId || localStorage.getItem('sprintsync_current_workspace_id');
      const matched = data.find((ws) => ws.id === targetId);

      if (matched) {
        setCurrentWorkspace(matched);
        localStorage.setItem('sprintsync_current_workspace_id', matched.id);
      } else if (data.length > 0) {
        setCurrentWorkspace(data[0]);
        localStorage.setItem('sprintsync_current_workspace_id', data[0].id);
      } else {
        setCurrentWorkspace(null);
        localStorage.removeItem('sprintsync_current_workspace_id');
      }

      return data;
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
      setError(err.response?.data?.error || 'Failed to load workspaces.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchWorkspaces();
      fetchInvitations();
    } else {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setInvitations([]);
      localStorage.removeItem('sprintsync_current_workspace_id');
      setLoading(false);
    }
  }, [isAuthenticated, fetchWorkspaces, fetchInvitations]);

  const switchWorkspace = (workspaceId) => {
    const target = workspaces.find((ws) => ws.id === workspaceId);
    if (target) {
      setCurrentWorkspace(target);
      localStorage.setItem('sprintsync_current_workspace_id', target.id);
      return target;
    }
    return null;
  };

  const createWorkspace = async (payload) => {
    const newWs = await workspaceService.createWorkspace(payload);
    await fetchWorkspaces(newWs.id);
    return newWs;
  };

  const updateCurrentWorkspace = async (updates) => {
    if (!currentWorkspace) return null;
    const updated = await workspaceService.updateWorkspace(currentWorkspace.id, updates);
    setCurrentWorkspace(updated);
    setWorkspaces((prev) => prev.map((ws) => (ws.id === updated.id ? updated : ws)));
    return updated;
  };

  const deleteCurrentWorkspace = async () => {
    if (!currentWorkspace) return;
    await workspaceService.deleteWorkspace(currentWorkspace.id);
    localStorage.removeItem('sprintsync_current_workspace_id');
    await fetchWorkspaces();
  };

  const acceptInvitation = async (membershipId) => {
    const res = await workspaceService.acceptInvitation(membershipId);
    await Promise.all([
      fetchWorkspaces(res.workspace?.id),
      fetchInvitations(),
    ]);
    return res;
  };

  const declineInvitation = async (membershipId) => {
    const res = await workspaceService.declineInvitation(membershipId);
    await fetchInvitations();
    return res;
  };

  const value = {
    workspaces,
    currentWorkspace,
    invitations,
    loading,
    error,
    switchWorkspace,
    refreshWorkspaces: fetchWorkspaces,
    refreshInvitations: fetchInvitations,
    createWorkspace,
    updateCurrentWorkspace,
    deleteCurrentWorkspace,
    acceptInvitation,
    declineInvitation,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};

