import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  AppBar, Toolbar, Typography, IconButton, Avatar, Divider, Tooltip, Chip
} from '@mui/material';
import {
  Dashboard, Group, Receipt, Upload, Handshake, AccountBalance,
  History, Logout, Menu as MenuIcon, ChevronLeft
} from '@mui/icons-material';
import { getInitials, getUserColor } from '../../utils/helpers';

const DRAWER_WIDTH = 260;

const navItems = [
  { path: '/', label: 'Dashboard', icon: <Dashboard /> },
  { path: '/groups', label: 'Groups', icon: <Group /> },
  { path: '/expenses', label: 'Expenses', icon: <Receipt /> },
  { path: '/import', label: 'Import CSV', icon: <Upload /> },
  { path: '/settlements', label: 'Settlements', icon: <Handshake /> },
  { path: '/balances', label: 'Balances', icon: <AccountBalance /> },
  { path: '/audit', label: 'Audit Log', icon: <History /> }
];

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Background orbs */}
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerOpen ? DRAWER_WIDTH : 72,
          flexShrink: 0,
          transition: 'width 250ms ease',
          '& .MuiDrawer-paper': {
            width: drawerOpen ? DRAWER_WIDTH : 72,
            transition: 'width 250ms ease',
            background: 'rgba(10, 10, 26, 0.8)',
            backdropFilter: 'blur(20px)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            overflowX: 'hidden'
          }
        }}
      >
        {/* Logo area */}
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 64 }}>
          <Box
            sx={{
              width: 36, height: 36, borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', fontWeight: 800, flexShrink: 0,
              boxShadow: '0 4px 15px rgba(99,102,241,0.3)'
            }}
          >
            S
          </Box>
          {drawerOpen && (
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
              Split<span style={{ color: '#818cf8' }}>wise</span>
            </Typography>
          )}
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

        {/* Nav items */}
        <List sx={{ px: 1, py: 1.5, flex: 1 }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                <Tooltip title={!drawerOpen ? item.label : ''} placement="right">
                  <ListItemButton
                    onClick={() => navigate(item.path)}
                    sx={{
                      borderRadius: '10px',
                      minHeight: 44,
                      px: drawerOpen ? 2 : 2.5,
                      background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                      borderLeft: isActive ? '3px solid #6366f1' : '3px solid transparent',
                      '&:hover': {
                        background: isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)'
                      },
                      transition: 'all 200ms ease'
                    }}
                  >
                    <ListItemIcon sx={{
                      color: isActive ? '#818cf8' : '#6b6b99',
                      minWidth: drawerOpen ? 40 : 'auto'
                    }}>
                      {item.icon}
                    </ListItemIcon>
                    {drawerOpen && (
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontSize: '0.875rem',
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? '#f0f0ff' : '#a0a0cc'
                        }}
                      />
                    )}
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

        {/* User info */}
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{
            width: 36, height: 36,
            background: getUserColor(user.name),
            fontSize: '0.8rem', fontWeight: 600
          }}>
            {getInitials(user.name)}
          </Avatar>
          {drawerOpen && (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }} noWrap>
                {user.name || 'User'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#6b6b99', fontSize: '0.7rem' }} noWrap>
                {user.email}
              </Typography>
            </Box>
          )}
          {drawerOpen && (
            <Tooltip title="Logout">
              <IconButton onClick={handleLogout} size="small" sx={{ color: '#6b6b99' }}>
                <Logout fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Drawer>

      {/* Main content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        {/* Top bar */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            background: 'rgba(10, 10, 26, 0.6)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          <Toolbar sx={{ gap: 2 }}>
            <IconButton
              onClick={() => setDrawerOpen(!drawerOpen)}
              sx={{ color: '#a0a0cc' }}
            >
              {drawerOpen ? <ChevronLeft /> : <MenuIcon />}
            </IconButton>

            <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
              {navItems.find(n => n.path === location.pathname)?.label || 'Dashboard'}
            </Typography>

            <Chip
              label="Flatmates"
              size="small"
              sx={{
                background: 'rgba(99,102,241,0.15)',
                color: '#818cf8',
                fontWeight: 600,
                border: '1px solid rgba(99,102,241,0.2)'
              }}
            />
          </Toolbar>
        </AppBar>

        {/* Page content */}
        <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
