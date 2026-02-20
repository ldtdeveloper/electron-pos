import axios from 'axios';
import { getSetting, getLoginSession } from './storage';

// Get API base URL from settings or use default
let apiBaseURL = 'http://192.168.1.81:8000';

// Initialize base URL from settings
const initBaseURL = async () => {
  const savedURL = await getSetting('erpnext_base_url');
  if (savedURL) {
    apiBaseURL = savedURL;
  }
};

// Initialize on module load
initBaseURL();

export const setApiBaseURL = (url) => {
  apiBaseURL = url || 'http://192.168.1.81:8000';
};

export const getApiBaseURL = () => {
  return apiBaseURL;
};

// Create axios instance with default config
const createApiClient = () => {
  return axios.create({
    baseURL: apiBaseURL,
    withCredentials: true,
    headers: {
      Accept: 'application/json',
    },
  });
};

// Login using standard Frappe login endpoint
export const login = async (username, password) => {
  try {
    const client = createApiClient();
    
    // Make POST request to login endpoint
    const response = await client.post(
      '/api/method/frappe.core.doctype.user.custom.login',
      {
        usr: username,
        pwd: password,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Login error:', error);
    
    // Extract error message from response if available
    const errorMessage = 
      error?.response?.data?.message ||
      error?.response?.data?.exception ||
      error?.response?.data?._error_message ||
      error?.message ||
      'Login failed. Please try again.';

    throw new Error(errorMessage);
  }
};

let savedApiKey = '';
let savedApiSecret = '';

// Load saved credentials from storage
const loadSavedCredentials = async () => {
  try {
    const session = await getLoginSession();
    if (session) {
      savedApiKey = session.api_key || '';
      savedApiSecret = session.api_secret || '';
    }
  } catch (error) {
    console.error('Error loading saved credentials:', error);
  }
};

// Initialize on module load
loadSavedCredentials();

// Create authenticated API client
const createAuthenticatedClient = async () => {
  // Load credentials if not already loaded
  if (!savedApiKey || !savedApiSecret) {
    await loadSavedCredentials();
  }
  
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  
  // Add token-based authentication if we have API credentials
  if (savedApiKey && savedApiSecret) {
    headers['Authorization'] = `token ${savedApiKey}:${savedApiSecret}`;
  }
  
  return axios.create({
    baseURL: apiBaseURL,
    withCredentials: true,
    headers,
  });
};

// Update saved credentials (called after login)
export const updateSavedCredentials = (apiKey, apiSecret) => {
  savedApiKey = apiKey || '';
  savedApiSecret = apiSecret || '';
};

/** Resolve rate and uom from item.price_lists by price list name (selling only). */
function resolveRateFromPriceLists(item, priceListName) {
  const lists = item.price_lists;
  if (Array.isArray(lists) && lists.length > 0) {
    const match = lists.find(
      (pl) => (pl.price_list || '').trim() === (priceListName || '').trim() && pl.selling === 1
    );
    if (match != null) {
      return { rate: match.price_list_rate ?? 0, uom: match.uom || item.stock_uom || item.uom || 'Nos' };
    }
    const firstSelling = lists.find((pl) => pl.selling === 1);
    if (firstSelling) {
      return { rate: firstSelling.price_list_rate ?? 0, uom: firstSelling.uom || item.stock_uom || item.uom || 'Nos' };
    }
  }
  const fallback = item.price_list_rate ?? item.rate ?? item.standard_rate ?? 0;
  return { rate: fallback, uom: item.stock_uom || item.uom || item.sales_uom || 'Nos' };
}

export const searchProductsFromERPNext = async (
  txt = '',
  priceList = '',
  start = 0,
  pageLength = 20
) => {
  try {
    const client = await createAuthenticatedClient();

    const response = await client.post(
      '/api/method/frappe.core.doctype.user.custom.get_items',
      {
        price_list: priceList || '',
        txt: txt || '',
        start: start || 0,
        page_length: pageLength || 20,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    const message = response.data?.message || {};
    const rawItems = message.items || [];
    const total = message.total ?? rawItems.length;
    const has_more = message.has_more ?? false;

    const items = rawItems.map((item) => {
      const resolved = resolveRateFromPriceLists(item, priceList || '');
      return {
        item_code: item.item_code || item.name,
        item_name: item.item_name || item.name,
        description: item.description || '',
        standard_rate: resolved.rate,
        rate: resolved.rate,
        stock_uom: resolved.uom || item.stock_uom || item.uom || item.sales_uom || 'Nos',
        image: item.item_image ?? item.image ?? null,
        qty: item.actual_qty ?? item.qty ?? 0,
        actual_qty: item.actual_qty ?? item.qty ?? 0,
        has_variants: item.has_variants || 0,
        item_tax_template: item.item_tax_template || null,
        tax_category: item.tax_category || null,
        price_lists: item.price_lists || null,
      };
    });

    return { items, total, has_more };
  } catch (error) {
    console.error('Error fetching items from ERPNext:', error);
    throw error;
  }
};

// Fetch customers from ERPNext
export const fetchCustomers = async () => {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.get('/api/resource/Customer', {
      params: {
        fields: JSON.stringify(['name', 'customer_name', 'customer_type', 'territory']),
        filters: JSON.stringify([['disabled', '=', 0]]),
        limit_page_length: 1000,
      },
    });
    
    return response.data.data.map(customer => ({
      name: customer.name,
      customer_name: customer.customer_name,
      customer_type: customer.customer_type || 'Individual',
      territory: customer.territory || '',
    }));
  } catch (error) {
    console.error('Error fetching customers:', error);
    throw error;
  }
};

export const searchCustomersFromERPNext = async (search = '') => {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.post(
      '/api/method/frappe.core.doctype.user.custom.get_customers',
      { search: search || '' },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    const raw = response.data?.message;
    const results = Array.isArray(raw) ? raw : raw?.data ?? raw?.customers ?? [];

    return results.map((item) => ({
      name: item.name ?? item.value,
      customer_name: item.label ?? item.customer_name ?? item.description ?? item.value ?? item.name,
      customer_type: item.customer_type || 'Individual',
      territory: item.territory || '',
      tax_category: item.tax_category ?? item.gst_category ?? '',
      state: item.address ?? item.state ?? item.gst_state ?? item.address_state ?? '',
      default_price_list: item.default_price_list ?? '',
    }));
  } catch (error) {
    console.error('Error fetching customers from ERPNext:', error);
    throw error;
  }
};

// Fetch POS profiles (frappe.core.doctype.user.custom.get_pos_profiles)
// Returns { data: [{ name, warehouse, company, selling_price_list, payment_methods, ... }] }
export const fetchPOSProfileData = async () => {
  try {
    const client = await createAuthenticatedClient();

    const response = await client.post(
      '/api/method/frappe.core.doctype.user.custom.get_pos_profiles',
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    const message = response.data?.message || response.data;
    return message || {};
  } catch (error) {
    console.error('Error fetching POS profiles:', error);
    throw error;
  }
};

// Get POS profile data using POS endpoint

export const getPOSProfileData = async (posProfile) => {
  try {
    const client = await createAuthenticatedClient();

    // Create form data
    const formData = new URLSearchParams();
    formData.append('pos_profile', posProfile);

    const response = await client.post(
      '/api/method/erpnext.selling.page.point_of_sale.point_of_sale.get_pos_profile_data',
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data?.message || response.data;
  } catch (error) {
    console.error('Error getting POS profile data:', error);
    throw error;
  }
};


// Submit sales invoice to ERPNext
export const submitSalesInvoice = async (invoiceData) => {
  try {
    const client = await createAuthenticatedClient();
    
    const erpnextInvoice = {
      doctype: 'Sales Invoice',
      customer: invoiceData.customer || 'Guest',
      posting_date: invoiceData.date || new Date().toISOString().split('T')[0],
      due_date: invoiceData.date || new Date().toISOString().split('T')[0],
      items: invoiceData.items.map(item => ({
        item_code: item.item_code,
        item_name: item.item_name,
        qty: item.quantity,
        rate: item.rate,
        uom: item.uom || 'Nos',
      })),
      taxes_and_charges: invoiceData.taxes || '',
      total: invoiceData.total,
      grand_total: invoiceData.grand_total,
      outstanding_amount: invoiceData.grand_total,
    };

    const response = await client.post('/api/resource/Sales Invoice', erpnextInvoice);
    return response.data;
  } catch (error) {
    console.error('Error submitting sales invoice:', error);
    throw error;
  }
};

/**
 * Create Sales Invoice (POS) via custom API
 * Endpoint: erpnext.accounts.doctype.sales_invoice.sales_invoice_api.create_sales_invoice_api
 * Used when clicking Checkout (online mode) to create a draft invoice with taxes from ERP.
 *
 * payload: {
 *   posting_date: 'YYYY-MM-DD',
 *   submit: 0,
 *   company: string,
 *   customer: string,
 *   items: [{ item_code, qty, rate }]
 * }
 *
 * Returns the `message` object from ERPNext response.
 */
export const createSalesInvoicePOS = async ({ customerName, company = 'LDT TECH', cartItems }) => {
  try {
    const client = await createAuthenticatedClient();

    const today = new Date().toISOString().split('T')[0];

    const payload = {
      posting_date: today,
      submit: 0,
      company,
      customer: customerName,
      items: (cartItems || []).map((item) => ({
        item_code: item.item_code,
        qty: item.quantity,
        rate: item.rate,
      })),
    };

    const response = await client.post(
      '/api/method/erpnext.accounts.doctype.sales_invoice.sales_invoice_api.create_sales_invoice_api',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    return response.data?.message || response.data;
  } catch (error) {
    console.error('Error creating POS Sales Invoice via API:', error);
    throw error;
  }
};

/**
 * Submit and pay Sales Invoice (POS) via custom API
 * Endpoint: erpnext.accounts.doctype.sales_invoice.sales_invoice_api.submit_and_pay_sales_invoice_api
 *
 * payload: {
 *   sales_invoice: 'SINV-26-00045',
 *   mode_of_payment: 'Cash'
 * }
 *
 * Returns the `message` object from ERPNext response (if any).
 */
export const submitAndPaySalesInvoicePOS = async ({ salesInvoice, modeOfPayment = 'Cash' }) => {
  try {
    const client = await createAuthenticatedClient();

    const payload = {
      sales_invoice: salesInvoice,
      mode_of_payment: modeOfPayment,
    };

    const response = await client.post(
      '/api/method/erpnext.accounts.doctype.sales_invoice.sales_invoice_api.submit_and_pay_sales_invoice_api',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    return response.data?.message || response.data;
  } catch (error) {
    console.error('Error submitting & paying POS Sales Invoice via API:', error);
    throw error;
  }
};

// Create a new customer in ERPNext
export const createCustomer = async ({ name, email, phone }) => {
  try {
    const client = await createAuthenticatedClient();

    const payload = {
      customer_name: name,
      customer_type: 'Individual',
      phone_number: phone,
      default_price_list: 'Standard Selling',
      gst_category: 'Unregistered',
    };

    if (email) {
      payload.email_id = email;
    }

    const response = await client.post('/api/resource/Customer', payload);

    const data =
      response.data?.data ||
      response.data?.message ||
      response.data;

    return {
      name: data.name,
      customer_name: data.customer_name || data.name || name,
      customer_type: data.customer_type || 'Individual',
      territory: data.territory || '',
      phone_number: data.phone_number || phone,
      email_id: data.email_id || email || '',
    };
  } catch (error) {
    console.error('Error creating customer:', error);

    const errorMessage =
      error?.response?.data?.message ||
      error?.response?.data?._error_message ||
      error?.message ||
      'Failed to create customer.';

    throw new Error(errorMessage);
  }
};

// Check POS opening entry for a user
export const checkOpeningEntry = async (user) => {
  try {
    const client = await createAuthenticatedClient();

    const formData = new URLSearchParams();
    formData.append('user', user);

    const response = await client.post(
      '/api/method/erpnext.selling.page.point_of_sale.point_of_sale.check_opening_entry',
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data?.message || response.data;
  } catch (error) {
    console.error('Error checking opening entry:', error);
    throw error;
  }
};

// Get duties and taxes list for a company (call after login with company from response.data)
export const getDutiesAndTaxesList = async (company) => {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.post(
      '/api/method/frappe.core.doctype.user.custom.get_duties_and_taxes_list',
      { company },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );
    return response.data?.message || response.data;
  } catch (error) {
    console.error('Error fetching duties and taxes list:', error);
    throw error;
  }
};

// Get POS closing data by opening entry
export const getPOSClosingDataByOpeningEntry = async (posOpeningEntry) => {
  try {
    const client = await createAuthenticatedClient();

    const response = await client.post(
      '/api/method/frappe.core.doctype.user.custom.get_pos_closing_data_by_opening_entry',
      { pos_opening_entry: posOpeningEntry },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    return response.data?.message || response.data;
  } catch (error) {
    console.error('Error getting POS closing data by opening entry:', error);
    throw error;
  }
};

// Save (or Submit) a POS Closing Entry doc via Frappe savedocs endpoint
// action: 'Save' | 'Submit' | 'Update' (defaults to 'Save')
export const savePOSClosingEntry = async (doc, action = 'Save') => {
  try {
    const client = await createAuthenticatedClient();

    const formData = new URLSearchParams();
    formData.append('doc', JSON.stringify(doc));
    formData.append('action', action);

    const response = await client.post(
      '/api/method/frappe.desk.form.save.savedocs',
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      }
    );

    return response.data?.message || response.data;
  } catch (error) {
    console.error('Error saving POS closing entry:', error);
    throw error;
  }
};

// Create POS Opening Voucher
export const createOpeningVoucher = async (posProfile, company, balanceDetails) => {
  try {
    const client = await createAuthenticatedClient();

    const formData = new URLSearchParams();
    formData.append('pos_profile', posProfile);
    formData.append('company', company);
    formData.append('balance_details', JSON.stringify(balanceDetails));

    const response = await client.post(
      '/api/method/erpnext.selling.page.point_of_sale.point_of_sale.create_opening_voucher',
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
      }
    );

    return response.data?.message || response.data;
  } catch (error) {
    console.error('Error creating opening voucher:', error);
    throw error;
  }
};
