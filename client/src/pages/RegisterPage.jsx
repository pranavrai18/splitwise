import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, CircularProgress, InputAdornment, IconButton
} from '@mui/material';
import { Email, Lock, Visibility, VisibilityOff, Person } from '@mui/icons-material';
import { authService } from '../services';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await authService.register({ name, email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify({ id: data.id, name: data.name, email: data.email }));
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.15) 0%, transparent 60%)',
      position: 'relative', overflow: 'hidden'
    }}>
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <Card className="fade-in-up" sx={{ width: '100%', maxWidth: 420, mx: 2, position: 'relative', zIndex: 1 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box sx={{
              width: 56, height: 56, borderRadius: '16px', mx: 'auto', mb: 2,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem', fontWeight: 800,
              boxShadow: '0 8px 30px rgba(99,102,241,0.4)'
            }}>
              S
            </Box>
            <Typography variant="h5" fontWeight={700}>Create Account</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Join your flatmates' expense tracker
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

          <form onSubmit={handleRegister}>
            <TextField
              fullWidth label="Full Name" value={name}
              onChange={e => setName(e.target.value)} required sx={{ mb: 2 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Person sx={{ color: '#6b6b99' }} /></InputAdornment>
              }}
            />
            <TextField
              fullWidth label="Email" type="email" value={email}
              onChange={e => setEmail(e.target.value)} required sx={{ mb: 2 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Email sx={{ color: '#6b6b99' }} /></InputAdornment>
              }}
            />
            <TextField
              fullWidth label="Password" type={showPassword ? 'text' : 'password'}
              value={password} onChange={e => setPassword(e.target.value)} required
              helperText="At least 6 characters" sx={{ mb: 3 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Lock sx={{ color: '#6b6b99' }} /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                      {showPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            <Button type="submit" fullWidth variant="contained" size="large" disabled={loading}
              sx={{ py: 1.5, fontSize: '0.95rem' }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Create Account'}
            </Button>
          </form>

          <Typography variant="body2" sx={{ textAlign: 'center', mt: 3, color: '#a0a0cc' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 600 }}>
              Sign in
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
