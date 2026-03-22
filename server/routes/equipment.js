const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { generateNextId, generateInternalCode } = require('../services/id-generator');

// GET /api/equipment/types
router.get('/types', requireAuth, async (req, res) => {
  try {
    const types = await db.getAll('Equipment_Types');
    res.json(types);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/equipment/types
router.post('/types', requireAuth, requirePermission('create'), async (req, res) => {
  try {
    const data = req.body;
    if ((!data.name && !data.type_name) || (data.type_name || data.name || '').trim() === '') {
      return res.status(400).json({ error: '器材類型名稱必填' });
    }
    if (!data.category) return res.status(400).json({ error: '分類必填' });
    if (!data.daily_rate || isNaN(parseFloat(data.daily_rate))) return res.status(400).json({ error: '日租價格必填且為正數' });

    data.type_id = await generateNextId('Equipment_Types', 'type_id', 'ET');
    data.name = data.name || data.type_name;
    data.created_by = req.user.staff_id;
    data.created_at = new Date();
    data.is_deleted = false;
    data.active = data.active !== undefined ? data.active : true;

    const result = await db.insert('Equipment_Types', data);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/equipment/types/:id
router.put('/types/:id', requireAuth, requirePermission('update'), async (req, res) => {
  try {
    const result = await db.update('Equipment_Types', 'type_id', req.params.id, req.body);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/equipment/types/:id
router.delete('/types/:id', requireAuth, requirePermission('delete'), async (req, res) => {
  try {
    await db.softDelete('Equipment_Types', 'type_id', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/equipment/units
router.get('/units', requireAuth, async (req, res) => {
  try {
    const units = await db.getFiltered('Equipment_Units', req.query);
    res.json(units);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/equipment/units
router.post('/units', requireAuth, requirePermission('create'), async (req, res) => {
  try {
    const data = req.body;
    if (!data.type_id) return res.status(400).json({ error: '器材類型必填' });
    if (!data.category) return res.status(400).json({ error: '分類必填' });

    data.internal_code = await generateInternalCode(data.category);
    data.unit_id = await generateNextId('Equipment_Units', 'unit_id', 'EU');
    data.created_at = new Date();
    data.is_deleted = false;
    data.status = 'available';
    data.current_condition = data.current_condition || 'good';
    data.created_by = req.user.staff_id;

    const result = await db.insert('Equipment_Units', data);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/equipment/units/:id
router.put('/units/:id', requireAuth, requirePermission('update'), async (req, res) => {
  try {
    const result = await db.update('Equipment_Units', 'unit_id', req.params.id, req.body);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/equipment/units/:id
router.delete('/units/:id', requireAuth, requirePermission('delete'), async (req, res) => {
  try {
    await db.softDelete('Equipment_Units', 'unit_id', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/equipment/search?q=...
router.get('/search', requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase();
    const types = (await db.getAll('Equipment_Types')).filter(t =>
      (t.type_name && t.type_name.toLowerCase().includes(q)) ||
      (t.category && t.category.toLowerCase().includes(q))
    );
    const units = (await db.getAll('Equipment_Units')).filter(u =>
      (u.internal_code && u.internal_code.toLowerCase().includes(q)) ||
      (u.serial_number && u.serial_number.toLowerCase().includes(q))
    );
    res.json({ types, units });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/equipment/catalog (public for customer app)
router.get('/catalog', async (req, res) => {
  try {
    const types = (await db.getAll('Equipment_Types')).filter(t => t.active !== false);
    const units = await db.getAll('Equipment_Units');
    const bindings = await db.getAll('Accessory_Bindings');

    const catalog = types.map(type => {
      const typeUnits = units.filter(u => u.type_id === type.type_id);
      const available = typeUnits.filter(u => u.status === 'available').length;
      const accessories = bindings
        .filter(b => b.parent_type_id === type.type_id)
        .map(b => {
          const accType = types.find(t => t.type_id === b.accessory_type_id);
          return { type_id: b.accessory_type_id, type_name: accType ? accType.type_name : b.accessory_type_id, binding_type: b.binding_type, notes: b.notes || '' };
        });

      return {
        type_id: type.type_id, type_name: type.type_name, category: type.category || '',
        sub_category: type.sub_category || '', brand: type.brand || '', model: type.model || '',
        daily_rate: parseFloat(type.daily_rate || 0), replacement_value: parseFloat(type.replacement_value || 0),
        deposit_required: parseFloat(type.deposit_required || 0),
        is_consumable: type.is_consumable === true, description: type.description || '',
        total_units: typeUnits.length, available_units: available, accessories,
      };
    });

    res.json(catalog);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/equipment/qr/:unitId
router.get('/qr/:unitId', requireAuth, async (req, res) => {
  try {
    const units = await db.getFiltered('Equipment_Units', { unit_id: req.params.unitId });
    const unit = units[0];
    if (!unit) return res.status(404).json({ error: '找不到器材' });

    const types = await db.getFiltered('Equipment_Types', { type_id: unit.type_id });
    const type = types[0] || {};
    const locations = unit.location_id ? await db.getFiltered('Storage_Locations', { location_id: unit.location_id }) : [];
    const location = locations[0] || {};

    const qrData = JSON.stringify({ id: unit.unit_id, code: unit.internal_code, type: type.type_name || unit.type_id, sn: unit.serial_number || '' });

    res.json({
      unit_id: unit.unit_id, internal_code: unit.internal_code || unit.unit_id,
      type_name: type.type_name || unit.type_id, category: type.category || '',
      serial_number: unit.serial_number || '', status: unit.status,
      location_name: location.location_name || '', daily_rate: parseFloat(type.daily_rate || 0),
      replacement_value: parseFloat(type.replacement_value || 0),
      qr_url: 'https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=' + encodeURIComponent(qrData),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/equipment/qr/batch
router.post('/qr/batch', requireAuth, async (req, res) => {
  try {
    const { unitIds } = req.body;
    const allUnits = await db.getAll('Equipment_Units');
    const types = await db.getAll('Equipment_Types');
    const locations = await db.getAll('Storage_Locations');
    const typeMap = {}; types.forEach(t => { typeMap[t.type_id] = t; });
    const locMap = {}; locations.forEach(l => { locMap[l.location_id] = l; });

    let targetUnits = allUnits;
    if (unitIds && unitIds.length > 0) targetUnits = allUnits.filter(u => unitIds.includes(u.unit_id));

    const results = targetUnits.map(unit => {
      const type = typeMap[unit.type_id] || {};
      const loc = locMap[unit.location_id] || {};
      const qrData = JSON.stringify({ id: unit.unit_id, code: unit.internal_code, type: type.type_name || unit.type_id, sn: unit.serial_number || '' });
      return {
        unit_id: unit.unit_id, internal_code: unit.internal_code || unit.unit_id,
        type_name: type.type_name || unit.type_id, category: type.category || '',
        serial_number: unit.serial_number || '', daily_rate: parseFloat(type.daily_rate || 0),
        location_name: loc.location_name || '',
        qr_url: 'https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=' + encodeURIComponent(qrData),
      };
    });
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
