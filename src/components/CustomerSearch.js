import React, { useState, useEffect, useRef } from 'react';
import { searchCustomers } from '../services/storage';
import { searchCustomersFromERPNext } from '../services/api';
import { isOnline } from '../utils/onlineStatus';
import './CustomerSearch.css';

const CustomerSearch = ({ selectedCustomer, onSelectCustomer, onClearCustomer }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
          results = await searchCustomersFromERPNext(term, 10);
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

  const handleClear = () => {
    setSearchTerm('');
    setCustomers([]);
    setIsOpen(false);
    onClearCustomer();
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
        {selectedCustomer && (
          <button
            className="customer-clear-btn"
            onClick={handleClear}
            title="Clear customer"
          >
            ×
          </button>
        )}
        {isLoading && (
          <span className="customer-search-loading">⏳</span>
        )}
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
    </div>
  );
};

export default CustomerSearch;

