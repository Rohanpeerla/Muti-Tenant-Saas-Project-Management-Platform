import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Mutex and request queue for token refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor: Attach JWT access token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('sprintsync_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Auto-refresh access token on 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Do not attempt token refresh for login, register, or refresh endpoints
    const isAuthRoute =
      originalRequest?.url?.includes('/api/auth/login/') ||
      originalRequest?.url?.includes('/api/auth/register/') ||
      originalRequest?.url?.includes('/api/auth/token/refresh/');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('sprintsync_refresh_token');

      if (!refreshToken) {
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/api/auth/token/refresh/`, {
          refresh: refreshToken,
        });

        const newAccessToken = response.data.access;
        const newRefreshToken = response.data.refresh || refreshToken;

        localStorage.setItem('sprintsync_access_token', newAccessToken);
        localStorage.setItem('sprintsync_refresh_token', newRefreshToken);

        api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        processQueue(null, newAccessToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('sprintsync_access_token');
        localStorage.removeItem('sprintsync_refresh_token');
        localStorage.removeItem('sprintsync_user');
        window.dispatchEvent(new Event('sprintsync_auth_logout'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Health check
export const checkHealth = async () => {
  const response = await api.get('/api/health/');
  return response.data;
};

// Auth Services
export const authService = {
  register: async (payload) => {
    const response = await api.post('/api/auth/register/', payload);
    return response.data;
  },
  login: async (credentials) => {
    const response = await api.post('/api/auth/login/', credentials);
    return response.data;
  },
  logout: async (refreshToken) => {
    const response = await api.post('/api/auth/logout/', { refresh: refreshToken });
    return response.data;
  },
  refreshToken: async (refreshToken) => {
    const response = await api.post('/api/auth/token/refresh/', { refresh: refreshToken });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/api/auth/me/');
    return response.data;
  },
  updateProfile: async (data) => {
    const response = await api.patch('/api/auth/me/', data);
    return response.data;
  },
  changePassword: async (data) => {
    const response = await api.post('/api/auth/change-password/', data);
    return response.data;
  },
};

// Workspace Services
export const workspaceService = {
  createWorkspace: async (data) => {
    const response = await api.post('/api/workspaces/', data);
    return response.data;
  },
  getWorkspaces: async () => {
    const response = await api.get('/api/workspaces/');
    return response.data;
  },
  getWorkspaceDetails: async (workspaceId) => {
    const response = await api.get(`/api/workspaces/${workspaceId}/`);
    return response.data;
  },
  updateWorkspace: async (workspaceId, data) => {
    const response = await api.patch(`/api/workspaces/${workspaceId}/`, data);
    return response.data;
  },
  deleteWorkspace: async (workspaceId) => {
    const response = await api.delete(`/api/workspaces/${workspaceId}/`);
    return response.data;
  },
  getInvitations: async () => {
    const response = await api.get('/api/workspaces/invitations/');
    return response.data;
  },
  acceptInvitation: async (membershipId) => {
    const response = await api.post(`/api/workspaces/invitations/${membershipId}/accept/`);
    return response.data;
  },
  declineInvitation: async (membershipId) => {
    const response = await api.post(`/api/workspaces/invitations/${membershipId}/decline/`);
    return response.data;
  },
  getWorkspaceMembers: async (workspaceId) => {
    const response = await api.get(`/api/workspaces/${workspaceId}/members/`);
    return response.data;
  },
  addWorkspaceMember: async (workspaceId, data) => {
    const response = await api.post(`/api/workspaces/${workspaceId}/members/`, data);
    return response.data;
  },
  inviteWorkspaceMember: async (workspaceId, data) => {
    const response = await api.post(`/api/workspaces/${workspaceId}/members/`, data);
    return response.data;
  },
  updateWorkspaceMember: async (workspaceId, membershipId, data) => {
    const response = await api.patch(`/api/workspaces/${workspaceId}/members/${membershipId}/`, data);
    return response.data;
  },
  removeWorkspaceMember: async (workspaceId, membershipId) => {
    const response = await api.delete(`/api/workspaces/${workspaceId}/members/${membershipId}/`);
    return response.data;
  },
};

// Project Services
export const projectService = {
  getProjects: async (workspaceId, params = {}) => {
    const response = await api.get(`/api/workspaces/${workspaceId}/projects/`, { params });
    return response.data;
  },
  createProject: async (workspaceId, data) => {
    const response = await api.post(`/api/workspaces/${workspaceId}/projects/`, data);
    return response.data;
  },
  getProjectDetails: async (projectId) => {
    const response = await api.get(`/api/projects/${projectId}/`);
    return response.data;
  },
  updateProject: async (projectId, data) => {
    const response = await api.patch(`/api/projects/${projectId}/`, data);
    return response.data;
  },
  deleteProject: async (projectId) => {
    const response = await api.delete(`/api/projects/${projectId}/`);
    return response.data;
  },
  getProjectMembers: async (projectId) => {
    const response = await api.get(`/api/projects/${projectId}/members/`);
    return response.data;
  },
  addProjectMember: async (projectId, data) => {
    const response = await api.post(`/api/projects/${projectId}/members/`, data);
    return response.data;
  },
  removeProjectMember: async (projectId, memberId) => {
    const response = await api.delete(`/api/projects/${projectId}/members/${memberId}/`);
    return response.data;
  },
};

// Board Services
export const boardService = {
  getBoards: async (projectId) => {
    const response = await api.get(`/api/projects/${projectId}/boards/`);
    return response.data;
  },
  createBoard: async (projectId, data) => {
    const response = await api.post(`/api/projects/${projectId}/boards/`, data);
    return response.data;
  },
  getBoardDetails: async (boardId) => {
    const response = await api.get(`/api/boards/${boardId}/`);
    return response.data;
  },
  updateBoard: async (boardId, data) => {
    const response = await api.patch(`/api/boards/${boardId}/`, data);
    return response.data;
  },
  deleteBoard: async (boardId) => {
    const response = await api.delete(`/api/boards/${boardId}/`);
    return response.data;
  },
  addColumn: async (boardId, data) => {
    const response = await api.post(`/api/boards/${boardId}/columns/`, data);
    return response.data;
  },
  updateColumn: async (boardId, columnId, data) => {
    const response = await api.patch(`/api/boards/${boardId}/columns/${columnId}/`, data);
    return response.data;
  },
  deleteColumn: async (boardId, columnId) => {
    const response = await api.delete(`/api/boards/${boardId}/columns/${columnId}/`);
    return response.data;
  },
  reorderColumns: async (boardId, columnIds) => {
    const response = await api.post(`/api/boards/${boardId}/columns/reorder/`, { column_ids: columnIds });
    return response.data;
  },
  getTransitions: async (boardId) => {
    const response = await api.get(`/api/boards/${boardId}/transitions/`);
    return response.data;
  },
  createTransition: async (boardId, data) => {
    const response = await api.post(`/api/boards/${boardId}/transitions/`, data);
    return response.data;
  },
  deleteTransition: async (boardId, transitionId) => {
    const response = await api.delete(`/api/boards/${boardId}/transitions/${transitionId}/`);
    return response.data;
  },
};

// Issue / Task Services
export const issueService = {
  getIssues: async (projectId, params = {}) => {
    const response = await api.get(`/api/projects/${projectId}/issues/`, { params });
    return response.data;
  },
  createIssue: async (projectId, data) => {
    const response = await api.post(`/api/projects/${projectId}/issues/`, data);
    return response.data;
  },
  getIssueDetails: async (issueId) => {
    const response = await api.get(`/api/issues/${issueId}/`);
    return response.data;
  },
  updateIssue: async (issueId, data) => {
    const response = await api.patch(`/api/issues/${issueId}/`, data);
    return response.data;
  },
  deleteIssue: async (issueId) => {
    const response = await api.delete(`/api/issues/${issueId}/`);
    return response.data;
  },
  moveIssue: async (issueId, data) => {
    const response = await api.post(`/api/issues/${issueId}/move/`, data);
    return response.data;
  },
};

// Sprint Services
export const sprintService = {
  getSprints: async (projectId) => {
    const response = await api.get(`/api/projects/${projectId}/sprints/`);
    return response.data;
  },
  createSprint: async (projectId, data) => {
    const response = await api.post(`/api/projects/${projectId}/sprints/`, data);
    return response.data;
  },
  getSprintDetails: async (sprintId) => {
    const response = await api.get(`/api/sprints/${sprintId}/`);
    return response.data;
  },
  updateSprint: async (sprintId, data) => {
    const response = await api.patch(`/api/sprints/${sprintId}/`, data);
    return response.data;
  },
  deleteSprint: async (sprintId) => {
    const response = await api.delete(`/api/sprints/${sprintId}/`);
    return response.data;
  },
  startSprint: async (sprintId) => {
    const response = await api.post(`/api/sprints/${sprintId}/start/`);
    return response.data;
  },
  completeSprint: async (sprintId) => {
    const response = await api.post(`/api/sprints/${sprintId}/complete/`);
    return response.data;
  },
};

// Comment Services
export const commentService = {
  getComments: async (issueId) => {
    const response = await api.get(`/api/issues/${issueId}/comments/`);
    return response.data;
  },
  createComment: async (issueId, data) => {
    const response = await api.post(`/api/issues/${issueId}/comments/`, data);
    return response.data;
  },
  updateComment: async (commentId, data) => {
    const response = await api.patch(`/api/comments/${commentId}/`, data);
    return response.data;
  },
  deleteComment: async (commentId) => {
    const response = await api.delete(`/api/comments/${commentId}/`);
    return response.data;
  },
};

// Attachment Services
export const attachmentService = {
  getAttachments: async (issueId) => {
    const response = await api.get(`/api/issues/${issueId}/attachments/`);
    return response.data;
  },
  uploadAttachment: async (issueId, formData, onUploadProgress) => {
    const response = await api.post(`/api/issues/${issueId}/attachments/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
    return response.data;
  },
  downloadAttachment: async (attachmentId, originalFilename) => {
    const response = await api.get(`/api/attachments/${attachmentId}/download/`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', originalFilename || 'download');
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
  deleteAttachment: async (attachmentId) => {
    const response = await api.delete(`/api/attachments/${attachmentId}/`);
    return response.data;
  },
};

// Activity Services
export const activityService = {
  getActivities: async (issueId) => {
    const response = await api.get(`/api/issues/${issueId}/activities/`);
    return response.data;
  },
};

// Workspace Audit Log Services
export const auditLogService = {
  getWorkspaceAuditLogs: async (workspaceId, params = {}) => {
    const response = await api.get(`/api/workspaces/${workspaceId}/audit-logs/`, { params });
    return response.data;
  },
};

// Notification Services
export const notificationService = {
  getNotifications: async (params = {}) => {
    const response = await api.get('/api/notifications/', { params });
    return response.data;
  },
  getUnreadCount: async (workspaceId = null) => {
    const params = workspaceId ? { workspace_id: workspaceId } : {};
    const response = await api.get('/api/notifications/unread-count/', { params });
    return response.data;
  },
  markAsRead: async (notificationId) => {
    const response = await api.patch(`/api/notifications/${notificationId}/read/`);
    return response.data;
  },
  markAllAsRead: async (workspaceId = null) => {
    const payload = workspaceId ? { workspace_id: workspaceId } : {};
    const response = await api.post('/api/notifications/mark-all-read/', payload);
    return response.data;
  },
  deleteNotification: async (notificationId) => {
    const response = await api.delete(`/api/notifications/${notificationId}/`);
    return response.data;
  },
  clearRead: async (workspaceId = null) => {
    const params = workspaceId ? { workspace_id: workspaceId } : {};
    const response = await api.delete('/api/notifications/clear-read/', { params });
    return response.data;
  },
  getPreferences: async () => {
    const response = await api.get('/api/notifications/preferences/');
    return response.data;
  },
  updatePreferences: async (data) => {
    const response = await api.patch('/api/notifications/preferences/', data);
    return response.data;
  },
};

// Webhook Services
export const webhookService = {
  getWorkspaceWebhooks: async (workspaceId) => {
    const response = await api.get(`/api/workspaces/${workspaceId}/webhooks/`);
    return response.data;
  },
  createWebhook: async (workspaceId, data) => {
    const response = await api.post(`/api/workspaces/${workspaceId}/webhooks/`, data);
    return response.data;
  },
  updateWebhook: async (webhookId, data) => {
    const response = await api.patch(`/api/webhooks/${webhookId}/`, data);
    return response.data;
  },
  deleteWebhook: async (webhookId) => {
    const response = await api.delete(`/api/webhooks/${webhookId}/`);
    return response.data;
  },
  testWebhook: async (webhookId) => {
    const response = await api.post(`/api/webhooks/${webhookId}/test/`);
    return response.data;
  },
  rotateSecret: async (webhookId) => {
    const response = await api.post(`/api/webhooks/${webhookId}/rotate-secret/`);
    return response.data;
  },
  getDeliveries: async (webhookId, page = 1) => {
    const response = await api.get(`/api/webhooks/${webhookId}/deliveries/`, { params: { page } });
    return response.data;
  },
  retryDelivery: async (deliveryId) => {
    const response = await api.post(`/api/webhook-deliveries/${deliveryId}/retry/`);
    return response.data;
  },
};

// Billing & Subscription Services
export const billingService = {
  getPlans: async () => {
    const response = await api.get('/api/billing/plans/');
    return response.data;
  },
  getSubscription: async (workspaceId) => {
    const response = await api.get('/api/billing/subscription/', { params: { workspace_id: workspaceId } });
    return response.data;
  },
  createCheckoutSession: async (data) => {
    const response = await api.post('/api/billing/checkout/', data);
    return response.data;
  },
  createCustomerPortalSession: async (data) => {
    const response = await api.post('/api/billing/customer-portal/', data);
    return response.data;
  },
  cancelSubscription: async (workspaceId, cancelAtPeriodEnd = true) => {
    const response = await api.post('/api/billing/cancel-subscription/', {
      workspace_id: workspaceId,
      cancel_at_period_end: cancelAtPeriodEnd,
    });
    return response.data;
  },
  reactivateSubscription: async (workspaceId) => {
    const response = await api.post('/api/billing/reactivate-subscription/', {
      workspace_id: workspaceId,
    });
    return response.data;
  },
  getInvoices: async (workspaceId) => {
    const response = await api.get('/api/billing/invoices/', { params: { workspace_id: workspaceId } });
    return response.data;
  },
};

export default api;
