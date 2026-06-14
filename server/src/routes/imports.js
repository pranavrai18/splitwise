const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { createAuditLog } = require('../middleware/audit');
const { processImport, commitImport } = require('../services/importEngine');

const router = express.Router();

// Configure multer for CSV upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

/**
 * POST /api/groups/:id/imports
 * Upload CSV and start import process
 */
router.post('/:id/imports', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required.' });
    }

    // Read the CSV file
    const csvContent = fs.readFileSync(req.file.path, 'utf-8');

    // Create import record
    const importRecord = await prisma.import.create({
      data: {
        groupId: req.params.id,
        uploadedById: req.user.id,
        filename: req.file.originalname,
        status: 'parsing'
      }
    });

    // Process the import (parse + detect anomalies)
    const result = await processImport(importRecord.id, csvContent, req.params.id, req.user.id);

    await createAuditLog({
      userId: req.user.id,
      groupId: req.params.id,
      entityType: 'import',
      entityId: importRecord.id,
      action: 'create',
      afterData: { filename: req.file.originalname, ...result }
    });

    // Fetch the full import with anomalies
    const fullImport = await prisma.import.findUnique({
      where: { id: importRecord.id },
      include: {
        anomalies: { orderBy: { rowNumber: 'asc' } }
      }
    });

    res.status(201).json(fullImport);
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: error.message || 'Import failed.' });
  }
});

/**
 * GET /api/groups/:groupId/imports/:id
 * Get import status with anomalies
 */
router.get('/:groupId/imports/:id', authenticate, async (req, res) => {
  try {
    const importRecord = await prisma.import.findUnique({
      where: { id: req.params.id },
      include: {
        anomalies: { orderBy: { rowNumber: 'asc' } },
        uploadedBy: { select: { id: true, name: true } }
      }
    });

    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found.' });
    }

    res.json(importRecord);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch import.' });
  }
});

/**
 * PUT /api/groups/:groupId/imports/:importId/anomalies/:anomalyId
 * Update user decision on an anomaly
 */
router.put('/:groupId/imports/:importId/anomalies/:anomalyId', authenticate, async (req, res) => {
  try {
    const { userDecision, correctedData } = req.body;

    if (!userDecision) {
      return res.status(400).json({ error: 'userDecision is required.' });
    }

    const validDecisions = ['accept', 'ignore', 'merge', 'reject', 'convert', 'update_currency', 'update_date'];
    if (!validDecisions.includes(userDecision)) {
      return res.status(400).json({ error: `Invalid decision. Must be one of: ${validDecisions.join(', ')}` });
    }

    const anomaly = await prisma.importAnomaly.update({
      where: { id: req.params.anomalyId },
      data: {
        userDecision,
        ...(correctedData && { correctedData }),
        resolvedAt: new Date()
      }
    });

    res.json(anomaly);
  } catch (error) {
    console.error('Update anomaly error:', error);
    res.status(500).json({ error: 'Failed to update anomaly.' });
  }
});

/**
 * POST /api/groups/:groupId/imports/:id/approve
 * Approve and commit the import
 */
router.post('/:groupId/imports/:id/approve', authenticate, async (req, res) => {
  try {
    const result = await commitImport(req.params.id, req.params.groupId, req.user.id);

    await createAuditLog({
      userId: req.user.id,
      groupId: req.params.groupId,
      entityType: 'import',
      entityId: req.params.id,
      action: 'approve',
      afterData: result
    });

    res.json({
      message: 'Import committed successfully.',
      ...result
    });
  } catch (error) {
    console.error('Approve import error:', error);
    res.status(500).json({ error: error.message || 'Failed to commit import.' });
  }
});

module.exports = router;
