import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSetting, saveSetting, clearLoginSession, getPOSProfile, savePOSProfile, getPriceList, savePriceList } from '../services/storage';
import { setApiBaseURL, getApiBaseURL, updateSavedCredentials } from '../services/api';
import { syncProducts, syncCustomers, performFullSync } from '../services/syncService';
import './Settings.css';

const Settings = ({ onClose, onSyncComplete }) => {
  const navigate = useNavigate();
  const [baseURL, setBaseURL] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [posProfile, setPOSProfile] = useState('');
  const [priceList, setPriceList] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const savedBaseURL = await getSetting('erpnext_base_url');
    const savedTaxRate = await getSetting('tax_rate');
    const savedPOSProfile = await getPOSProfile();
    const savedPriceList = await getPriceList();

    if (savedBaseURL) setBaseURL(savedBaseURL);
    if (savedTaxRate) setTaxRate(savedTaxRate);
    if (savedPOSProfile) setPOSProfile(savedPOSProfile);
    if (savedPriceList) setPriceList(savedPriceList);

    if (savedBaseURL) {
      setApiBaseURL(savedBaseURL);
    }
  };

  const handleSyncProducts = async () => {
    setIsLoading(true);
    setSyncStatus(null);

    try {
      await saveSetting('erpnext_base_url', baseURL);
      setApiBaseURL(baseURL);

      const result = await syncProducts();
      setSyncStatus({ success: true, message: `Synced ${result.count} products successfully` });
      
      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (error) {
      setSyncStatus({ success: false, message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncCustomers = async () => {
    setIsLoading(true);
    setSyncStatus(null);

    try {
      await saveSetting('erpnext_base_url', baseURL);
      setApiBaseURL(baseURL);

      const result = await syncCustomers();
      setSyncStatus({ success: true, message: `Synced ${result.count} customers successfully` });
    } catch (error) {
      setSyncStatus({ success: false, message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFullSync = async () => {
    setIsLoading(true);
    setSyncStatus(null);

    try {
      await saveSetting('erpnext_base_url', baseURL);
      setApiBaseURL(baseURL);

      const result = await performFullSync();
      const messages = [];
      if (result.products.success) messages.push(`${result.products.count} products`);
      if (result.customers.success) messages.push(`${result.customers.count} customers`);
      if (result.invoices.success) messages.push(`${result.invoices.results.length} invoices`);
      
      setSyncStatus({ 
        success: true, 
        message: `Synced: ${messages.join(', ')}` 
      });
      
      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (error) {
      setSyncStatus({ success: false, message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    await saveSetting('erpnext_base_url', baseURL);
    await saveSetting('tax_rate', taxRate);
    await savePOSProfile(posProfile);
    await savePriceList(priceList);
    setApiBaseURL(baseURL);
    
    if (onClose) {
      onClose();
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout? This will clear all settings and session data.')) {
      // Clear login session
      await clearLoginSession();
      
      // Clear API credentials
      updateSavedCredentials('', '');
      
      // Clear settings
      await saveSetting('erpnext_base_url', '');
      setApiBaseURL('');
      setBaseURL('');
      setSyncStatus(null);
      
      alert('Logged out successfully.');
      
      if (onClose) {
        onClose();
      }
      navigate('/login');
    }
  };

  return (
    <div className="settings">
      <div className="settings-header">
        <h2>Settings</h2>
        <button className="settings-close" onClick={onClose}>×</button>
      </div>

      <div className="settings-body">
        <div className="settings-section">
          <h3>ERPNext Configuration</h3>
          
          <div className="settings-field">
            <label>Base URL</label>
            <input
              type="text"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              placeholder="http://localhost:8000"
              className="settings-input"
            />
          </div>
        </div>

        <div className="settings-section">
          <h3>POS Configuration</h3>
          
          <div className="settings-field">
            <label>POS Profile</label>
            <input
              type="text"
              value={posProfile}
              onChange={(e) => setPOSProfile(e.target.value)}
              placeholder="Enter POS Profile name"
              className="settings-input"
            />
            <p className="field-hint">Required for product search</p>
          </div>

          <div className="settings-field">
            <label>Price List</label>
            <input
              type="text"
              value={priceList}
              onChange={(e) => setPriceList(e.target.value)}
              placeholder="Enter Price List name"
              className="settings-input"
            />
            <p className="field-hint">Required for product search</p>
          </div>
        </div>

        <div className="settings-section">
          <h3>Tax Configuration</h3>
          
          <div className="settings-field">
            <label>Tax Rate (%)</label>
            <input
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              placeholder="0"
              min="0"
              max="100"
              step="0.01"
              className="settings-input"
            />
          </div>
        </div>

        <div className="settings-section">
          <h3>Sync Data</h3>
          <p className="settings-description">
            Download products and customers from ERPNext to use offline
          </p>
          
          <div className="settings-actions">
            <button
              className="btn-primary"
              onClick={handleSyncProducts}
              disabled={isLoading || !baseURL}
            >
              {isLoading ? 'Syncing...' : 'Sync Products'}
            </button>
            <button
              className="btn-primary"
              onClick={handleSyncCustomers}
              disabled={isLoading || !baseURL}
            >
              {isLoading ? 'Syncing...' : 'Sync Customers'}
            </button>
            <button
              className="btn-primary"
              onClick={handleFullSync}
              disabled={isLoading || !baseURL}
            >
              {isLoading ? 'Syncing...' : 'Full Sync'}
            </button>
          </div>

          {syncStatus && (
            <div className={`status-message ${syncStatus.success ? 'success' : 'error'}`}>
              {syncStatus.message}
            </div>
          )}
        </div>

        <div className="settings-section">
          <h3>Account</h3>
          <p className="settings-description">
            Logout to clear all settings
          </p>
          
          <div className="settings-actions">
            <button
              className="btn-logout"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="settings-footer">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={handleSave}>
          Save Settings
        </button>
      </div>
    </div>
  );
};

export default Settings;

