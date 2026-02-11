import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import usePOSStore from '../store/posStore';
import { saveSalesInvoice, getSetting, getLoginSession, savePOSProfileData } from '../services/storage';
import { syncInvoices } from '../services/syncService';
import { updateSavedCredentials, setApiBaseURL, fetchPOSProfileData } from '../services/api';
import { isOnline, addOnlineListener, addOfflineListener } from '../utils/onlineStatus';
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
    addToCart,
    removeFromCart,
    updateCartItemQuantity,
    clearCart,
    setCustomer,
    clearCustomer,
    loadProducts,
    searchProducts,
    getCartSubtotal,
    getCartTax,
    getCartGrandTotal,
  } = usePOSStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [onlineStatus, setOnlineStatus] = useState(isOnline());
  const [isSyncing, setIsSyncing] = useState(false);

  const handleAutoSync = useCallback(async () => {
    if (isOnline()) {
      setIsSyncing(true);
      try {
        await syncInvoices();
      } catch (error) {
        console.error('Auto-sync failed:', error);
      } finally {
        setIsSyncing(false);
      }
    }
  }, []);

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
      
      // Load products and tax rate
      loadProducts();
      loadTaxRate();
      
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

  const loadTaxRate = async () => {
    const rate = await getSetting('tax_rate');
    if (rate) {
      setTaxRate(parseFloat(rate));
    }
  };

  const loadPOSProfileData = async () => {
    try {
      const session = await getLoginSession();
      if (!session?.email) return;
      const profileData = await fetchPOSProfileData(session.email);
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
    loadTaxRate();
  };

  const subtotal = getCartSubtotal();
  const tax = getCartTax(taxRate);
  const grandTotal = getCartGrandTotal(taxRate);

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

          <Cart
            cart={cart}
            onUpdateQuantity={updateCartItemQuantity}
            onRemoveItem={removeFromCart}
            onClearCart={clearCart}
            subtotal={subtotal}
            tax={tax}
            grandTotal={grandTotal}
          />
          
          {cart.length > 0 && (
            <div className="cart-footer">
              <button
                className="checkout-btn"
                onClick={() => navigate('/complete-order')}
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
    </div>
  );
};

export default POS;

