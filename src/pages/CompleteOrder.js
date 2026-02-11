import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import usePOSStore from '../store/posStore';
import NumericKeypad from '../components/NumericKeypad';
import InvoiceItemCart from '../components/InvoiceItemCart';
import ConfirmationModal from '../components/ConfirmationModal';
import './CompleteOrder.css';

const CompleteOrder = () => {
  const navigate = useNavigate();
  const {
    cart,
    customer,
    getCartSubtotal,
    getCartTax,
    getCartGrandTotal,
    clearCart,
  } = usePOSStore();

  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [discountInput, setDiscountInput] = useState(''); // Raw input without %
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [invoiceNumber] = useState('SINV-26-00028'); // You can generate this dynamically

  const taxRate = 18; // IGST rate
  const subtotal = getCartSubtotal();
  const tax = getCartTax(taxRate);
  const baseGrandTotal = getCartGrandTotal(taxRate);
  const discountAmount = (baseGrandTotal * discountPercentage) / 100;
  const grandTotal = baseGrandTotal - discountAmount;
  
  // Initialize cashAmount with grandTotal and update when grandTotal changes
  const [cashAmount, setCashAmount] = useState(grandTotal.toFixed(2));
  
  // Update cashAmount when grandTotal changes (e.g., when discount is applied)
  useEffect(() => {
    setCashAmount(grandTotal.toFixed(2));
  }, [grandTotal]);
  
  const paidAmount = paymentMethod === 'cash' ? parseFloat(cashAmount || 0) : grandTotal;
  const remainingAmount = Math.max(0, grandTotal - paidAmount);
  const changeAmount = Math.max(0, paidAmount - grandTotal);
  const isChangeScenario = paidAmount > grandTotal;

  const handleKeypadInput = (value) => {
    if (value === 'delete') {
      const newAmount = cashAmount.slice(0, -1);
      // If empty or only has a decimal point, set to '0'
      if (newAmount === '' || newAmount === '.') {
        setCashAmount('0');
      } else {
        setCashAmount(newAmount);
      }
    } else if (value === '+/-') {
      // Toggle positive/negative (not typically used for payment)
      if (cashAmount && cashAmount[0] === '-') {
        setCashAmount(cashAmount.slice(1));
      } else if (cashAmount) {
        setCashAmount('-' + cashAmount);
      }
    } else if (value === '.') {
      // Only add decimal point if not already present
      if (!cashAmount.includes('.')) {
        setCashAmount(cashAmount + value);
      }
    } else {
      // For numeric input, if current value is '0', replace it instead of appending
      if (cashAmount === '0') {
        setCashAmount(value);
      } else {
        setCashAmount(cashAmount + value);
      }
    }
  };

  const handleCompleteOrder = () => {
    if (cart.length === 0) {
      alert('Cart is empty!');
      return;
    }

    if (remainingAmount > 0) {
      alert('Payment amount is insufficient!');
      return;
    }

    // Show confirmation modal
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = () => {
    // Process the order after confirmation
    console.log('Order completed successfully!');
    // Here you can add your API call or order submission logic
    // submitOrderToAPI(invoiceNumber, cart, grandTotal, etc.);
    
    clearCart();
    setCashAmount('');
    setDiscountPercentage(0);
    setDiscountInput('');
    navigate('/pos');
  };

  const handleEditCart = () => {
    navigate('/pos');
  };

  const handleNewInvoice = () => {
    clearCart();
    setCashAmount('');
    setDiscountPercentage(0);
    setDiscountInput('');
    setRedeemPoints(false);
  };

  const handleDiscountChange = (value) => {
    // Convert to string if it's a number
    const stringValue = typeof value === 'string' ? value : String(value);
    
    // Remove any non-numeric characters except decimal point
    const numericValue = stringValue.replace(/[^0-9.]/g, '');
    
    // Parse the value
    const parsedValue = parseFloat(numericValue) || 0;
    
    // Limit to 100%
    if (parsedValue > 100) {
      setDiscountInput('100');
      setDiscountPercentage(100);
    } else {
      setDiscountInput(numericValue);
      setDiscountPercentage(parsedValue);
    }
  };

  const handleRecentOrders = () => {
    // Navigate to orders page (to be implemented)
    alert('Recent Orders feature coming soon!');
  };

  return (
    <div className="complete-order-container">
      <header className="complete-order-header">
        <div className="header-left">
          <h1>Complete Order</h1>
          <span className="pos-badge">pos3</span>
        </div>
        <div className="header-right">
          <button className="header-btn" onClick={handleRecentOrders}>
            Recent Orders
          </button>
          <button className="header-btn header-btn-primary" onClick={handleNewInvoice}>
            New Invoice
          </button>
        </div>
      </header>

      <div className="complete-order-main">
        {/* Left Panel - Cart & Customer */}
        <div className="complete-order-left">
          <InvoiceItemCart
            customer={customer}
            cart={cart}
            subtotal={subtotal}
            tax={tax}
            grandTotal={baseGrandTotal}
            discountPercentage={discountPercentage}
            discountInput={discountInput}
            discountAmount={discountAmount}
            onEditCart={handleEditCart}
            onDiscountChange={handleDiscountChange}
          />
        </div>

        {/* Right Panel - Payment */}
        <div className="complete-order-right">
          <div className="payment-section">
            <h3>Payment Method</h3>
            <div className="payment-method-selector">
              <button
                className={`payment-method-option ${paymentMethod === 'cash' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('cash')}
              >
                Cash
                {paymentMethod === 'cash' && (
                  <span className="payment-amount">₹ {cashAmount || grandTotal.toFixed(2)}</span>
                )}
              </button>
            </div>

            <div className="loyalty-section">
              <label className="loyalty-checkbox">
                <input
                  type="checkbox"
                  checked={redeemPoints}
                  onChange={(e) => setRedeemPoints(e.target.checked)}
                />
                <span>Redeem Loyalty Points</span>
              </label>
            </div>

            <div className="keypad-section">
              <NumericKeypad onInput={handleKeypadInput} />
            </div>

            <div className="payment-summary">
              <div className="summary-column">
                <span className="summary-label">Grand Total</span>
                <span className="summary-value">₹ {grandTotal.toFixed(2)}</span>
              </div>
              <div className="summary-column">
                <span className="summary-label">Paid Amount</span>
                <span className="summary-value">₹ {paidAmount.toFixed(2)}</span>
              </div>
              <div className="summary-column">
                <span className="summary-label">
                  {isChangeScenario ? 'Change Amount' : 'Remaining Amount'}
                </span>
                <span className={`summary-value ${isChangeScenario ? 'change' : 'remaining'}`}>
                  ₹ {isChangeScenario ? changeAmount.toFixed(2) : remainingAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              className="complete-order-btn"
              onClick={handleCompleteOrder}
              disabled={cart.length === 0 || (remainingAmount > 0 && !isChangeScenario)}
            >
              Complete Order
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubmit}
        title="Confirm"
        message={`Permanently Submit ${invoiceNumber}?`}
        confirmText="Yes"
        cancelText="No"
        confirmButtonColor="#2563eb"
      />
    </div>
  );
};

export default CompleteOrder;