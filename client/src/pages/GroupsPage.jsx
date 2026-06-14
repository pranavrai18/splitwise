import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Avatar, Chip, Grid, IconButton, Tooltip
} from '@mui/material';
import { Add, Group, People, Receipt, CalendarMonth } from '@mui/icons-material';
import { groupService } from '../services';
import { formatDate, getInitials, getUserColor } from '../utils/helpers';

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => { loadGroups(); }, []);

  const loadGroups = async () => {
    try {
      const { data } = await groupService.list();
      setGroups(data);
    } catch (err) {
      console.error('Load groups error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await groupService.create({ name: newGroupName });
      setNewGroupName('');
      setDialogOpen(false);
      loadGroups();
    } catch (err) {
      console.error('Create group error:', err);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Your Groups</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
          New Group
        </Button>
      </Box>

      <Grid container spacing={2.5} className="stagger-children">
        {groups.map(group => (
          <Grid item xs={12} sm={6} md={4} key={group.id}>
            <Card sx={{ cursor: 'pointer' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Avatar sx={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    width: 44, height: 44
                  }}>
                    <Group />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight={600}>{group.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {group.baseCurrency}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <People sx={{ fontSize: 16, color: '#6b6b99' }} />
                    <Typography variant="body2" color="text.secondary">
                      {group.memberCount || group.memberships?.length || 0} members
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Receipt sx={{ fontSize: 16, color: '#6b6b99' }} />
                    <Typography variant="body2" color="text.secondary">
                      {group.expenseCount || group._count?.expenses || 0} expenses
                    </Typography>
                  </Box>
                </Box>

                {/* Member avatars */}
                <Box sx={{ display: 'flex', gap: -0.5 }}>
                  {(group.memberships || []).slice(0, 6).map((m, i) => (
                    <Tooltip key={m.id || i} title={m.user?.name || 'Member'}>
                      <Avatar sx={{
                        width: 28, height: 28, fontSize: '0.65rem',
                        background: getUserColor(m.user?.name),
                        border: '2px solid #1a1a3e',
                        ml: i > 0 ? -0.8 : 0
                      }}>
                        {getInitials(m.user?.name)}
                      </Avatar>
                    </Tooltip>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Create Group Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Create New Group</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth label="Group Name" value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            placeholder="e.g., Flatmates, Trip to Goa"
            sx={{ mt: 1 }}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateGroup}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
