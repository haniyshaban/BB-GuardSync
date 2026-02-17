// Payroll Routes - Generate, view, export
const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../auth');

const router = express.Router();

// POST /api/payroll/generate - Generate payroll for a month
router.post('/generate', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { month, year, guardIds } = req.body;

    if (!month || !year) {
      return res.status(400).json({ success: false, error: 'Month and year are required' });
    }

    // Get guards to generate payroll for
    let guards;
    if (guardIds && guardIds.length > 0) {
      const placeholders = guardIds.map(() => '?').join(',');
      guards = db.prepare(`SELECT * FROM guards WHERE id IN (${placeholders}) AND approval_status = 'active'`).all(...guardIds);
    } else {
      guards = db.prepare("SELECT * FROM guards WHERE approval_status = 'active'").all();
    }

    const results = [];
    const upsert = db.prepare(`
      INSERT INTO payroll (guard_id, guard_name, month, year, total_days_worked, daily_rate, gross_pay, deductions, net_pay, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
      ON CONFLICT(guard_id, month, year) DO UPDATE SET 
        total_days_worked = excluded.total_days_worked,
        daily_rate = excluded.daily_rate,
        gross_pay = excluded.gross_pay,
        net_pay = excluded.net_pay,
        generated_at = datetime('now')
    `);

    const monthStr = String(month).padStart(2, '0');
    const dateFrom = `${year}-${monthStr}-01`;
    const dateTo = `${year}-${monthStr}-31`;

    for (const guard of guards) {
      // Count distinct days worked in the month
      const attendance = db.prepare(`
        SELECT COUNT(DISTINCT date) as days_worked 
        FROM guard_attendance 
        WHERE guard_id = ? AND date >= ? AND date <= ? AND clock_out IS NOT NULL
      `).get(guard.id, dateFrom, dateTo);

      const daysWorked = attendance?.days_worked || 0;
      const dailyRate = guard.daily_rate || 0;
      const grossPay = daysWorked * dailyRate;
      const deductions = 0; // Can be customized
      const netPay = grossPay - deductions;

      upsert.run(guard.id, guard.name, month, year, daysWorked, dailyRate, grossPay, deductions, netPay);
      results.push({ guardId: guard.id, guardName: guard.name, daysWorked, grossPay, netPay });
    }

    res.json({
      success: true,
      data: results,
      message: `Payroll generated for ${results.length} guards for ${monthStr}/${year}`
    });
  } catch (err) {
    console.error('Payroll generate error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate payroll' });
  }
});

// GET /api/payroll - List payroll records
router.get('/', authMiddleware, (req, res) => {
  try {
    const { month, year, guardId, status, page = 1, limit = 50 } = req.query;

    let sql = 'SELECT p.*, g.employee_id, s.name as site_name FROM payroll p LEFT JOIN guards g ON p.guard_id = g.id LEFT JOIN sites s ON g.site_id = s.id WHERE 1=1';
    const params = [];

    // Guards can only see their own payroll
    if (req.user.role === 'guard') {
      sql += ' AND p.guard_id = ?';
      params.push(req.user.id);
    }

    if (guardId) { sql += ' AND p.guard_id = ?'; params.push(guardId); }
    if (month) { sql += ' AND p.month = ?'; params.push(parseInt(month)); }
    if (year) { sql += ' AND p.year = ?'; params.push(parseInt(year)); }
    if (status) { sql += ' AND p.status = ?'; params.push(status); }

    const countSql = sql.replace(/SELECT p\.\*, g\.employee_id, s\.name as site_name FROM/, 'SELECT COUNT(*) as total FROM');
    const total = db.prepare(countSql).get(...params)?.total || 0;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ' ORDER BY p.year DESC, p.month DESC, p.guard_name ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const records = db.prepare(sql).all(...params);
    res.json({ success: true, data: records, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list payroll' });
  }
});

// GET /api/payroll/:guardId/:month/:year - Get specific payroll
router.get('/:guardId/:month/:year', authMiddleware, (req, res) => {
  try {
    const record = db.prepare(
      'SELECT * FROM payroll WHERE guard_id = ? AND month = ? AND year = ?'
    ).get(req.params.guardId, req.params.month, req.params.year);

    if (!record) return res.status(404).json({ success: false, error: 'Payroll record not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get payroll' });
  }
});

// PUT /api/payroll/:id - Update payroll status (approve/mark paid)
router.put('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { status, deductions } = req.body;
    
    if (status) {
      db.prepare('UPDATE payroll SET status = ? WHERE id = ?').run(status, req.params.id);
    }
    if (deductions != null) {
      const record = db.prepare('SELECT * FROM payroll WHERE id = ?').get(req.params.id);
      if (record) {
        const netPay = record.gross_pay - deductions;
        db.prepare('UPDATE payroll SET deductions = ?, net_pay = ? WHERE id = ?')
          .run(deductions, netPay, req.params.id);
      }
    }

    res.json({ success: true, message: 'Payroll updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update payroll' });
  }
});

// GET /api/payroll/export/:month/:year - Export payroll as CSV
router.get('/export/:month/:year', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const records = db.prepare(`
      SELECT p.*, g.employee_id, g.phone, s.name as site_name
      FROM payroll p 
      LEFT JOIN guards g ON p.guard_id = g.id 
      LEFT JOIN sites s ON g.site_id = s.id
      WHERE p.month = ? AND p.year = ?
      ORDER BY p.guard_name
    `).all(req.params.month, req.params.year);

    const headers = 'Guard Name,Employee ID,Phone,Site,Days Worked,Daily Rate,Gross Pay,Deductions,Net Pay,Status\n';
    const rows = records.map(r =>
      `"${r.guard_name}","${r.employee_id || ''}","${r.phone || ''}","${r.site_name || ''}",${r.total_days_worked},${r.daily_rate},${r.gross_pay},${r.deductions},${r.net_pay},"${r.status}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=payroll-${req.params.month}-${req.params.year}.csv`);
    res.send(headers + rows);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to export payroll' });
  }
});

module.exports = router;
