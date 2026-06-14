import api from './api';

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/me')
};

export const groupService = {
  list: () => api.get('/groups'),
  get: (id) => api.get(`/groups/${id}`),
  create: (data) => api.post('/groups', data),
  update: (id, data) => api.put(`/groups/${id}`, data),
  delete: (id) => api.delete(`/groups/${id}`)
};

export const memberService = {
  list: (groupId) => api.get(`/groups/${groupId}/members`),
  add: (groupId, data) => api.post(`/groups/${groupId}/members`, data),
  update: (groupId, memberId, data) => api.put(`/groups/${groupId}/members/${memberId}`, data)
};

export const expenseService = {
  list: (groupId, params) => api.get(`/groups/${groupId}/expenses`, { params }),
  get: (groupId, id) => api.get(`/groups/${groupId}/expenses/${id}`),
  create: (groupId, data) => api.post(`/groups/${groupId}/expenses`, data),
  update: (groupId, id, data) => api.put(`/groups/${groupId}/expenses/${id}`, data),
  delete: (groupId, id) => api.delete(`/groups/${groupId}/expenses/${id}`)
};

export const balanceService = {
  getBalances: (groupId) => api.get(`/groups/${groupId}/balances`),
  getSimplified: (groupId) => api.get(`/groups/${groupId}/balances/simplified`),
  getLedger: (groupId, userId) => api.get(`/groups/${groupId}/balances/${userId}/ledger`)
};

export const settlementService = {
  list: (groupId) => api.get(`/groups/${groupId}/settlements`),
  create: (groupId, data) => api.post(`/groups/${groupId}/settlements`, data)
};

export const importService = {
  upload: (groupId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/groups/${groupId}/imports`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  get: (groupId, importId) => api.get(`/groups/${groupId}/imports/${importId}`),
  updateAnomaly: (groupId, importId, anomalyId, data) =>
    api.put(`/groups/${groupId}/imports/${importId}/anomalies/${anomalyId}`, data),
  approve: (groupId, importId) => api.post(`/groups/${groupId}/imports/${importId}/approve`)
};

export const auditService = {
  list: (params) => api.get('/audit-logs', { params })
};
