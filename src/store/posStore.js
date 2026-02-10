import { create } from 'zustand';
import { getProducts, searchProducts as searchProductsDB, getPOSProfile, getPriceList } from '../services/storage';
import { searchProductsFromERPNext } from '../services/api';
import { isOnline } from '../utils/onlineStatus';

const usePOSStore = create((set, get) => ({
  // Cart state
  cart: [],
  customer: null,
  
  // Products state
  products: [],
  filteredProducts: [],
  searchTerm: '',
  
  // UI state
  isLoading: false,
  error: null,
  
  // Actions
  addToCart: (product, quantity = 1) => {
    const cart = get().cart;
    const existingItem = cart.find(item => item.item_code === product.item_code);
    
    if (existingItem) {
      existingItem.quantity += quantity;
      set({ cart: [...cart] });
    } else {
      set({ 
        cart: [...cart, {
          ...product,
          quantity,
          uom: product.stock_uom || 'Nos',
          rate: product.rate || product.standard_rate || 0,
        }]
      });
    }
  },
  
  removeFromCart: (itemCode) => {
    set({ cart: get().cart.filter(item => item.item_code !== itemCode) });
  },
  
  updateCartItemQuantity: (itemCode, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(itemCode);
      return;
    }
    
    const cart = get().cart.map(item =>
      item.item_code === itemCode ? { ...item, quantity } : item
    );
    set({ cart });
  },
  
  clearCart: () => {
    set({ cart: [], customer: null });
  },
  
  setCustomer: (customer) => {
    set({ customer });
  },
  
  clearCustomer: () => {
    set({ customer: null });
  },
  
  // Product actions
  loadProducts: async () => {
    set({ isLoading: true, error: null });
    try {
      const products = await getProducts();
      set({ products, filteredProducts: products, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  searchProducts: async (term) => {
    set({ searchTerm: term });
    if (!term) {
      set({ filteredProducts: get().products });
      return;
    }
    
    try {
      // If online, search from ERPNext API
      if (isOnline()) {
        try {
          // Get price list from settings, use hardcoded pos3 for POS profile
          const priceList = await getPriceList() || '';
          
          const results = await searchProductsFromERPNext(
            term,
            'pos3', // Hardcoded POS profile
            priceList,
            '', // item_group - empty for all groups
            0,  // start
            20  // page_length
          );
          set({ filteredProducts: results });
          return;
        } catch (apiError) {
          console.warn('Online search failed, falling back to local:', apiError);
          // Fall through to local search
        }
      }
      
      // Offline or API failed - search local storage
      const results = await searchProductsDB(term);
      set({ filteredProducts: results });
    } catch (error) {
      set({ error: error.message });
    }
  },
  
  // Calculate totals
  getCartSubtotal: () => {
    const cart = get().cart;
    return cart.reduce((total, item) => total + (item.rate * item.quantity), 0);
  },
  
  getCartTax: (taxRate = 0) => {
    const subtotal = get().getCartSubtotal();
    return subtotal * (taxRate / 100);
  },
  
  getCartGrandTotal: (taxRate = 0) => {
    const subtotal = get().getCartSubtotal();
    const tax = get().getCartTax(taxRate);
    return subtotal + tax;
  },
}));

export default usePOSStore;

