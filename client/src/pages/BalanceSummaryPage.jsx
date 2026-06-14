import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Avatar, Chip, Grid, Divider,
  Accordion, AccordionSummary, AccordionDetails, Alert
} from '@mui/material';
import { ExpandMore, AccountBalance, TrendingUp, TrendingDown, ArrowForward } from '@mui/icons-material';
import { balanceService } from '../services';
import { formatCurrency, getInitials, getUserColor, formatDate } from '../utils/helpers';

export default function BalanceSummaryPage() {
  const [balances, setBalances] = useState(null);
  const [simplified, setSimplified] = useState(null);
  const [ledgers, setLedgers] = useState({});
  const [expandedUser, setExpandedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const groupId = 'flatmates-group-001';

  useEffect(() => { loadBalances(); }, []);

  const loadBalances = async () => {
    try {
      const [balRes, simpRes] = await Promise.all([
        balanceService.getBalances(groupId),
        balanceService.getSimplified(groupId)
      ]);
      setBalances(balRes.data);
      setSimplified(simpRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadLedger = async (userId) => {
    if (ledgers[userId]) return;
    try {
      const { data } = await balanceService.getLedger(groupId, userId);
      setLedgers(prev => ({ ...prev, [userId]: data }));
    } catch (err) { console.error(err); }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>Balance Summary</Typography>

      <Grid container spacing={2.5}>
        {/* Simplified Settlements */}
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccountBalance sx={{ color: '#818cf8' }} /> Settle Up
              </Typography>

              {simplified?.settlements?.length === 0 && (
                <Alert severity="success" sx={{ borderRadius: 2 }}>Everyone is settled up! 🎉</Alert>
              )}

              {simplified?.settlements?.map((s, i) => (
                <Box key={i} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  p: 2, mb: 1, borderRadius: 2,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}>
                  <Avatar sx={{ width: 32, height: 32, background: getUserColor(s.from.name), fontSize: '0.7rem' }}>
                    {getInitials(s.from.name)}
                  </Avatar>
                  <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>{s.from.name}</Typography>
                  <ArrowForward sx={{ color: '#818cf8', fontSize: 16 }} />
                  <Typography variant="body2" fontWeight={500} sx={{ flex: 1, textAlign: 'center' }}>{s.to.name}</Typography>
                  <Avatar sx={{ width: 32, height: 32, background: getUserColor(s.to.name), fontSize: '0.7rem' }}>
                    {getInitials(s.to.name)}
                  </Avatar>
                  <Chip label={formatCurrency(s.amount)} size="small"
                    sx={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 700, ml: 1 }} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Per-User Balances with Expandable Ledger */}
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Individual Balances</Typography>

              {balances?.balances?.map((b) => (
                <Accordion
                  key={b.userId}
                  expanded={expandedUser === b.userId}
                  onChange={() => {
                    const next = expandedUser === b.userId ? null : b.userId;
                    setExpandedUser(next);
                    if (next) loadLedger(next);
                  }}
                  sx={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '12px !important', mb: 1,
                    '&:before': { display: 'none' },
                    '&.Mui-expanded': { borderColor: 'rgba(99,102,241,0.2)' }
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMore sx={{ color: '#6b6b99' }} />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                      <Avatar sx={{ width: 32, height: 32, background: getUserColor(b.name), fontSize: '0.7rem' }}>
                        {getInitials(b.name)}
                      </Avatar>
                      <Typography variant="body1" fontWeight={500} sx={{ flex: 1 }}>{b.name}</Typography>
                      {b.balance >= 0
                        ? <TrendingUp sx={{ color: '#22c55e', fontSize: 18 }} />
                        : <TrendingDown sx={{ color: '#ef4444', fontSize: 18 }} />
                      }
                      <Typography variant="body1" fontWeight={700} sx={{
                        color: b.balance >= 0 ? '#22c55e' : '#ef4444', mr: 1
                      }}>
                        {b.balance >= 0 ? '+' : '-'}{formatCurrency(b.balance)}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0 }}>
                    <Divider sx={{ mb: 1.5, borderColor: 'rgba(255,255,255,0.06)' }} />
                    <Grid container spacing={1} sx={{ mb: 2 }}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Paid</Typography>
                        <Typography variant="body2" fontWeight={600}>{formatCurrency(b.totalPaid)}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Owed</Typography>
                        <Typography variant="body2" fontWeight={600}>{formatCurrency(b.totalOwed)}</Typography>
                      </Grid>
                    </Grid>

                    {ledgers[b.userId]?.expenses?.slice(0, 15).map((item, idx) => (
                      <Box key={idx} sx={{
                        display: 'flex', alignItems: 'center', py: 0.6,
                        borderBottom: '1px solid rgba(255,255,255,0.04)'
                      }}>
                        <Typography variant="caption" color="text.secondary" sx={{ width: 65, flexShrink: 0 }}>
                          {formatDate(item.expenseDate).split(',')[0]}
                        </Typography>
                        <Typography variant="body2" sx={{ flex: 1, fontSize: '0.8rem' }} noWrap>
                          {item.description}
                        </Typography>
                        <Typography variant="body2" fontWeight={600} sx={{
                          color: item.netEffect >= 0 ? '#22c55e' : '#ef4444',
                          fontSize: '0.8rem'
                        }}>
                          {item.netEffect >= 0 ? '+' : ''}{formatCurrency(item.netEffect)}
                        </Typography>
                      </Box>
                    ))}
                  </AccordionDetails>
                </Accordion>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
