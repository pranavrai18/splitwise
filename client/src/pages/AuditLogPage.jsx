import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Avatar, TextField, MenuItem, Grid
} from '@mui/material';
import { History, Edit, Add, Delete, Upload, CheckCircle } from '@mui/icons-material';
import { auditService } from '../services';
import { formatDateTime, getInitials, getUserColor } from '../utils/helpers';

const ACTION_ICONS = {
  create: <Add sx={{ fontSize: 14 }} />,
  update: <Edit sx={{ fontSize: 14 }} />,
  delete: <Delete sx={{ fontSize: 14 }} />,
  import: <Upload sx={{ fontSize: 14 }} />,
  approve: <CheckCircle sx={{ fontSize: 14 }} />
};

const ACTION_COLORS = {
  create: '#22c55e',
  update: '#f59e0b',
  delete: '#ef4444',
  import: '#06b6d4',
  approve: '#22c55e'
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState({ entityType: '', action: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLogs(); }, [page, filter]);

  const loadLogs = async () => {
    try {
      const params = {
        page: page + 1, limit: 20,
        groupId: 'flatmates-group-001',
        ...(filter.entityType && { entityType: filter.entityType }),
        ...(filter.action && { action: filter.action })
      };
      const { data } = await auditService.list(params);
      setLogs(data.logs || []);
      setTotal(data.pagination?.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          <History sx={{ mr: 1, verticalAlign: 'middle' }} />
          Audit Log
        </Typography>
      </Box>

      {/* Filters */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={6} sm={3}>
          <TextField select fullWidth label="Entity Type" size="small"
            value={filter.entityType}
            onChange={e => { setFilter(f => ({...f, entityType: e.target.value})); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="expense">Expense</MenuItem>
            <MenuItem value="settlement">Settlement</MenuItem>
            <MenuItem value="membership">Membership</MenuItem>
            <MenuItem value="group">Group</MenuItem>
            <MenuItem value="import">Import</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField select fullWidth label="Action" size="small"
            value={filter.action}
            onChange={e => { setFilter(f => ({...f, action: e.target.value})); setPage(0); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="create">Create</MenuItem>
            <MenuItem value="update">Update</MenuItem>
            <MenuItem value="delete">Delete</MenuItem>
            <MenuItem value="import">Import</MenuItem>
            <MenuItem value="approve">Approve</MenuItem>
          </TextField>
        </Grid>
      </Grid>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: '#a0a0cc' }}>Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#a0a0cc' }}>User</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#a0a0cc' }}>Action</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#a0a0cc' }}>Entity</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#a0a0cc' }}>Before</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#a0a0cc' }}>After</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} sx={{
                  '&:hover': { background: 'rgba(255,255,255,0.02)' }
                }}>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                      {formatDateTime(log.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{
                        width: 24, height: 24, fontSize: '0.6rem',
                        background: getUserColor(log.user?.name)
                      }}>
                        {getInitials(log.user?.name)}
                      </Avatar>
                      <Typography variant="body2" fontSize="0.8rem">
                        {log.user?.name || 'System'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={ACTION_ICONS[log.action]}
                      label={log.action}
                      size="small"
                      sx={{
                        background: `${ACTION_COLORS[log.action] || '#6b6b99'}15`,
                        color: ACTION_COLORS[log.action] || '#6b6b99',
                        fontWeight: 600, fontSize: '0.7rem',
                        textTransform: 'uppercase'
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip label={log.entityType} size="small" variant="outlined"
                      sx={{ fontSize: '0.7rem' }} />
                  </TableCell>
                  <TableCell sx={{ maxWidth: 200 }}>
                    {log.beforeData && (
                      <Box sx={{
                        p: 1, borderRadius: 1, fontSize: '0.65rem',
                        background: 'rgba(239,68,68,0.06)',
                        fontFamily: 'monospace', maxHeight: 60, overflow: 'auto',
                        color: '#a0a0cc', lineHeight: 1.4
                      }}>
                        {formatJsonPreview(log.beforeData)}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 200 }}>
                    {log.afterData && (
                      <Box sx={{
                        p: 1, borderRadius: 1, fontSize: '0.65rem',
                        background: 'rgba(34,197,94,0.06)',
                        fontFamily: 'monospace', maxHeight: 60, overflow: 'auto',
                        color: '#a0a0cc', lineHeight: 1.4
                      }}>
                        {formatJsonPreview(log.afterData)}
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div" count={total} page={page} rowsPerPage={20}
          onPageChange={(_, p) => setPage(p)} rowsPerPageOptions={[20]}
          sx={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        />
      </Card>
    </Box>
  );
}

function formatJsonPreview(data) {
  if (!data || typeof data !== 'object') return String(data);
  const keys = ['amount', 'description', 'name', 'email', 'action', 'status', 'splitType'];
  const relevant = {};
  for (const key of keys) {
    if (data[key] !== undefined) relevant[key] = data[key];
  }
  const display = Object.keys(relevant).length > 0 ? relevant : data;
  return Object.entries(display).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join('\n');
}
