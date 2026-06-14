import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Avatar, Chip, Grid
} from '@mui/material';
import { Add, Handshake, ArrowForward } from '@mui/icons-material';
import { settlementService, memberService } from '../services';
import { formatCurrency, formatDate, getInitials, getUserColor } from '../utils/helpers';

export default function SettlementsPage() {
  const [settlements, setSettlements] = useState([]);
  const [members, setMembers] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ fromUserId: '', toUserId: '', amount: '', notes: '' });
  const [loading, setLoading] = useState(true);
  const groupId = 'flatmates-group-001';

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [settRes, memRes] = await Promise.all([
        settlementService.list(groupId),
        memberService.list(groupId)
      ]);
      setSettlements(settRes.data);
      setMembers(memRes.data.filter(m => m.isActive));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!form.fromUserId || !form.toUserId || !form.amount) return;
    try {
      await settlementService.create(groupId, {
        ...form, amount: parseFloat(form.amount)
      });
      setDialogOpen(false);
      setForm({ fromUserId: '', toUserId: '', amount: '', notes: '' });
      loadData();
    } catch (err) { console.error(err); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Settlements</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
          Record Payment
        </Button>
      </Box>

      <Grid container spacing={2} className="stagger-children">
        {settlements.map((s) => (
          <Grid item xs={12} sm={6} md={4} key={s.id}>
            <Card>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Avatar sx={{ width: 36, height: 36, background: getUserColor(s.fromUser?.name), fontSize: '0.75rem' }}>
                    {getInitials(s.fromUser?.name)}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={500}>{s.fromUser?.name}</Typography>
                  </Box>
                  <ArrowForward sx={{ color: '#818cf8', fontSize: 20 }} />
                  <Box sx={{ flex: 1, textAlign: 'right' }}>
                    <Typography variant="body2" fontWeight={500}>{s.toUser?.name}</Typography>
                  </Box>
                  <Avatar sx={{ width: 36, height: 36, background: getUserColor(s.toUser?.name), fontSize: '0.75rem' }}>
                    {getInitials(s.toUser?.name)}
                  </Avatar>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Chip
                    label={formatCurrency(s.amount, s.currency)}
                    sx={{
                      background: 'rgba(34,197,94,0.12)',
                      color: '#22c55e',
                      fontWeight: 700, fontSize: '0.85rem'
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(s.settledAt)}
                  </Typography>
                </Box>
                {s.notes && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    {s.notes}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
        {settlements.length === 0 && !loading && (
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 4, textAlign: 'center' }}>
                <Handshake sx={{ fontSize: 48, color: '#6b6b99', mb: 1 }} />
                <Typography color="text.secondary">No settlements recorded yet</Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Record Settlement Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Record Settlement</DialogTitle>
        <DialogContent>
          <TextField select fullWidth label="Who paid?" value={form.fromUserId}
            onChange={e => setForm(f => ({...f, fromUserId: e.target.value}))} sx={{ mt: 1, mb: 2 }}>
            {members.map(m => <MenuItem key={m.userId} value={m.userId}>{m.name}</MenuItem>)}
          </TextField>
          <TextField select fullWidth label="Paid to?" value={form.toUserId}
            onChange={e => setForm(f => ({...f, toUserId: e.target.value}))} sx={{ mb: 2 }}>
            {members.filter(m => m.userId !== form.fromUserId).map(m =>
              <MenuItem key={m.userId} value={m.userId}>{m.name}</MenuItem>
            )}
          </TextField>
          <TextField fullWidth label="Amount (₹)" type="number" value={form.amount}
            onChange={e => setForm(f => ({...f, amount: e.target.value}))} sx={{ mb: 2 }} />
          <TextField fullWidth label="Notes (optional)" value={form.notes}
            onChange={e => setForm(f => ({...f, notes: e.target.value}))} multiline rows={2} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate}>Record</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
