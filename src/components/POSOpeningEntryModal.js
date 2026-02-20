import React, { useState, useEffect } from 'react';
import './POSOpeningEntryModal.css';

const POSOpeningEntryModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  onBackToLogin,
  company, 
  posProfile, 
  profiles = [],
  onProfileChange,
  paymentMethods,
  isLoading = false,
  error = null 
}) => {

  const [selectedProfile, setSelectedProfile] = useState('');
  const [balanceDetails, setBalanceDetails] = useState([]);

  // Initialize payment methods only after profile is selected
  useEffect(() => {
    if (selectedProfile && paymentMethods && paymentMethods.length > 0) {
      const initialBalances = paymentMethods.map((payment, index) => ({
        idx: index + 1,
        mode_of_payment: payment.mode_of_payment,
        opening_amount: 0,
        name: `row_${index}`,
        __checked: 1,
      }));
      setBalanceDetails(initialBalances);
    } else {
      setBalanceDetails([]);
    }
  }, [selectedProfile, paymentMethods]);

  const handleProfileSelect = (value) => {
    setSelectedProfile(value);
    if (onProfileChange) {
      onProfileChange(value);
    }
  };

  const handleAmountChange = (index, value) => {
    const newBalanceDetails = [...balanceDetails];
    newBalanceDetails[index].opening_amount = parseFloat(value) || 0;
    setBalanceDetails(newBalanceDetails);
  };

  const handleCheckboxChange = (index) => {
    const newBalanceDetails = [...balanceDetails];
    newBalanceDetails[index].__checked =
      newBalanceDetails[index].__checked ? 0 : 1;
    setBalanceDetails(newBalanceDetails);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const checkedBalances = balanceDetails.filter(
      balance => balance.__checked === 1
    );
    onSubmit(checkedBalances);
  };

  if (!isOpen) return null;

  return (
    <div className="pos-opening-overlay">
      <div className="pos-opening-content">
        <div className="pos-opening-header">
          <h2 className="pos-opening-title">Create POS Opening Entry</h2>
        </div>

        <form onSubmit={handleSubmit} className="pos-opening-form">
          <div className="pos-opening-body">

            {/* POS Profile Field (Always Visible) */}
            <div className="form-field">
              <label className="field-label">
                POS Profile <span className="required">*</span>
              </label>

              <select
                className="field-input"
                value={selectedProfile}
                onChange={(e) => handleProfileSelect(e.target.value)}
                disabled={isLoading}
              >
                <option value="" disabled>
                  Select POS Profile
                </option>

                {profiles.map((profile) => (
                  <option key={profile} value={profile}>
                    {profile}
                  </option>
                ))}
              </select>
            </div>

            {/* Show Company + Payment only after POS selected */}
            {selectedProfile && (
              <>
                {/* Company Field */}
                <div className="form-field">
                  <label className="field-label">
                    Company <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="field-input disabled"
                    value={company}
                    disabled
                  />
                </div>

                {/* Opening Balance Details */}
                <div className="balance-section">
                  <h3 className="section-title">Opening Balance Details</h3>

                  <div className="balance-table">
                    <div className="table-header">
                      <div className="header-cell checkbox-cell"></div>
                      <div className="header-cell payment-cell">
                        Mode of Payment <span className="required">*</span>
                      </div>
                      <div className="header-cell amount-cell">
                        Opening Amount
                      </div>
                    </div>

                    {balanceDetails.map((balance, index) => (
                      <div key={balance.name} className="table-row">
                        <div className="table-cell checkbox-cell">
                          <input
                            type="checkbox"
                            checked={balance.__checked === 1}
                            onChange={() => handleCheckboxChange(index)}
                            className="row-checkbox"
                          />
                        </div>
                        <div className="table-cell payment-cell">
                          <span className="payment-name">
                            {balance.mode_of_payment}
                          </span>
                        </div>
                        <div className="table-cell amount-cell">
                          <input
                            type="number"
                            className="amount-input"
                            value={balance.opening_amount}
                            onChange={(e) =>
                              handleAmountChange(index, e.target.value)
                            }
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            disabled={balance.__checked === 0}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="pos-opening-error">
                {error}
              </div>
            )}
          </div>

          <div className="pos-opening-footer">
            <button
              type="button"
              className="back-button"
              onClick={onBackToLogin}
              disabled={isLoading}
            >
              Back to Login
            </button>

            <button
              type="submit"
              className="submit-button"
              disabled={isLoading || !selectedProfile}
            >
              {isLoading ? 'Creating...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default POSOpeningEntryModal;
