import { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Chip, Avatar, Skeleton,
  Accordion, AccordionSummary, AccordionDetails, Divider, Alert
} from '@mui/material';
import {
  TrendingUp, TrendingDown, AccountBalance, ArrowForward,
  ExpandMore, Receipt
} from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { balanceService, expenseService } from '../services';
import { formatCurrency, getInitials, getUserColor } from '../utils/helpers';

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#06b6d4'];

export default function DashboardPage() {
  const [balances, setBalances] = useState(null);
  const [simplified, setSimplified] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [ledger, setLedger] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState(null);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const groupId = 'flatmates-group-001';

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [balRes, simpRes, expRes] = await Promise.all([
        balanceService.getBalances(groupId),
        balanceService.getSimplified(groupId),
        expenseService.list(groupId, { limit: 50 })
      ]);
      setBalances(balRes.data);
      setSimplified(simpRes.data);
      setExpenses(expRes.data.expenses || []);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLedger = async (userId) => {
    if (ledger[userId]) return;
    try {
      const res = await balanceService.getLedger(groupId, userId);
      setLedger(prev => ({ ...prev, [userId]: res.data }));
    } catch (err) {
      console.error('Ledger load error:', err);
    }
  };

  // Compute spending by payer for pie chart
  const spendingByPayer = {};
  expenses.forEach(exp => {
    const name = exp.paidBy?.name || 'Unknown';
    spendingByPayer[name] = (spendingByPayer[name] || 0) + parseFloat(exp.baseAmount || exp.amount || 0);
  });
  const pieData = Object.entries(spendingByPayer).map(([name, value]) => ({ name, value: Math.round(value) }));

  // Monthly spending bar chart
  const monthlySpend = {};
  expenses.forEach(exp => {
    const date = new Date(exp.expenseDate);
    const key = date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    monthlySpend[key] = (monthlySpend[key] || 0) + parseFloat(exp.baseAmount || exp.amount || 0);
  });
  const barData = Object.entries(monthlySpend).map(([month, total]) => ({ month, total: Math.round(total) }));

  if (loading) {
    return (
      <Box className="stagger-children">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} variant="rounded" height={120} sx={{ mb: 2, borderRadius: 3 }} />
        ))}
      </Box>
    );
  }

  const myBalance = balances?.balances?.find(b => b.userId === user.id);
  const totalGroupSpend = expenses.reduce((sum, e) => sum + parseFloat(e.baseAmount || e.amount || 0), 0);

  return (
    <Box className="stagger-children">
      {/* Stats Cards Row */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    Your Balance
                  </Typography>
                  <Typography variant="h5" fontWeight={700} sx={{
                    color: (myBalance?.balance || 0) >= 0 ? '#22c55e' : '#ef4444',
                    mt: 0.5
                  }}>
                    {(myBalance?.balance || 0) >= 0 ? '+' : '-'}{formatCurrency(myBalance?.balance || 0)}
                  </Typography>
                </Box>
                <Avatar sx={{
                  background: (myBalance?.balance || 0) >= 0
                    ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  color: (myBalance?.balance || 0) >= 0 ? '#22c55e' : '#ef4444'
                }}>
                  {(myBalance?.balance || 0) >= 0 ? <TrendingUp /> : <TrendingDown />}
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>Total Spent</Typography>
              <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>
                {formatCurrency(totalGroupSpend)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>Expenses</Typography>
              <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>
                {expenses.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>Settlements Needed</Typography>
              <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5, color: '#818cf8' }}>
                {simplified?.settlements?.length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        {/* Settlement Summary — Aisha's View */}
        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                <AccountBalance sx={{ color: '#818cf8' }} />
                <Typography variant="h6" fontWeight={600}>Settlement Summary</Typography>
              </Box>

              {simplified?.settlements?.length === 0 && (
                <Alert severity="success" sx={{ borderRadius: 2 }}>All settled up! 🎉</Alert>
              )}

              <Box className="stagger-children">
                {simplified?.settlements?.map((s, i) => (
                  <Box key={i} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    p: 2, mb: 1.5, borderRadius: 2,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    transition: 'all 200ms ease',
                    '&:hover': { background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.2)' }
                  }}>
                    <Avatar sx={{ width: 36, height: 36, background: getUserColor(s.from.name), fontSize: '0.75rem' }}>
                      {getInitials(s.from.name)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={500} noWrap>
                        {s.from.name}
                      </Typography>
                    </Box>
                    <ArrowForward sx={{ color: '#818cf8', fontSize: 18 }} />
                    <Box sx={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                      <Typography variant="body2" fontWeight={500} noWrap>
                        {s.to.name}
                      </Typography>
                    </Box>
                    <Chip
                      label={formatCurrency(s.amount)}
                      size="small"
                      sx={{
                        background: 'rgba(99,102,241,0.15)',
                        color: '#818cf8',
                        fontWeight: 700,
                        fontSize: '0.8rem'
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Expandable Ledger — Rohan's View */}
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                <Receipt sx={{ color: '#8b5cf6' }} />
                <Typography variant="h6" fontWeight={600}>Balance Breakdown</Typography>
              </Box>

              {balances?.balances?.map((b) => (
                <Accordion
                  key={b.userId}
                  expanded={expandedUser === b.userId}
                  onChange={() => {
                    const newExpanded = expandedUser === b.userId ? null : b.userId;
                    setExpandedUser(newExpanded);
                    if (newExpanded) loadLedger(newExpanded);
                  }}
                  sx={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '12px !important',
                    mb: 1.5,
                    '&:before': { display: 'none' },
                    '&.Mui-expanded': {
                      borderColor: 'rgba(99,102,241,0.2)',
                      boxShadow: '0 0 20px rgba(99,102,241,0.08)'
                    }
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMore sx={{ color: '#6b6b99' }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                      <Avatar sx={{ width: 32, height: 32, background: getUserColor(b.name), fontSize: '0.7rem' }}>
                        {getInitials(b.name)}
                      </Avatar>
                      <Typography variant="body1" fontWeight={500} sx={{ flex: 1 }}>
                        {b.name}
                      </Typography>
                      <Typography variant="body1" fontWeight={700} sx={{
                        color: b.balance >= 0 ? '#22c55e' : '#ef4444', mr: 1
                      }}>
                        {b.balance >= 0 ? '+' : '-'}{formatCurrency(b.balance)}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0, px: 2, pb: 2 }}>
                    <Divider sx={{ mb: 1.5, borderColor: 'rgba(255,255,255,0.06)' }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">Total Paid</Typography>
                      <Typography variant="caption" fontWeight={600}>{formatCurrency(b.totalPaid)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="caption" color="text.secondary">Total Owed</Typography>
                      <Typography variant="caption" fontWeight={600}>{formatCurrency(b.totalOwed)}</Typography>
                    </Box>

                    {/* Expense ledger items */}
                    {ledger[b.userId]?.expenses?.map((item, idx) => (
                      <Box key={idx} sx={{
                        display: 'flex', alignItems: 'center', gap: 1,
                        py: 0.8, borderBottom: '1px solid rgba(255,255,255,0.04)'
                      }}>
                        <Typography variant="caption" color="text.secondary" sx={{ width: 70, flexShrink: 0 }}>
                          {new Date(item.expenseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </Typography>
                        <Typography variant="body2" sx={{ flex: 1, fontSize: '0.8rem' }} noWrap>
                          {item.description}
                        </Typography>
                        <Typography variant="body2" fontWeight={600} sx={{
                          color: item.netEffect >= 0 ? '#22c55e' : '#ef4444',
                          fontSize: '0.8rem'
                        }}>
                          {item.netEffect >= 0 ? '+' : '-'}{formatCurrency(item.netEffect)}
                        </Typography>
                      </Box>
                    ))}

                    {!ledger[b.userId] && (
                      <Typography variant="caption" color="text.secondary">Loading breakdown...</Typography>
                    )}
                    {ledger[b.userId]?.expenses?.length === 0 && (
                      <Typography variant="caption" color="text.secondary">No expenses found</Typography>
                    )}
                  </AccordionDetails>
                </Accordion>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Charts Row */}
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Monthly Spending</Typography>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData}>
                  <XAxis dataKey="month" stroke="#6b6b99" fontSize={12} />
                  <YAxis stroke="#6b6b99" fontSize={12} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{
                      background: '#1a1a3e', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10, color: '#f0f0ff'
                    }}
                    formatter={(value) => [`₹${value.toLocaleString()}`, 'Total']}
                  />
                  <Bar dataKey="total" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Spending by Member</Typography>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                    paddingAngle={4} stroke="none"
                  >
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#1a1a3e', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10, color: '#f0f0ff'
                    }}
                    formatter={(value) => `₹${value.toLocaleString()}`}
                  />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {pieData.map((entry, idx) => (
                  <Chip
                    key={entry.name}
                    label={`${entry.name}: ₹${entry.value.toLocaleString()}`}
                    size="small"
                    sx={{
                      background: `${CHART_COLORS[idx % CHART_COLORS.length]}20`,
                      color: CHART_COLORS[idx % CHART_COLORS.length],
                      fontWeight: 500, fontSize: '0.7rem'
                    }}
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
