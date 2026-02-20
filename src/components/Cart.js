import React from 'react';
import './Cart.css';

const Cart = ({ cart, onUpdateQuantity, onRemoveItem, onClearCart, subtotal, tax, grandTotal, taxBreakdown = [] }) => {
  if (cart.length === 0) {
    return (
      <div className="cart-empty">
        <p>Cart is empty</p>
        <span>Add products to get started</span>
      </div>
    );
  }

  return (
    <div className="cart">
      <div className="cart-items-scroll">
        {cart.map((item) => (
          <div key={item.item_code} className="cart-item">
            <div className="cart-item-info">
              <h4>{item.item_name}</h4>
              <p className="cart-item-code">{item.item_code}</p>
              <p className="cart-item-price">₹{item.rate.toFixed(2)} × {item.quantity}</p>
            </div>
            <div className="cart-item-actions">
              <div className="quantity-controls">
                <button
                  className="quantity-btn"
                  onClick={() => onUpdateQuantity(item.item_code, item.quantity - 1)}
                >
                  −
                </button>
                <span className="quantity-value">{item.quantity}</span>
                <button
                  className="quantity-btn"
                  onClick={() => onUpdateQuantity(item.item_code, item.quantity + 1)}
                >
                  +
                </button>
              </div>
              <div className="cart-item-total">
                ₹{(item.rate * item.quantity).toFixed(2)}
              </div>
              <button
                className="remove-item-btn"
                onClick={() => onRemoveItem(item.item_code)}
                title="Remove item"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="cart-summary">
        <div className="summary-row">
          <span>Subtotal:</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>
        {taxBreakdown.length > 0 ? (
          taxBreakdown.map((b) => (
            <div key={`${b.label}-${b.rate}`} className="summary-row">
              <span>{b.label} ({b.rate}%):</span>
              <span>₹{b.amount.toFixed(2)}</span>
            </div>
          ))
        ) : (
          <div className="summary-row">
            <span>Tax:</span>
            <span>₹{tax.toFixed(2)}</span>
          </div>
        )}
        <div className="summary-row summary-total">
          <span>Total:</span>
          <span>₹{Math.round(grandTotal).toLocaleString('en-IN')}</span>
        </div>
      </div>
    </div>
  );
};

export default Cart;



