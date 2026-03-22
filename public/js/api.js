/**
 * API Client - Replaces google.script.run wrapper
 * Uses fetch() to communicate with Express backend
 */

// Auth token management
let _authToken = localStorage.getItem('gearbase_token') || null;

function setAuthToken(token) {
  _authToken = token;
  if (token) localStorage.setItem('gearbase_token', token);
  else localStorage.removeItem('gearbase_token');
}

function getAuthToken() { return _authToken; }

async function apiFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (_authToken) headers['Authorization'] = 'Bearer ' + _authToken;

  const startTime = Date.now();
  const logEntry = { fn: options.method || 'GET', url, time: startTime, status: 'pending' };
  _apiLogEntry(logEntry);

  showLoading(true);
  try {
    const resp = await fetch(url, { ...options, headers });
    const data = await resp.json();
    showLoading(false);

    logEntry.elapsed = Date.now() - startTime;

    if (!resp.ok) {
      logEntry.status = 'err';
      logEntry.error = data.error || resp.statusText;
      _apiMonitorRender();
      if (resp.status === 401) {
        // Token expired or invalid
        setAuthToken(null);
        if (!url.includes('/api/auth/')) {
          window.location.href = '/';
        }
      }
      throw new Error(data.error || resp.statusText);
    }

    logEntry.status = 'ok';
    logEntry.result = data;
    _apiMonitorRender();
    return data;
  } catch (err) {
    showLoading(false);
    logEntry.status = 'err';
    logEntry.error = err.message;
    logEntry.elapsed = Date.now() - startTime;
    _apiMonitorRender();
    throw err;
  }
}

function apiGet(url) { return apiFetch(url); }
function apiPost(url, body) { return apiFetch(url, { method: 'POST', body: JSON.stringify(body) }); }
function apiPut(url, body) { return apiFetch(url, { method: 'PUT', body: JSON.stringify(body) }); }
function apiDelete(url) { return apiFetch(url, { method: 'DELETE' }); }

// ==================== API Object (drop-in replacement) ====================

const API = {
  // Equipment Types
  getEquipmentTypes: () => apiGet('/api/equipment/types'),
  createEquipmentType: (data) => apiPost('/api/equipment/types', data),
  updateEquipmentType: (id, data) => apiPut(`/api/equipment/types/${id}`, data),
  deleteEquipmentType: (id) => apiDelete(`/api/equipment/types/${id}`),

  // Equipment Units
  getEquipmentUnits: (filters) => apiGet('/api/equipment/units' + toQuery(filters)),
  createEquipmentUnit: (data) => apiPost('/api/equipment/units', data),
  updateEquipmentUnit: (id, data) => apiPut(`/api/equipment/units/${id}`, data),
  deleteEquipmentUnit: (id) => apiDelete(`/api/equipment/units/${id}`),

  // Customers
  getCustomers: (filters) => apiGet('/api/customers' + toQuery(filters)),
  createCustomer: (data) => apiPost('/api/customers', data),
  updateCustomer: (id, data) => apiPut(`/api/customers/${id}`, data),
  deleteCustomer: (id) => apiDelete(`/api/customers/${id}`),

  // Rentals
  getRentals: (filters) => apiGet('/api/rentals' + toQuery(filters)),
  createRental: (data) => apiPost('/api/rentals', data),
  updateRental: (id, data) => apiPut(`/api/rentals/${id}`, data),
  getRentalItems: (rentalId) => apiGet(`/api/rentals/${rentalId}/items`),
  createRentalItem: (data) => apiPost(`/api/rentals/${data.rental_id}/items`, data),
  updateRentalItem: (id, data) => apiPut(`/api/rentals/items/${id}`, data),
  advanceRentalStatus: (rentalId, newStatus, metadata) => apiPost(`/api/rentals/${rentalId}/status`, { status: newStatus, ...metadata }),
  calculateRentalBreakdown: (rentalId) => apiGet(`/api/rentals/${rentalId}/breakdown`),
  recalculateAndUpdateRental: (rentalId) => apiPost(`/api/rentals/${rentalId}/recalculate`),
  getOverdueRentals: () => apiGet('/api/rentals/status/overdue'),
  calculateRentalTotal: (rentalId) => apiGet(`/api/rentals/${rentalId}/breakdown`),

  // Service Items
  getServiceItems: (rentalId) => apiGet(`/api/rentals/${rentalId}/services`),
  createServiceItem: (data) => apiPost(`/api/rentals/${data.rental_id}/services`, data),
  updateServiceItem: (id, data) => apiPut(`/api/rentals/items/${id}`, data),
  deleteServiceItem: (id) => apiDelete(`/api/rentals/items/${id}`),

  // Rental Addendums
  getRentalAddendums: (rentalId) => apiGet(`/api/rentals/${rentalId}/addendums`),
  createRentalAddendum: (data) => apiPost(`/api/rentals/${data.rental_id}/addendums`, data),

  // Payments
  getPayments: (filters) => apiGet('/api/payments' + toQuery(filters)),
  createPayment: (data) => apiPost('/api/payments', data),

  // Maintenance
  getMaintenanceLogs: (filters) => apiGet('/api/maintenance-logs' + toQuery(filters)),
  createMaintenanceLog: (data) => apiPost('/api/maintenance-logs', data),

  // Inventory
  getInventoryLogs: (filters) => apiGet('/api/inventory-logs' + toQuery(filters)),
  createInventoryLog: (data) => apiPost('/api/inventory-logs', data),

  // Stocktake
  getStocktakePlans: (filters) => apiGet('/api/stocktake-plans' + toQuery(filters)),
  createStocktakePlan: (data) => apiPost('/api/stocktake-plans', data),
  getStocktakeResults: (planId) => apiGet('/api/stocktake-results' + toQuery({ plan_id: planId })),
  createStocktakeResult: (data) => apiPost('/api/stocktake-results', data),

  // Staff
  getStaff: (filters) => apiGet('/api/staff' + toQuery(filters)),
  createStaff: (data) => apiPost('/api/staff', data),
  updateStaff: (id, data) => apiPut(`/api/staff/${id}`, data),
  deleteStaff: (id) => apiDelete(`/api/staff/${id}`),
  getRolePermissions: () => apiGet('/api/staff/roles'),

  // Dashboard
  getDashboardStats: () => apiGet('/api/dashboard/stats'),
  getActivityLogs: (filters) => apiGet('/api/dashboard/activity-logs' + toQuery(filters)),
  getRecentActivityLogs: (limit) => apiGet(`/api/dashboard/activity-logs?limit=${limit || 50}`),
  logActivity: (action, targetType, targetId, desc) => apiPost('/api/dashboard/activity-logs', { action, target_type: targetType, target_id: targetId, description: desc }),

  // Auth
  getCurrentUserInfo: () => apiGet('/api/auth/me'),
  getCustomerAppUrl: () => Promise.resolve(window.location.origin + '/customer'),

  // Storage Locations
  getStorageLocations: (filters) => apiGet('/api/storage-locations' + toQuery(filters)),
  createStorageLocation: (data) => apiPost('/api/storage-locations', data),

  // Discount Rules
  getDiscountRules: (filters) => apiGet('/api/discount-rules' + toQuery(filters)),
  createDiscountRule: (data) => apiPost('/api/discount-rules', data),

  // Accessory Bindings
  getAccessoryBindings: (filters) => apiGet('/api/accessory-bindings' + toQuery(filters)),
  createAccessoryBinding: (data) => apiPost('/api/accessory-bindings', data),

  // Overdue & Wear Rules
  getOverdueRules: (filters) => apiGet('/api/overdue-rules' + toQuery(filters)),
  createOverdueRule: (data) => apiPost('/api/overdue-rules', data),
  getWearTolerance: (filters) => apiGet('/api/wear-tolerance' + toQuery(filters)),
  createWearTolerance: (data) => apiPost('/api/wear-tolerance', data),

  // Print Templates
  getPrintTemplates: (filters) => apiGet('/api/print-templates' + toQuery(filters)),
  createPrintTemplate: (data) => apiPost('/api/print-templates', data),

  // Damage Records
  getDamageRecords: (filters) => apiGet('/api/damage-records' + toQuery(filters)),
  createDamageRecord: (data) => apiPost('/api/damage-records', data),

  // Credit Notes
  getCreditNotes: (filters) => apiGet('/api/credit-notes' + toQuery(filters)),
  createCreditNote: (data) => apiPost('/api/credit-notes', data),

  // Search & Catalog
  searchEquipment: (query) => apiGet(`/api/equipment/search?q=${encodeURIComponent(query)}`),
  getAvailableEquipment: (startDate, endDate) => apiGet(`/api/equipment/units?status=available`),
  getEquipmentCatalog: () => apiGet('/api/equipment/catalog'),

  // Check-in/out
  processEquipmentCheckIn: (data) => apiPost('/api/dashboard/check-in', data),

  // Venues
  getVenues: (filters) => apiGet('/api/venues' + toQuery(filters)),
  createVenue: (data) => apiPost('/api/venues', data),
  updateVenue: (id, data) => apiPut(`/api/venues/${id}`, data),
  deleteVenue: (id) => apiDelete(`/api/venues/${id}`),
  getActiveVenues: () => apiGet('/api/venues/active'),
  searchVenues: (query) => apiGet(`/api/venues/search?q=${encodeURIComponent(query)}`),
  getAvailableVenues: (start, end) => apiGet(`/api/venues/availability?start=${start}&end=${end}`),

  // Venue Bookings
  getVenueBookings: (filters) => apiGet('/api/venues/bookings' + toQuery(filters)),
  createVenueBooking: (data) => apiPost('/api/venues/bookings', data),
  updateVenueBooking: (id, data) => apiPut(`/api/venues/bookings/${id}`, data),
  deleteVenueBooking: (id) => apiDelete(`/api/venues/bookings/${id}`),
  advanceVenueBookingStatus: (id, status, meta) => apiPost(`/api/venues/bookings/${id}/status`, { status, ...meta }),
  calculateVenueBookingBreakdown: (id) => apiGet(`/api/venues/bookings/${id}/breakdown`),
  checkVenueAvailability: (venueId, start, end, excludeId) => apiGet(`/api/venues/availability?venue_id=${venueId}&start=${start}&end=${end}${excludeId ? '&exclude=' + excludeId : ''}`),
  getVenueSchedule: (venueId, start, end) => apiGet(`/api/venues/bookings?venue_id=${venueId}`),
  getVenueMonthlySchedule: (venueId, yearMonth) => apiGet(`/api/venues/${venueId}/schedule?yearMonth=${yearMonth}`),

  // Schedule / Calendar
  getScheduleData: (startDate, endDate) => apiGet(`/api/dashboard/schedule?start=${startDate}&end=${endDate}`),

  // Receipt / Print
  generateRentalReceipt: (rentalId) => apiGet(`/api/dashboard/receipt/rental/${rentalId}`),
  generateVenueBookingReceipt: (bookingId) => apiGet(`/api/dashboard/receipt/venue/${bookingId}`),

  // QR Code
  getEquipmentQRData: (unitId) => apiGet(`/api/equipment/qr/${unitId}`),
  getEquipmentQRBatch: (unitIds) => apiPost('/api/equipment/qr/batch', { unitIds }),

  // Email (handled server-side, stub for now)
  sendRentalConfirmationEmail: (rentalId) => apiPost(`/api/email/rental-confirm/${rentalId}`),
  sendVenueBookingConfirmationEmail: (bookingId) => apiPost(`/api/email/booking-confirm/${bookingId}`),
  sendReturnReminderEmail: (rentalId) => apiPost(`/api/email/return-reminder/${rentalId}`),
  sendOverdueNoticeEmail: (rentalId) => apiPost(`/api/email/overdue-notice/${rentalId}`),

  // Debug (no-ops for Railway version)
  debugCheckSheets: () => Promise.resolve({ message: 'PostgreSQL 環境不需要此功能' }),
  debugHealthCheck: () => apiGet('/health'),
  ensureRequiredSheets: () => Promise.resolve({ message: 'PostgreSQL 環境不需要此功能' }),
  debugCall: () => Promise.resolve({ message: 'PostgreSQL 環境不需要此功能' }),
  validateDatabaseSchema: () => Promise.resolve({ message: 'PostgreSQL 環境不需要此功能' }),
  repairDatabaseSchema: () => Promise.resolve({ message: 'PostgreSQL 環境不需要此功能' }),
  debugDiagnoseData: () => Promise.resolve({ message: 'PostgreSQL 環境不需要此功能' }),
  getRecentErrors: () => Promise.resolve([]),
  clearOldErrors: () => Promise.resolve({ cleared: 0 }),

  // Customer-facing
  sendLookupVerificationCode: (email) => apiPost('/api/customer/send-code', { email }),
  verifyAndLookup: (email, code) => apiPost('/api/customer/verify', { email, code }),
};

// Helper: convert filters object to query string
function toQuery(filters) {
  if (!filters || typeof filters !== 'object') return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  }
  const qs = params.toString();
  return qs ? '?' + qs : '';
}
