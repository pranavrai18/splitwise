const prisma = require('../utils/prisma');

/**
 * Create an audit log entry for any mutation.
 * 
 * @param {object} params
 * @param {string} params.userId - Who performed the action
 * @param {string} params.groupId - Which group context
 * @param {string} params.entityType - 'expense' | 'settlement' | 'membership' | 'group' | 'import'
 * @param {string} params.entityId - ID of the entity
 * @param {string} params.action - 'create' | 'update' | 'delete' | 'import' | 'approve'
 * @param {object} [params.beforeData] - State before change
 * @param {object} [params.afterData] - State after change
 */
async function createAuditLog({ userId, groupId, entityType, entityId, action, beforeData, afterData }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        groupId: groupId || null,
        entityType,
        entityId,
        action,
        beforeData: beforeData || undefined,
        afterData: afterData || undefined,
      }
    });
  } catch (error) {
    // Audit logging should never break the main flow
    console.error('Failed to create audit log:', error.message);
  }
}

module.exports = { createAuditLog };
