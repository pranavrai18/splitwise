import { useState, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Stepper, Step, StepLabel,
  Alert, Chip, CircularProgress, Divider, IconButton, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem
} from '@mui/material';
import {
  CloudUpload, CheckCircle, Warning, Error as ErrorIcon,
  ThumbUp, ThumbDown, MergeType, Delete, ArrowForward, Info
} from '@mui/icons-material';
import { importService } from '../services';
import { getSeverityColor } from '../utils/helpers';

const STEPS = ['Upload CSV', 'Parse & Validate', 'Review Anomalies', 'Approve & Commit'];

const DECISION_OPTIONS = [
  { value: 'accept', label: 'Accept Fix', icon: <ThumbUp fontSize="small" />, color: '#22c55e' },
  { value: 'reject', label: 'Skip Row', icon: <ThumbDown fontSize="small" />, color: '#ef4444' },
  { value: 'ignore', label: 'Keep As-Is', icon: <Info fontSize="small" />, color: '#f59e0b' },
  { value: 'convert', label: 'Convert', icon: <MergeType fontSize="small" />, color: '#06b6d4' }
];

export default function ImportWizardPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState(null);
  const [importData, setImportData] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [commitResult, setCommitResult] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const groupId = 'flatmates-group-001';

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (selected && (selected.type === 'text/csv' || selected.name.endsWith('.csv'))) {
      setFile(selected);
      setError('');
    } else {
      setError('Please select a CSV file.');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError('');

    try {
      const { data } = await importService.upload(groupId, file);
      setImportData(data);
      setAnomalies(data.anomalies || []);
      setActiveStep(data.anomalyCount > 0 ? 2 : 3);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (anomalyId, decision) => {
    try {
      await importService.updateAnomaly(groupId, importData.id, anomalyId, {
        userDecision: decision
      });
      setAnomalies(prev => prev.map(a =>
        a.id === anomalyId ? { ...a, userDecision: decision } : a
      ));
    } catch (err) {
      console.error('Decision update error:', err);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const { data } = await importService.approve(groupId, importData.id);
      setCommitResult(data);
      setActiveStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Commit failed.');
    } finally {
      setLoading(false);
    }
  };

  const unresolvedCount = anomalies.filter(a => !a.userDecision).length;
  const criticalCount = anomalies.filter(a => a.severity === 'critical').length;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>Import CSV</Typography>

      {/* Stepper */}
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel sx={{
              '& .MuiStepLabel-label': { color: '#a0a0cc', fontWeight: 500, fontSize: '0.85rem' },
              '& .MuiStepLabel-label.Mui-active': { color: '#f0f0ff' },
              '& .MuiStepLabel-label.Mui-completed': { color: '#22c55e' }
            }}>
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {/* Step 0 & 1: Upload */}
      {activeStep <= 1 && (
        <Card className="fade-in-up">
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <input
              type="file" accept=".csv" ref={fileInputRef}
              onChange={handleFileSelect} style={{ display: 'none' }}
            />

            <Box
              onClick={() => fileInputRef.current?.click()}
              sx={{
                p: 6, border: '2px dashed rgba(99,102,241,0.3)',
                borderRadius: 3, cursor: 'pointer',
                background: 'rgba(99,102,241,0.04)',
                transition: 'all 250ms ease',
                '&:hover': {
                  borderColor: 'rgba(99,102,241,0.6)',
                  background: 'rgba(99,102,241,0.08)'
                }
              }}
            >
              <CloudUpload sx={{ fontSize: 48, color: '#818cf8', mb: 2 }} />
              <Typography variant="h6" fontWeight={600}>
                {file ? file.name : 'Click to upload CSV'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Supports Splitwise export format'}
              </Typography>
            </Box>

            {file && (
              <Button
                variant="contained" size="large" onClick={handleUpload}
                disabled={loading} sx={{ mt: 3, px: 5 }}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : 'Upload & Analyze'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Review Anomalies — Meera's Approval Queue */}
      {activeStep === 2 && (
        <Box className="fade-in-up">
          {/* Summary Bar */}
          <Card sx={{ mb: 2.5 }}>
            <CardContent sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="body1" fontWeight={600} sx={{ flex: 1 }}>
                {importData?.totalRows} rows parsed • {anomalies.length} anomalies detected
              </Typography>
              <Chip icon={<ErrorIcon />} label={`${criticalCount} critical`} color="error" size="small" variant="outlined" />
              <Chip label={`${unresolvedCount} unresolved`} color="warning" size="small" variant="outlined" />
              <Button
                variant="contained" onClick={handleApprove}
                disabled={loading || unresolvedCount > 0}
                startIcon={loading ? <CircularProgress size={16} /> : <CheckCircle />}
              >
                {unresolvedCount > 0 ? `Resolve ${unresolvedCount} remaining` : 'Approve & Import'}
              </Button>
            </CardContent>
          </Card>

          {/* Anomaly Cards */}
          <Box className="stagger-children">
            {anomalies.map((anomaly) => (
              <Card key={anomaly.id} sx={{
                mb: 1.5,
                borderLeft: `4px solid ${
                  anomaly.severity === 'critical' ? '#ef4444' :
                  anomaly.severity === 'medium' ? '#f59e0b' : '#06b6d4'
                }`,
                opacity: anomaly.userDecision ? 0.7 : 1,
                transition: 'all 250ms ease'
              }}>
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Chip
                          label={anomaly.severity}
                          size="small"
                          color={getSeverityColor(anomaly.severity)}
                          sx={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' }}
                        />
                        <Chip
                          label={`Row ${anomaly.rowNumber}`}
                          size="small" variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                        <Chip
                          label={anomaly.type.replace(/_/g, ' ')}
                          size="small"
                          sx={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.06)' }}
                        />
                        {anomaly.userDecision && (
                          <Chip
                            label={anomaly.userDecision}
                            size="small"
                            color="success"
                            sx={{ fontSize: '0.7rem', fontWeight: 600 }}
                          />
                        )}
                      </Box>

                      <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
                        {anomaly.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        💡 Suggested: {anomaly.suggestedAction}
                      </Typography>
                    </Box>

                    {/* Decision Buttons */}
                    {!anomaly.userDecision && (
                      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                        {DECISION_OPTIONS.map(opt => (
                          <Button
                            key={opt.value}
                            size="small"
                            variant="outlined"
                            startIcon={opt.icon}
                            onClick={() => handleDecision(anomaly.id, opt.value)}
                            sx={{
                              fontSize: '0.7rem', borderColor: `${opt.color}40`,
                              color: opt.color, minWidth: 'auto', px: 1.5,
                              '&:hover': { borderColor: opt.color, background: `${opt.color}10` }
                            }}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      )}

      {/* Step 3: Committed */}
      {activeStep === 3 && commitResult && (
        <Card className="fade-in-up">
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <CheckCircle sx={{ fontSize: 64, color: '#22c55e', mb: 2 }} />
            <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>Import Complete!</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Your CSV has been successfully imported.
            </Typography>

            <Box sx={{
              display: 'inline-flex', gap: 3, p: 3, borderRadius: 2,
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)'
            }}>
              <Box>
                <Typography variant="h4" fontWeight={700} color="success.main">
                  {commitResult.expensesCreated}
                </Typography>
                <Typography variant="caption" color="text.secondary">Expenses</Typography>
              </Box>
              <Divider orientation="vertical" flexItem />
              <Box>
                <Typography variant="h4" fontWeight={700} color="info.main">
                  {commitResult.settlementsCreated}
                </Typography>
                <Typography variant="caption" color="text.secondary">Settlements</Typography>
              </Box>
              <Divider orientation="vertical" flexItem />
              <Box>
                <Typography variant="h4" fontWeight={700} color="warning.main">
                  {commitResult.skipped}
                </Typography>
                <Typography variant="caption" color="text.secondary">Skipped</Typography>
              </Box>
            </Box>

            {commitResult.errors?.length > 0 && (
              <Alert severity="warning" sx={{ mt: 3, borderRadius: 2, textAlign: 'left' }}>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                  {commitResult.errors.length} rows had errors:
                </Typography>
                {commitResult.errors.map((e, i) => (
                  <Typography key={i} variant="caption" sx={{ display: 'block' }}>
                    Row {e.rowNumber}: {e.error}
                  </Typography>
                ))}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
