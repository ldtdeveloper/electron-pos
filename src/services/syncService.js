import { 
  getUnsyncedInvoices, 
  markInvoiceAsSynced,
  getProducts,
  saveProducts as saveProductsToDB,
  getCustomers,
  saveCustomers as saveCustomersToDB,
} from './storage';
import { 
  fetchProducts as fetchProductsFromERPNext,
  fetchCustomers as fetchCustomersFromERPNext,
  submitSalesInvoice,
} from './api';

// Sync products from ERPNext
export const syncProducts = async () => {
  try {
    const products = await fetchProductsFromERPNext();
    await saveProductsToDB(products);
    return { success: true, count: products.length };
  } catch (error) {
    console.error('Error syncing products:', error);
    throw error;
  }
};

// Sync customers from ERPNext
export const syncCustomers = async () => {
  try {
    const customers = await fetchCustomersFromERPNext();
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
  const results = {
    products: { success: false, error: null },
    customers: { success: false, error: null },
    invoices: { success: false, error: null },
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

  return results;
};

