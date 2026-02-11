import React, { useState } from 'react';
import './InvoiceItemCart.css';

const InvoiceItemCart = ({ customer, cart, subtotal, tax, grandTotal, discountPercentage, discountAmount, onEditCart, onDiscountChange }) => {
  const [showDiscountInput, setShowDiscountInput] = useState(false);

  const getInitials = (name) => {
    if (!name) return 'G';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleDiscountClick = () => {
    if (discountPercentage > 0) {
      // If discount is applied, clicking shows the input again
      setShowDiscountInput(true);
    } else {
      // If no discount, show input
      setShowDiscountInput(true);
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
          // State 3: Show input field
          <input
            type="text"
            className="discount-input"
            placeholder="10%"
            value={discountPercentage ? `${discountPercentage}%` : ''}
            onChange={(e) => {
              const value = e.target.value.replace('%', '');
              const numValue = parseFloat(value) || 0;
              onDiscountChange(numValue);
              if (numValue > 0) {
                // Hide input and show applied message after entering value
                setTimeout(() => setShowDiscountInput(false), 500);
              }
            }}
            onBlur={() => {
              if (discountPercentage > 0) {
                setShowDiscountInput(false);
              }
            }}
            autoFocus
          />
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
