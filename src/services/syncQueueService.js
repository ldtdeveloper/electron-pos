import {
  getPendingSyncQueue,
  updateSyncQueueItem,
  removeSyncQueueItem,
  saveCustomers,
  setPendingCheckoutInvoice,
  getPendingCheckoutInvoice,
  deletePendingCheckoutInvoice,
} from './storage';
import {
  submitSalesInvoice,
  createSalesInvoicePOS,
  submitAndPaySalesInvoicePOS,
  createCustomer,
} from './api';
import { markInvoiceAsSynced } from './storage';
import { isOnline } from '../utils/onlineStatus';

/**
 * Process all pending items in the sync queue
 * This is called automatically when coming back online
 */
export const processSyncQueue = async () => {
  if (!isOnline()) {
    console.log('Cannot process sync queue: offline');
    return { processed: 0, failed: 0, errors: [] };
  }

  const pendingItems = await getPendingSyncQueue();
  if (pendingItems.length === 0) {
    return { processed: 0, failed: 0, errors: [] };
  }

  let processed = 0;
  let failed = 0;
  const errors = [];

  for (const item of pendingItems) {
    try {
      // Mark as processing
      await updateSyncQueueItem(item.id, { status: 'processing' });

      // Process based on type
      let success = false;
      switch (item.type) {
        case 'invoice':
          success = await processInvoiceQueueItem(item);
          break;
        case 'customer':
          success = await processCustomerQueueItem(item);
          break;
        case 'product_sync':
          // Product sync is handled by syncService
          success = true;
          break;
        default:
          console.warn(`Unknown queue item type: ${item.type}`);
          success = false;
      }

      if (success) {
        await updateSyncQueueItem(item.id, { status: 'completed' });
        // Remove after a short delay to allow UI to update
        setTimeout(() => removeSyncQueueItem(item.id), 1000);
        processed++;
      } else {
        throw new Error('Processing failed');
      }
    } catch (error) {
      console.error(`Error processing queue item ${item.id}:`, error);
      const retryCount = (item.retryCount || 0) + 1;
      
      // Mark as failed if retry limit exceeded (e.g., 3 retries)
      if (retryCount >= 3) {
        await updateSyncQueueItem(item.id, {
          status: 'failed',
          error: error.message,
          retryCount,
        });
        failed++;
      } else {
        // Retry later
        await updateSyncQueueItem(item.id, {
          status: 'pending',
          retryCount,
          error: error.message,
        });
      }
      
      errors.push({ id: item.id, error: error.message });
    }
  }

  return { processed, failed, errors };
};

/**
 * Process an invoice queue item
 */
const processInvoiceQueueItem = async (item) => {
  const { action, data } = item;

  if (action === 'create_and_pay') {
    // Create invoice via POS API and immediately submit & pay
    const erpInvoice = await createSalesInvoicePOS({
      customerName: data.customerName,
      company: data.company || 'LDT TECH',
      cartItems: data.cartItems,
    });

    // Submit and pay
    await submitAndPaySalesInvoicePOS({
      salesInvoice: erpInvoice.name,
      modeOfPayment: data.modeOfPayment || 'Cash',
    });

    // If this was saved locally, mark it as synced
    if (data.localInvoiceId) {
      await markInvoiceAsSynced(data.localInvoiceId);
    }

    return true;
  } else if (action === 'create_draft') {
    // Create draft invoice only (from checkout flow) – syncs when back online
    const erpInvoice = await createSalesInvoicePOS({
      customerName: data.customerName,
      company: data.company || 'LDT TECH',
      cartItems: data.cartItems,
    });

    // If this checkout has an orderId, store invoice name so submit_and_pay can use it later
    if (data.orderId) {
      await setPendingCheckoutInvoice(data.orderId, erpInvoice.name);
    }

    return true;
  } else if (action === 'submit_and_pay') {
    // Submit and pay an existing draft invoice (by name or by orderId from offline checkout)
    let invoiceName = data.erpInvoiceName;
    if (!invoiceName && data.orderId) {
      invoiceName = await getPendingCheckoutInvoice(data.orderId);
      if (invoiceName) {
        await deletePendingCheckoutInvoice(data.orderId);
      }
    }
    if (!invoiceName) {
      throw new Error('Invoice name or orderId is required for submit_and_pay');
    }

    await submitAndPaySalesInvoicePOS({
      salesInvoice: invoiceName,
      modeOfPayment: data.modeOfPayment || 'Cash',
    });

    if (data.localInvoiceId) {
      await markInvoiceAsSynced(data.localInvoiceId);
    }

    return true;
  } else if (action === 'submit') {
    // Submit existing invoice (legacy)
    await submitSalesInvoice(data);
    
    if (data.localInvoiceId) {
      await markInvoiceAsSynced(data.localInvoiceId);
    }

    return true;
  }

  return false;
};

/**
 * Process a customer queue item
 */
const processCustomerQueueItem = async (item) => {
  const { action, data } = item;

  if (action === 'create') {
    const created = await createCustomer({
      name: data.name,
      email: data.email,
      phone: data.phone,
    });
    
    // Update local DB with the real customer data (replaces temporary customer)
    await saveCustomers([created]);
    
    return true;
  }

  return false;
};

/**
 * Check if there are pending items in the queue
 */
export const hasPendingSyncItems = async () => {
  const pending = await getPendingSyncQueue();
  return pending.length > 0;
};
