import React, { useState } from 'react';
import './InvoiceItemCart.css';

const InvoiceItemCart = ({ customer, cart, subtotal, tax, grandTotal, discountPercentage, discountAmount, onEditCart, onDiscountChange }) => {
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountInputValue, setDiscountInputValue] = useState('');

  const getInitials = (name) => {
    if (!name) return 'G';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleDiscountClick = () => {
    setShowDiscountInput(true);
    setDiscountInputValue(discountPercentage > 0 ? discountPercentage.toString() : '');
  };

  const handleDiscountInputChange = (e) => {
    let value = e.target.value;
    
    // Remove the % symbol if user types it
    value = value.replace('%', '');
    
    // Allow only numbers and decimal point
    value = value.replace(/[^0-9.]/g, '');
    
    // Prevent multiple decimal points
    const decimalCount = (value.match(/\./g) || []).length;
    if (decimalCount > 1) {
      return;
    }
    
    // Update the input display value
    setDiscountInputValue(value);
    
    // Parse and validate the numeric value
    const numValue = parseFloat(value) || 0;
    
    // Limit to maximum 100%
    if (numValue > 100) {
      setDiscountInputValue('100');
      onDiscountChange('100'); // Pass string instead of number
    } else {
      onDiscountChange(value); // Pass string instead of number
    }
  };

  const handleDiscountBlur = () => {
    if (discountPercentage > 0) {
      setShowDiscountInput(false);
    } else {
      setShowDiscountInput(false);
      setDiscountInputValue('');
    }
  };

  const handleDiscountKeyDown = (e) => {
    // Allow these keys without restriction
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    
    if (allowedKeys.includes(e.key)) {
      if (e.key === 'Enter') {
        handleDiscountBlur();
      }
      return;
    }
    
    // Allow Ctrl/Cmd shortcuts
    if (e.ctrlKey || e.metaKey) {
      return;
    }
    
    // Allow decimal point only if not already present
    if (e.key === '.' && !discountInputValue.includes('.')) {
      return;
    }
    
    // Only allow numbers
    if (e.key < '0' || e.key > '9') {
      e.preventDefault();
    }
  };

  return (
    <div className="invoice-item-cart">
      {/* Customer Section */}
      <div className="customer-section">
        <div className="customer-avatar">
          {getInitials(customer?.customer_name || 'Guest')}
        </div>
        <div className="customer-info">
          <h3>{customer?.customer_name || 'Guest'}</h3>
          <p>Click to add email / phone</p>
        </div>
      </div>

      {/* Item Cart */}
      <div className="item-cart-section">
        <h4>Item Cart</h4>
        <div className="item-cart-header">
          <span>Item</span>
          <span>Quantity</span>
          <span>Amount</span>
        </div>

        <div className="item-cart-list">
          {cart.length === 0 ? (
            <div className="empty-cart">
              <p>No items in cart</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.item_code} className="cart-item-row">
                <div className="item-info">
                  <div className="item-avatar">
                    {getInitials(item.item_name)}
                  </div>
                  <span className="item-name">{item.item_name}</span>
                </div>
                <span className="item-quantity">{item.quantity} Kg</span>
                <span className="item-amount">₹ {(item.rate * item.quantity).toFixed(2)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Discount */}
      <div className="discount-section">
        {!showDiscountInput && discountPercentage === 0 ? (
          // State 1: Show "Add Discount" button initially
          <button className="discount-btn" onClick={handleDiscountClick}>
            <span className="discount-icon">%</span>
            Add Discount
          </button>
        ) : discountPercentage > 0 && !showDiscountInput ? (
          // State 2: Show "Applied" message when discount is set
          <div className="discount-applied" onClick={handleDiscountClick}>
            <span className="discount-icon-check">✓</span>
            <span>Additional {discountPercentage}% discount applied</span>
          </div>
        ) : (
          // State 3: Show input field with % suffix
          <div className="discount-input-wrapper">
            <input
              type="text"
              className="discount-input"
              placeholder="0"
              value={discountInputValue}
              onChange={handleDiscountInputChange}
              onBlur={handleDiscountBlur}
              onKeyDown={handleDiscountKeyDown}
              autoFocus
              maxLength="6"
            />
            <span className="discount-percentage-symbol">%</span>
            {parseFloat(discountInputValue) > 100 && (
              <span className="discount-error">Max 100%</span>
            )}
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="totals-section">
        <div className="total-row">
          <span>Total Quantity</span>
          <span>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
        </div>
        <div className="total-row">
          <span>Net Total</span>
          <span>₹ {subtotal.toFixed(2)}</span>
        </div>
        <div className="total-row">
          <span>IGST</span>
          <span>₹ {tax.toFixed(2)}</span>
        </div>
        {discountPercentage > 0 && (
          <div className="total-row discount-row">
            <span>Discount ({discountPercentage}%)</span>
            <span>- ₹ {discountAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="total-row grand-total-row">
          <span>Grand Total</span>
          <span>₹ {(grandTotal - discountAmount).toFixed(2)}</span>
        </div>
      </div>

      {/* Edit Cart Button */}
      <div className="edit-cart-section">
        <button className="edit-cart-btn" onClick={onEditCart}>
          Edit Cart
        </button>
      </div>
    </div>
  );
};

export default InvoiceItemCart;