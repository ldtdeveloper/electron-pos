import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import usePOSStore from '../store/posStore';
import { getLoginSession, savePOSProfileData, getDutiesAndTaxes, getPOSProfile, getPOSProfileData } from '../services/storage';
import { performFullSync } from '../services/syncService';
import { updateSavedCredentials, setApiBaseURL, fetchPOSProfileData, createSalesInvoicePOS } from '../services/api';
import { isOnline, addOnlineListener, addOfflineListener } from '../utils/onlineStatus';
import { calculateCartTax } from '../utils/taxCalculator';
import { getCompanyState } from '../utils/companyState';
import ProductList from '../components/ProductList';
import Cart from '../components/Cart';
import CustomerSearch from '../components/CustomerSearch';
import Settings from '../components/Settings';
import './POS.css';

const POS = () => {
  const navigate = useNavigate();
  const {
    cart,
    customer,
    filteredProducts,
    isLoading,
    error,
    itemsHasMore,
    isLoadingMore,
    addToCart,
    removeFromCart,
    updateCartItemQuantity,
    clearCart,
    setCustomer,
    clearCustomer,
    loadProducts,
    searchProducts,
    loadMoreProducts,
  } = usePOSStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState(isOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [dutiesAndTaxes, setDutiesAndTaxes] = useState(null);
  const [companyState, setCompanyState] = useState('');

  const handleAutoSync = useCallback(async () => {
    if (isOnline()) {
      setIsSyncing(true);
      try {
        await performFullSync();
        loadProducts();
      } catch (error) {
        console.error('Auto-sync failed:', error);
      } finally {
        setIsSyncing(false);
      }
    }
  }, [loadProducts]);

  useEffect(() => {
    // Load saved login session and credentials
    const loadSavedSession = async () => {
      try {
        const session = await getLoginSession();
        if (session) {
          // Restore API credentials
          if (session.api_key && session.api_secret) {
            updateSavedCredentials(session.api_key, session.api_secret);
          }
          
          // Restore base URL
          if (session.base_url) {
            setApiBaseURL(session.base_url);
          }
        } else {
          // No saved session, redirect to login
          navigate('/login');
          return;
        }
      } catch (error) {
        console.error('Error loading saved session:', error);
        navigate('/login');
        return;
      }
      
      loadProducts();
      loadDutiesAndTaxes();
      loadCompanyState();
      
      // Fetch and store POS profile data if online
      if (isOnline()) {
        loadPOSProfileData();
      }
    };
    
    loadSavedSession();
    
    // Set up online/offline listeners
    const removeOnlineListener = addOnlineListener(() => {
      setOnlineStatus(true);
      handleAutoSync();
    });
    
    const removeOfflineListener = addOfflineListener(() => {
      setOnlineStatus(false);
    });
    
    return () => {
      removeOnlineListener();
      removeOfflineListener();
    };
  }, [handleAutoSync, navigate, loadProducts]);

  const loadDutiesAndTaxes = async () => {
    try {
      const data = await getDutiesAndTaxes();
      if (data) setDutiesAndTaxes(data);
    } catch (e) {
      console.error('Error loading duties and taxes:', e);
    }
  };

  const loadCompanyState = async () => {
    const state = await getCompanyState(getPOSProfile, getPOSProfileData);
    setCompanyState(state);
  };

  // Track previous customer to detect changes
  const prevCustomerRef = useRef(customer?.name);
  
  // When customer changes, clear cart and refresh product list so prices use customer default_price_list or POS list
  useEffect(() => {
    const currentCustomerName = customer?.name;
    const prevCustomerName = prevCustomerRef.current;
    
    // Clear cart when customer changes (but not on initial mount or when clearing customer)
    if (prevCustomerName && currentCustomerName && prevCustomerName !== currentCustomerName) {
      clearCart();
    }
    
    prevCustomerRef.current = currentCustomerName;
    searchProducts(searchTerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.name]);

  const loadPOSProfileData = async () => {
    try {
      const session = await getLoginSession();
      if (!session?.email) return;
      const profileData = await fetchPOSProfileData();
      await savePOSProfileData(profileData);
    } catch (error) {
      console.error('Error loading POS profile data:', error);
      // Don't block the UI if this fails
    }
  };

  const handleSearch = (term) => {
    setSearchTerm(term);
    searchProducts(term);
  };

  const handleSyncComplete = () => {
    loadProducts();
    loadDutiesAndTaxes();
    loadCompanyState();
  };

  // Recalculate taxes when customer changes (tax_category, state) or cart changes
  const taxResult = useMemo(() => {
    if (!dutiesAndTaxes?.taxes?.length) {
      const sub = cart.reduce((s, i) => s + (i.rate || 0) * (i.quantity || 0), 0);
      return { subtotal: sub, totalTax: 0, grandTotal: sub, breakdown: [] };
    }
    return calculateCartTax(cart, customer, dutiesAndTaxes, companyState);
  }, [
    cart,
    customer?.name, // Customer identity
    customer?.tax_category, // Affects Check 1
    customer?.gst_category, // Affects Check 1
    customer?.state, // Affects Check 4
    customer?.gst_state, // Affects Check 4
    customer?.address_state, // Affects Check 4
    dutiesAndTaxes,
    companyState,
  ]);

  const { subtotal, totalTax: tax, grandTotal, breakdown } = taxResult;

  const handleCheckoutClick = async () => {
    if (!customer) {
      setToastMessage('Please select a customer first.');
      setTimeout(() => {
        setToastMessage('');
      }, 2500);
      return;
    }

    // If online, first create Sales Invoice via ERPNext API so that taxes come from backend
    if (isOnline()) {
      try {
        const customerName = customer.customer_name || customer.name;
        const erpInvoice = await createSalesInvoicePOS({
          customerName,
          // Company can be refined later from POS profile; using default for now
          company: 'LDT TECH',
          cartItems: cart,
        });
        navigate('/complete-order', { state: { erpInvoice } });
        return;
      } catch (error) {
        console.error('Checkout: failed to create Sales Invoice via API, falling back to local totals.', error);
        setToastMessage('Online invoice failed, using local totals.');
        setTimeout(() => setToastMessage(''), 2500);
      }
    }

    // Offline or API failure – fall back to existing behaviour
    navigate('/complete-order');
  };

  return (
    <div className="pos-container">
      <header className="pos-header">
        <div className="header-left">
          <h1>POS System</h1>
          {onlineStatus ? (
            <span className="online-badge">
              {isSyncing ? '🔄 Syncing...' : '🟢 Online'}
            </span>
          ) : (
            <span className="offline-badge">🔴 Offline Mode</span>
          )}
        </div>
        <div className="header-right">
          <button className="settings-btn" onClick={() => setShowSettings(true)}>
            ⚙️ Settings
          </button>
        </div>
      </header>

      <div className="pos-main">
        <div className="pos-products">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="search-input"
            />
          </div>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <ProductList
            products={filteredProducts}
            onAddToCart={addToCart}
            isLoading={isLoading}
            hasMore={itemsHasMore}
            onLoadMore={loadMoreProducts}
            isLoadingMore={isLoadingMore}
            disableAddToCart={!customer}
            onAddToCartBlocked={() => {
              setToastMessage('Please select a customer first.');
              setTimeout(() => setToastMessage(''), 2500);
            }}
          />
        </div>

        <div className="pos-cart">
          <div className="customer-search-section">
            <CustomerSearch
              selectedCustomer={customer}
              onSelectCustomer={setCustomer}
              onClearCustomer={clearCustomer}
            />
          </div>
          
          <div className="cart-header">
            <h2>Cart ({cart.length})</h2>
            {cart.length > 0 && (
              <button className="clear-cart-btn" onClick={clearCart}>
                Clear
              </button>
            )}
          </div>

          <div className="cart-wrapper">
          <Cart
            cart={cart}
            onUpdateQuantity={updateCartItemQuantity}
            onRemoveItem={removeFromCart}
            onClearCart={clearCart}
            subtotal={subtotal}
            tax={tax}
            grandTotal={grandTotal}
            taxBreakdown={breakdown}
          />
          </div>
          
          {cart.length > 0 && (
            <div className="cart-footer">
              <button
                className="checkout-btn"
                onClick={handleCheckoutClick}
              >
                Checkout
              </button>
            </div>
          )}
        </div>
      </div>

      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          onSyncComplete={handleSyncComplete}
        />
      )}
      {toastMessage && (
        <div className="pos-toast">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default POS;

