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

// Search products from ERPNext using POS endpoint
export const searchProductsFromERPNext = async (
  searchTerm = '',
  posProfile = '',
  priceList = '',
  itemGroup = '',
  start = 0,
  pageLength = 20
) => {
  try {
    const client = await createAuthenticatedClient();

    // Create form data
    const formData = new URLSearchParams();
    formData.append('search_term', searchTerm || '');
    formData.append('start', start || 0);
    formData.append('page_length', pageLength || 20);
    formData.append('price_list', priceList || 'Standard Selling');
    formData.append('item_group', itemGroup || '');
    formData.append('pos_profile', posProfile || '');

    const response = await client.post(
      '/api/method/erpnext.selling.page.point_of_sale.point_of_sale.get_items',
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const items =
      response.data?.message?.items ||
      response.data?.message ||
      [];

    return items.map((item) => ({
      item_code: item.item_code || item.name,
      item_name: item.item_name || item.name,
      description: item.description || '',
      standard_rate:
        item.rate ||
        item.price_list_rate ||
        item.standard_rate ||
        0,
      rate:
        item.rate ||
        item.price_list_rate ||
        item.standard_rate ||
        0,
      stock_uom: item.stock_uom || item.uom || 'Nos',
      image: item.image || null,
      qty: item.actual_qty || 0,
      has_variants: item.has_variants || 0,
    }));
  } catch (error) {
    console.error('Error searching products from ERPNext:', error);
    throw error;
  }
};


// Fetch products from ERPNext (legacy method - kept for sync)
export const fetchProducts = async () => {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.get('/api/resource/Item', {
      params: {
        fields: JSON.stringify(['item_code', 'item_name', 'description', 'standard_rate', 'stock_uom', 'image']),
        filters: JSON.stringify([['disabled', '=', 0]]),
        limit_page_length: 1000,
      },
    });
    
    return response.data.data.map(item => ({
      item_code: item.item_code,
      item_name: item.item_name,
      description: item.description || '',
      standard_rate: item.standard_rate || 0,
      stock_uom: item.stock_uom || 'Nos',
      image: item.image || null,
    }));
  } catch (error) {
    console.error('Error fetching products:', error);
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

// Search customers from ERPNext using Frappe search_link endpoint
export const searchCustomersFromERPNext = async (searchTerm = '', pageLength = 10) => {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.get('/api/method/frappe.desk.search.search_link', {
      params: {
        txt: searchTerm || '',
        doctype: 'Customer',
        reference_doctype: '',
        page_length: pageLength || 10,
        filters: '{}',
      },
    });
    
    // Handle response structure - Frappe search_link typically returns an array
    const results = response.data?.message || [];
    
    return results.map(item => ({
      name: item.value || item.name,
      customer_name: item.description || item.value || item.name,
      customer_type: item.customer_type || 'Individual',
      territory: item.territory || '',
    }));
  } catch (error) {
    console.error('Error searching customers from ERPNext:', error);
    throw error;
  }
};

// Fetch POS profile data from ERPNext
export const fetchPOSProfileData = async (email) => {
  try {
    const client = await createAuthenticatedClient();

    const response = await client.get('/api/resource/POS Profile', {
      params: {
        filters: JSON.stringify([
          ["applicable_for_users.user", "=", email]
        ]),
        fields: JSON.stringify(["name", "warehouse", "company","selling_price_list"])
      },
    });

    return response.data?.data || response.data?.message || {};
  } catch (error) {
    console.error('Error fetching POS profile data:', error);
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