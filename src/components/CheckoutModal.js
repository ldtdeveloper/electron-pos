import React, { useState } from 'react';
import './CheckoutModal.css';

const CheckoutModal = ({ isOpen, onClose, cart, totals, onCheckout, customer }) => {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    setIsProcessing(true);
    try {
      await onCheckout({
        customer: customer?.name || customer?.customer_name || 'Guest',
        paymentMethod,
        amountReceived: paymentMethod === 'cash' ? parseFloat(amountReceived) : totals.grandTotal,
      });
      
      // Reset form
      setPaymentMethod('cash');
      setAmountReceived('');
      onClose();
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Error processing checkout. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const change = paymentMethod === 'cash' && amountReceived 
    ? parseFloat(amountReceived) - totals.grandTotal 
    : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Checkout</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="checkout-section">
            <label>Customer</label>
            <input
              type="text"
              value={customer?.customer_name || 'Guest'}
              disabled
              className="checkout-input"
            />
          </div>

          <div className="checkout-section">
            <label>Payment Method</label>
            <div className="payment-methods">
              <button
                className={`payment-method-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('cash')}
              >
                Cash
              </button>
              <button
                className={`payment-method-btn ${paymentMethod === 'card' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('card')}
              >
                Card
              </button>
              <button
                className={`payment-method-btn ${paymentMethod === 'upi' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('upi')}
              >
                UPI
              </button>
            </div>
          </div>

          {paymentMethod === 'cash' && (
            <div className="checkout-section">
              <label>Amount Received</label>
              <input
                type="number"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                placeholder="0.00"
                className="checkout-input"
                min={totals.grandTotal}
                step="0.01"
              />
            </div>
          )}

          <div className="checkout-summary">
            <div className="summary-row">
              <span>Subtotal:</span>
              <span>₹{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Tax:</span>
              <span>₹{totals.tax.toFixed(2)}</span>
            </div>
            <div className="summary-row summary-total">
              <span>Total:</span>
              <span>₹{totals.grandTotal.toFixed(2)}</span>
            </div>
            {paymentMethod === 'cash' && change > 0 && (
              <div className="summary-row summary-change">
                <span>Change:</span>
                <span>₹{change.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={isProcessing}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleCheckout}
            disabled={isProcessing || cart.length === 0 || (paymentMethod === 'cash' && (!amountReceived || parseFloat(amountReceived) < totals.grandTotal))}
          >
            {isProcessing ? 'Processing...' : 'Complete Payment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;

