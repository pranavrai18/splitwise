import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Avatar, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, IconButton, Tooltip
} from '@mui/material';
import { Add, Edit, Delete, Receipt, CurrencyRupee, AttachMoney } from '@mui/icons-material';
import { expenseService } from '../services';
import { formatCurrency, formatDate, getInitials, getUserColor } from '../utils/helpers';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const groupId = 'flatmates-group-001';

  useEffect(() => { loadExpenses(); }, [page]);

  const loadExpenses = async () => {
    try {
      const { data } = await expenseService.list(groupId, { page: page + 1, limit: 15 });
      setExpenses(data.expenses || []);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await expenseService.delete(groupId, id);
      loadExpenses();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Expenses</Typography>
        <Button variant="contained" startIcon={<Add />}>Add Expense</Button>
      </Box>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: '#a0a0cc' }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#a0a0cc' }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#a0a0cc' }}>Paid By</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#a0a0cc' }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#a0a0cc' }}>Split</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#a0a0cc' }}>Participants</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#a0a0cc' }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.map((exp) => (
                <TableRow key={exp.id} sx={{
                  '&:hover': { background: 'rgba(255,255,255,0.02)' },
                  transition: 'background 150ms ease'
                }}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                      {formatDate(exp.expenseDate)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {exp.description}
                    </Typography>
                    {exp.notes && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {exp.notes}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{
                        width: 24, height: 24, fontSize: '0.6rem',
                        background: getUserColor(exp.paidBy?.name)
                      }}>
                        {getInitials(exp.paidBy?.name)}
                      </Avatar>
                      <Typography variant="body2" fontSize="0.85rem">{exp.paidBy?.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {exp.currency === 'USD'
                        ? <AttachMoney sx={{ fontSize: 14, color: '#f59e0b' }} />
                        : <CurrencyRupee sx={{ fontSize: 14, color: '#22c55e' }} />
                      }
                      <Typography variant="body2" fontWeight={600}>
                        {formatCurrency(exp.amount, exp.currency)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={exp.splitType} size="small" sx={{
                      fontSize: '0.7rem',
                      background: 'rgba(99,102,241,0.1)',
                      color: '#818cf8'
                    }} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: -0.3 }}>
                      {(exp.participants || []).slice(0, 5).map((p, i) => (
                        <Tooltip key={p.id || i} title={`${p.user?.name}: ${formatCurrency(p.shareAmount)}`}>
                          <Avatar sx={{
                            width: 22, height: 22, fontSize: '0.55rem',
                            background: getUserColor(p.user?.name),
                            border: '2px solid #1a1a3e',
                            ml: i > 0 ? -0.5 : 0
                          }}>
                            {getInitials(p.user?.name)}
                          </Avatar>
                        </Tooltip>
                      ))}
                      {(exp.participants?.length || 0) > 5 && (
                        <Chip label={`+${exp.participants.length - 5}`} size="small"
                          sx={{ ml: 0.5, height: 22, fontSize: '0.6rem' }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" sx={{ color: '#6b6b99' }}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" sx={{ color: '#6b6b99' }} onClick={() => handleDelete(exp.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div" count={total} page={page} rowsPerPage={15}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPageOptions={[15]}
          sx={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        />
      </Card>
    </Box>
  );
}
