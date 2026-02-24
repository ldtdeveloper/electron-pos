import React, { useState, useEffect, useRef } from 'react';
import { searchCustomers, saveCustomers, addToSyncQueue } from '../services/storage';
import { searchCustomersFromERPNext, createCustomer } from '../services/api';
import { isOnline } from '../utils/onlineStatus';
import './CustomerSearch.css';

const CustomerSearch = ({ selectedCustomer, onSelectCustomer, onClearCustomer }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (searchTerm.length > 0) {
      handleSearch(searchTerm);
    } else {
      setCustomers([]);
      setIsOpen(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        searchRef.current &&
        !searchRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearch = async (term) => {
    setIsLoading(true);
    try {
      let results = [];
      
      // If online, search from ERPNext API
      if (isOnline()) {
        try {
          results = await searchCustomersFromERPNext(term);
        } catch (apiError) {
          console.warn('Online customer search failed, falling back to local:', apiError);
          // Fall through to local search
          results = await searchCustomers(term);
        }
      } else {
        // Offline - search local storage
        results = await searchCustomers(term);
      }
      
      setCustomers(results);
      setIsOpen(results.length > 0);
    } catch (error) {
      console.error('Error searching customers:', error);
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (customer) => {
    onSelectCustomer(customer);
    setSearchTerm(customer.customer_name);
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    if (!e.target.value) {
      onClearCustomer();
    }
  };

  const handleInputFocus = () => {
    if (customers.length > 0 && searchTerm.length > 0) {
      setIsOpen(true);
    }
  };

  const openCreateDialog = () => {
    setCreateError('');
    setNewCustomerName(searchTerm || '');
    setNewCustomerEmail('');
    setNewCustomerPhone('');
    setShowCreateDialog(true);
  };

  const closeCreateDialog = () => {
    if (isCreating) return;
    setShowCreateDialog(false);
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();

    const name = newCustomerName.trim();
    const phone = newCustomerPhone.trim();
    const email = newCustomerEmail.trim();

    if (!name || !phone) {
      setCreateError('Name and phone number are required.');
      return;
    }

    try {
      setIsCreating(true);
      setCreateError('');

      let created;

      if (isOnline()) {
        // Online: create via API
        try {
          created = await createCustomer({
            name,
            email: email || null,
            phone,
          });
        } catch (apiError) {
          // If API fails but we're online, queue for retry
          const tempCustomer = {
            name: `TEMP-${Date.now()}`,
            customer_name: name,
            customer_type: 'Individual',
            phone_number: phone,
            email_id: email || '',
          };
          
          await saveCustomers([tempCustomer]);
          await addToSyncQueue({
            type: 'customer',
            action: 'create',
            data: { name, email, phone },
          });
          
          created = tempCustomer;
          setCreateError('Customer created locally. Will sync when connection is restored.');
        }
      } else {
        // Offline: save locally and queue for sync
        const tempCustomer = {
          name: `TEMP-${Date.now()}`,
          customer_name: name,
          customer_type: 'Individual',
          phone_number: phone,
          email_id: email || '',
        };
        
        await saveCustomers([tempCustomer]);
        await addToSyncQueue({
          type: 'customer',
          action: 'create',
          data: { name, email, phone },
        });
        
        created = tempCustomer;
        setCreateError('Customer created locally. Will sync when connection is restored.');
      }

      onSelectCustomer(created);
      setSearchTerm(created.customer_name);
      setCustomers([]);
      setIsOpen(false);
      setShowCreateDialog(false);
    } catch (error) {
      setCreateError(error.message || 'Failed to create customer.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="customer-search">
      <div className="customer-search-input-wrapper" ref={searchRef}>
        <input
          type="text"
          placeholder={selectedCustomer ? selectedCustomer.customer_name : "Search customer..."}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          className="customer-search-input"
        />
        {isLoading && (
          <span className="customer-search-loading">⏳</span>
        )}
        <button
          type="button"
          className="customer-create-btn"
          onClick={openCreateDialog}
        >
          + Create
        </button>
      </div>
      
      {isOpen && customers.length > 0 && (
        <div className="customer-dropdown" ref={dropdownRef}>
          {customers.map((customer) => (
            <div
              key={customer.name}
              className={`customer-dropdown-item ${selectedCustomer?.name === customer.name ? 'selected' : ''}`}
              onClick={() => handleSelect(customer)}
            >
              <div className="customer-item-name">{customer.customer_name}</div>
              {customer.territory && (
                <div className="customer-item-territory">{customer.territory}</div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {isOpen && customers.length === 0 && searchTerm.length > 0 && !isLoading && (
        <div className="customer-dropdown">
          <div className="customer-dropdown-empty">No customers found</div>
        </div>
      )}

      {showCreateDialog && (
        <div className="customer-create-modal-backdrop">
          <div className="customer-create-modal">
            <h3 className="customer-create-title">Create Customer</h3>
            <form onSubmit={handleCreateCustomer} className="customer-create-form">
              <div className="customer-create-field">
                <label className="customer-create-label">
                  Name <span className="customer-create-required">*</span>
                </label>
                <input
                  type="text"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="customer-create-input"
                  placeholder="Customer name"
                />
              </div>

              <div className="customer-create-field">
                <label className="customer-create-label">
                  Phone Number <span className="customer-create-required">*</span>
                </label>
                <input
                  type="tel"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="customer-create-input"
                  placeholder="Phone number"
                />
              </div>

              <div className="customer-create-field">
                <label className="customer-create-label">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                  className="customer-create-input"
                  placeholder="Email address"
                />
              </div>

              {createError && (
                <div className="customer-create-error">
                  {createError}
                </div>
              )}

              <div className="customer-create-actions">
                <button
                  type="button"
                  className="customer-create-cancel-btn"
                  onClick={closeCreateDialog}
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="customer-create-submit-btn"
                  disabled={isCreating}
                >
                  {isCreating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerSearch;

