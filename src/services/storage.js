import { openDB } from 'idb';

const DB_NAME = 'erpnext-pos-db';
const DB_VERSION = 2;

// Initialize IndexedDB
export const initDB = async () => {
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Products store
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', { keyPath: 'item_code' });
        productStore.createIndex('name', 'item_name', { unique: false });
      }
      
      // Customers store
      if (!db.objectStoreNames.contains('customers')) {
        const customerStore = db.createObjectStore('customers', { keyPath: 'name' });
        customerStore.createIndex('customer_name', 'customer_name', { unique: false });
      }
      
      // Sales Invoices store (for offline invoices)
      if (!db.objectStoreNames.contains('salesInvoices')) {
        const invoiceStore = db.createObjectStore('salesInvoices', { keyPath: 'id', autoIncrement: true });
        invoiceStore.createIndex('timestamp', 'timestamp', { unique: false });
        invoiceStore.createIndex('synced', 'synced', { unique: false });
      }
      
      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      
      // Sync Queue store (for queuing operations when offline)
      if (!db.objectStoreNames.contains('syncQueue')) {
        const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        queueStore.createIndex('type', 'type', { unique: false });
        queueStore.createIndex('status', 'status', { unique: false });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    },
  });
  return db;
};

// Products operations
export const saveProducts = async (products) => {
  const db = await initDB();
  const tx = db.transaction('products', 'readwrite');
  const store = tx.objectStore('products');
  
  for (const product of products) {
    await store.put({
      item_code: product.item_code,
      item_name: product.item_name,
      description: product.description || '',
      actual_qty: (product.actual_qty ?? product.qty ?? 0),
      rate: product.standard_rate || product.rate || 0,
      stock_uom: product.stock_uom || 'Nos',
      image: product.image || null,
      item_tax_template: product.item_tax_template || null,
      tax_category: product.tax_category || null,
      last_synced: new Date().toISOString(),
    });
  }
  
  await tx.done;
};

export const getProducts = async () => {
  const db = await initDB();
  return await db.getAll('products');
};

export const searchProducts = async (searchTerm) => {
  const db = await initDB();
  const products = await db.getAll('products');
  const term = searchTerm.toLowerCase();
  return products.filter(p => 
    p.item_name.toLowerCase().includes(term) ||
    p.item_code.toLowerCase().includes(term)
  );
};

// Customers operations
export const saveCustomers = async (customers) => {
  const db = await initDB();
  const tx = db.transaction('customers', 'readwrite');
  const store = tx.objectStore('customers');
  
  for (const customer of customers) {
    await store.put({
      name: customer.name,
      customer_name: customer.customer_name,
      customer_type: customer.customer_type || 'Individual',
      territory: customer.territory || '',
      tax_category: customer.tax_category || '',
      state: customer.state || '',
      default_price_list: customer.default_price_list || '',
      last_synced: new Date().toISOString(),
    });
  }
  
  await tx.done;
};

export const getCustomers = async () => {
  const db = await initDB();
  return await db.getAll('customers');
};

export const searchCustomers = async (searchTerm) => {
  const db = await initDB();
  const customers = await db.getAll('customers');
  const term = searchTerm.toLowerCase();
  return customers.filter(c => 
    c.customer_name.toLowerCase().includes(term) ||
    c.name.toLowerCase().includes(term)
  );
};

// Sales Invoice operations
export const saveSalesInvoice = async (invoice) => {
  const db = await initDB();
  const tx = db.transaction('salesInvoices', 'readwrite');
  const store = tx.objectStore('salesInvoices');
  
  const invoiceData = {
    ...invoice,
    id: invoice.id || Date.now(),
    timestamp: invoice.timestamp || new Date().toISOString(),
    synced: invoice.synced || false,
  };
  
  await store.put(invoiceData);
  await tx.done;
  return invoiceData.id;
};

export const getUnsyncedInvoices = async () => {
  const db = await initDB();
  const index = db.transaction('salesInvoices').store.index('synced');
  return await index.getAll(false);
};

export const markInvoiceAsSynced = async (invoiceId) => {
  const db = await initDB();
  const invoice = await db.get('salesInvoices', invoiceId);
  if (invoice) {
    invoice.synced = true;
    await db.put('salesInvoices', invoice);
  }
};

// Settings operations
export const saveSetting = async (key, value) => {
  const db = await initDB();
  await db.put('settings', { key, value });
};

export const getSetting = async (key) => {
  const db = await initDB();
  const setting = await db.get('settings', key);
  return setting ? setting.value : null;
};

// Login session operations
export const saveLoginSession = async (sessionData) => {
  const db = await initDB();
  await db.put('settings', { 
    key: 'login_session', 
    value: {
      ...sessionData,
      saved_at: new Date().toISOString(),
    }
  });
};

// POS Profile operations
export const savePOSProfile = async (posProfile) => {
  const db = await initDB();
  await db.put('settings', { key: 'pos_profile', value: posProfile });
};

export const getPOSProfile = async () => {
  const db = await initDB();
  const setting = await db.get('settings', 'pos_profile');
  return setting ? setting.value : null;
};

export const savePriceList = async (priceList) => {
  const db = await initDB();
  await db.put('settings', { key: 'price_list', value: priceList });
};

export const getPriceList = async () => {
  const db = await initDB();
  const setting = await db.get('settings', 'price_list');
  return setting ? setting.value : null;
};

export const getLoginSession = async () => {
  const db = await initDB();
  const setting = await db.get('settings', 'login_session');
  return setting ? setting.value : null;
};

export const clearLoginSession = async () => {
  const db = await initDB();
  await db.delete('settings', 'login_session');
};

// POS Profile Data operations
export const savePOSProfileData = async (profileData) => {
  const db = await initDB();
  await db.put('settings', { 
    key: 'pos_profile_data', 
    value: {
      ...profileData,
      saved_at: new Date().toISOString(),
    }
  });
};

export const getPOSProfileData = async () => {
  const db = await initDB();
  const setting = await db.get('settings', 'pos_profile_data');
  return setting ? setting.value : null;
};

// Duties and taxes (from get_duties_and_taxes_list API, saved after login)
export const saveDutiesAndTaxes = async (data) => {
  await saveSetting('duties_and_taxes', data);
};

export const getDutiesAndTaxes = async () => {
  return await getSetting('duties_and_taxes');
};

// Sync Queue operations
export const addToSyncQueue = async (operation) => {
  const db = await initDB();
  const tx = db.transaction('syncQueue', 'readwrite');
  const store = tx.objectStore('syncQueue');
  
  const queueItem = {
    type: operation.type, // 'invoice', 'customer', 'product_sync', etc.
    action: operation.action, // 'create', 'update', 'delete', 'sync'
    data: operation.data,
    status: 'pending', // 'pending', 'processing', 'completed', 'failed'
    timestamp: new Date().toISOString(),
    retryCount: 0,
    error: null,
  };
  
  const id = await store.add(queueItem);
  await tx.done;
  return id;
};

export const getSyncQueue = async (status = null) => {
  const db = await initDB();
  if (status) {
    const index = db.transaction('syncQueue').store.index('status');
    return await index.getAll(status);
  }
  return await db.getAll('syncQueue');
};

export const getPendingSyncQueue = async () => {
  return await getSyncQueue('pending');
};

export const updateSyncQueueItem = async (id, updates) => {
  const db = await initDB();
  const item = await db.get('syncQueue', id);
  if (item) {
    Object.assign(item, updates);
    await db.put('syncQueue', item);
  }
};

export const removeSyncQueueItem = async (id) => {
  const db = await initDB();
  await db.delete('syncQueue', id);
};

export const clearSyncQueue = async () => {
  const db = await initDB();
  const tx = db.transaction('syncQueue', 'readwrite');
  await tx.store.clear();
  await tx.done;
};

// Pending checkout invoice: when create_draft is processed offline, we store
// the ERP invoice name by orderId so submit_and_pay can use it later
const PENDING_INVOICE_KEY_PREFIX = 'pending_checkout_invoice_';

export const setPendingCheckoutInvoice = async (orderId, invoiceName) => {
  await saveSetting(PENDING_INVOICE_KEY_PREFIX + orderId, invoiceName);
};

export const getPendingCheckoutInvoice = async (orderId) => {
  return await getSetting(PENDING_INVOICE_KEY_PREFIX + orderId);
};

export const deletePendingCheckoutInvoice = async (orderId) => {
  const db = await initDB();
  await db.delete('settings', PENDING_INVOICE_KEY_PREFIX + orderId);
};

