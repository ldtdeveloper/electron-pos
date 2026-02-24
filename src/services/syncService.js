import {
  getUnsyncedInvoices,
  markInvoiceAsSynced,
  saveProducts as saveProductsToDB,
  saveCustomers as saveCustomersToDB,
  getPriceList,
} from './storage';
import {
  searchProductsFromERPNext,
  searchCustomersFromERPNext,
  submitSalesInvoice,
} from './api';
import { processSyncQueue } from './syncQueueService';
import { isOnline } from '../utils/onlineStatus';

// Sync products from ERPNext (get_items with price_list from POS profile); jaise online aaye DB update
export const syncProducts = async () => {
  try {
    const priceList = (await getPriceList()) || '';
    let start = 0;
    let allItems = [];
    let hasMore = true;

    while (hasMore) {
      const res = await searchProductsFromERPNext('', priceList);
      allItems = allItems.concat(res.items);
      hasMore = res.has_more ?? false;
    }

    await saveProductsToDB(allItems);
    return { success: true, count: allItems.length };
  } catch (error) {
    console.error('Error syncing products:', error);
    throw error;
  }
};

// Sync customers from ERPNext (get_customers); jaise online aaye DB update
export const syncCustomers = async () => {
  try {
    const customers = await searchCustomersFromERPNext('');
    await saveCustomersToDB(customers);
    return { success: true, count: customers.length };
  } catch (error) {
    console.error('Error syncing customers:', error);
    throw error;
  }
};

// Sync unsynced invoices to ERPNext
export const syncInvoices = async () => {
  try {
    const unsyncedInvoices = await getUnsyncedInvoices();
    const results = [];

    for (const invoice of unsyncedInvoices) {
      try {
        await submitSalesInvoice(invoice);
        await markInvoiceAsSynced(invoice.id);
        results.push({ id: invoice.id, success: true });
      } catch (error) {
        console.error(`Error syncing invoice ${invoice.id}:`, error);
        results.push({ id: invoice.id, success: false, error: error.message });
      }
    }

    return { success: true, results };
  } catch (error) {
    console.error('Error syncing invoices:', error);
    throw error;
  }
};

// Full sync - products, customers, and invoices
export const performFullSync = async () => {
  // Check if online before syncing
  if (!isOnline()) {
    throw new Error('Cannot sync: offline mode. Data will sync automatically when online.');
  }

  const results = {
    products: { success: false, error: null },
    customers: { success: false, error: null },
    invoices: { success: false, error: null },
    queue: { success: false, error: null },
  };

  try {
    const productsResult = await syncProducts();
    results.products = { success: true, count: productsResult.count };
  } catch (error) {
    results.products.error = error.message;
  }

  try {
    const customersResult = await syncCustomers();
    results.customers = { success: true, count: customersResult.count };
  } catch (error) {
    results.customers.error = error.message;
  }

  try {
    const invoicesResult = await syncInvoices();
    results.invoices = { success: true, count: invoicesResult.results.length };
  } catch (error) {
    results.invoices.error = error.message;
  }

  // Process sync queue (operations queued while offline)
  try {
    const queueResult = await processSyncQueue();
    results.queue = { 
      success: true, 
      processed: queueResult.processed,
      failed: queueResult.failed,
      errors: queueResult.errors,
    };
  } catch (error) {
    results.queue.error = error.message;
  }

  return results;
};

// Auto-sync: Sync products and customers when online (called automatically)
export const performAutoSync = async () => {
  if (!isOnline()) {
    console.log('Auto-sync skipped: offline');
    return { synced: false, reason: 'offline' };
  }

  try {
    // Sync products and customers
    await syncProducts();
    await syncCustomers();
    
    // Process any queued operations
    await processSyncQueue();
    
    return { synced: true };
  } catch (error) {
    console.error('Auto-sync error:', error);
    return { synced: false, error: error.message };
  }
};

