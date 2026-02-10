import axios from 'axios';
import { getSetting, getLoginSession } from './storage';

// Get API base URL from settings or use default
let apiBaseURL = 'http://localhost:8000';

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
  apiBaseURL = url || 'http://localhost:8000';
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

// Step 1: Get the CSRF Token
export const getCSRFToken = async () => {
  try {
    const client = createApiClient();
    const response = await client.get('/api/method/erpnext.api.get_csrf_token', {
      headers: {
        Accept: 'application/json',
      },
    });
    
    // Extract CSRF token from response
    const csrfToken = response.data?.message?.csrf_token || response.data?.message;
    
    if (!csrfToken) {
      throw new Error('CSRF token not found in response');
    }
    
    return csrfToken;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    throw new Error('Failed to get CSRF token. Please try again.');
  }
};

// Step 2: Login with CSRF Token
export const login = async (username, password) => {
  try {
    // First, get the CSRF token
    const csrfToken = await getCSRFToken();
    
    const client = createApiClient();
    
    // Make POST request to login endpoint with CSRF token
    const response = await client.post(
      '/api/method/erpnext.api.login',
      {
        usr: username,
        pwd: password,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Frappe-CSRF-Token': csrfToken,
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

let csrfToken = '';
let savedApiKey = '';
let savedApiSecret = '';

// Load saved credentials from storage
const loadSavedCredentials = async () => {
  try {
    const session = await getLoginSession();
    if (session) {
      savedApiKey = session.api_key || '';
      savedApiSecret = session.api_secret || '';
      // Refresh CSRF token if we have credentials
      if (savedApiKey && savedApiSecret) {
        await refreshCSRFToken();
      }
    }
  } catch (error) {
    console.error('Error loading saved credentials:', error);
  }
};

// Initialize on module load
loadSavedCredentials();

// Get CSRF token and cache it
export const refreshCSRFToken = async () => {
  try {
    const token = await getCSRFToken();
    csrfToken = token;
    return token;
  } catch (error) {
    console.error('Error refreshing CSRF token:', error);
    throw error;
  }
};

// Create authenticated API client
const createAuthenticatedClient = async () => {
  // Load credentials if not already loaded
  if (!savedApiKey || !savedApiSecret) {
    await loadSavedCredentials();
  }
  
  // Get CSRF token
  if (!csrfToken) {
    await refreshCSRFToken();
  }
  
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Frappe-CSRF-Token': csrfToken,
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
export const searchProductsFromERPNext = async (searchTerm = '', posProfile = 'POS2', priceList = '', itemGroup = '', start = 0, pageLength = 20) => {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.get('/api/method/erpnext.selling.page.point_of_sale.point_of_sale.get_items', {
      params: {
        search_term: searchTerm || '',
        start: start || 0,
        page_length: pageLength || 20,
        price_list: priceList || '',
        item_group: itemGroup || '',
        pos_profile: posProfile || 'POS2',
      },
    });
    
    // Handle response structure - adjust based on actual API response
    const items = response.data?.message?.items || response.data?.message || [];
    
    return items.map(item => ({
      item_code: item.item_code || item.name,
      item_name: item.item_name || item.name,
      description: item.description || '',
      standard_rate: item.rate || item.price_list_rate || item.standard_rate || 0,
      rate: item.rate || item.price_list_rate || item.standard_rate || 0,
      stock_uom: item.stock_uom || item.uom || 'Nos',
      image: item.image || null,
      qty: item.qty || 0,
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
export const fetchPOSProfileData = async (posProfile = 'POS2') => {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.get('/api/method/erpnext.selling.page.point_of_sale.point_of_sale.get_pos_profile_data', {
      params: {
        pos_profile: posProfile || 'POS2',
      },
    });
    
    return response.data?.message || response.data || {};
  } catch (error) {
    console.error('Error fetching POS profile data:', error);
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

