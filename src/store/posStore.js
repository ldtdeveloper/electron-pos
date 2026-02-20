import { create } from 'zustand';
import { getProducts, searchProducts as searchProductsDB, getPriceList } from '../services/storage';
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
  itemsTotal: 0,
  itemsHasMore: false,
  isLoadingMore: false,

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
    set({ searchTerm: term ?? '' });
    const effectiveTerm = term?.trim() ?? '';

    const getEffectivePriceList = async () => {
      const customer = get().customer;
      const posPriceList = (await getPriceList()) || '';
      return (customer?.default_price_list && String(customer.default_price_list).trim())
        ? customer.default_price_list
        : posPriceList;
    };

    // Empty term: show items with effective price list (customer default_price_list else POS profile)
    if (!effectiveTerm) {
      if (isOnline()) {
        try {
          const effectivePriceList = await getEffectivePriceList();
          const res = await searchProductsFromERPNext('', effectivePriceList, 0, 20);
          set({
            filteredProducts: res.items,
            itemsTotal: res.total ?? res.items.length,
            itemsHasMore: res.has_more ?? false,
          });
          return;
        } catch (apiError) {
          console.warn('Fetch items with price list failed, using local:', apiError);
        }
      }
      const products = get().products;
      set({ filteredProducts: products, itemsTotal: products.length, itemsHasMore: false });
      return;
    }

    try {
      if (isOnline()) {
        try {
          const effectivePriceList = await getEffectivePriceList();
          const res = await searchProductsFromERPNext(effectiveTerm, effectivePriceList, 0, 20);
          set({
            filteredProducts: res.items,
            itemsTotal: res.total ?? res.items.length,
            itemsHasMore: res.has_more ?? false,
          });
          return;
        } catch (apiError) {
          console.warn('Online search failed, falling back to local DB:', apiError);
        }
      }

      const results = await searchProductsDB(effectiveTerm);
      set({ filteredProducts: results, itemsTotal: results.length, itemsHasMore: false });
    } catch (error) {
      set({ error: error.message });
    }
  },

  loadMoreProducts: async () => {
    const { searchTerm, filteredProducts, itemsHasMore, isLoadingMore, customer } = get();
    if (!itemsHasMore || isLoadingMore || !isOnline()) return;

    set({ isLoadingMore: true });
    try {
      const posPriceList = (await getPriceList()) || '';
      const effectivePriceList = (customer?.default_price_list && String(customer.default_price_list).trim())
        ? customer.default_price_list
        : posPriceList;
      const term = searchTerm?.trim() ?? '';
      const res = await searchProductsFromERPNext(
        term,
        effectivePriceList,
        filteredProducts.length,
        20
      );
      set({
        filteredProducts: [...filteredProducts, ...res.items],
        itemsHasMore: res.has_more ?? false,
        isLoadingMore: false,
      });
    } catch (error) {
      set({ isLoadingMore: false, error: error.message });
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

