import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import usePOSStore from '../store/posStore';
import { getDutiesAndTaxes, getPOSProfile, getPOSProfileData, saveSalesInvoice, addToSyncQueue } from '../services/storage';
import { calculateCartTax } from '../utils/taxCalculator';
import { getCompanyState } from '../utils/companyState';
import { isOnline } from '../utils/onlineStatus';
import { submitAndPaySalesInvoicePOS, createSalesInvoicePOS } from '../services/api';
import NumericKeypad from '../components/NumericKeypad';
import InvoiceItemCart from '../components/InvoiceItemCart';
import ConfirmationModal from '../components/ConfirmationModal';
import ReceiptModal from '../components/ReceiptModal';
import './CompleteOrder.css';

const CompleteOrder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, customer, clearCart } = usePOSStore();

  // When coming from POS checkout in online mode, we may have an ERP Sales Invoice draft
  const erpInvoice = location.state?.erpInvoice || null;
  // When checkout was done offline, we get this so we can queue submit_and_pay for the same draft
  const offlineCheckoutOrderId = location.state?.offlineCheckoutOrderId || null;

  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [discountInput, setDiscountInput] = useState('');
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [dutiesAndTaxes, setDutiesAndTaxes] = useState(null);
  const [companyState, setCompanyState] = useState('');

  useEffect(() => {
    getDutiesAndTaxes().then(setDutiesAndTaxes);
    getCompanyState(getPOSProfile, getPOSProfileData).then(setCompanyState);
  }, []);

  const taxResult = useMemo(() => {
    if (!dutiesAndTaxes?.taxes?.length) {
      const sub = cart.reduce((s, i) => s + (i.rate || 0) * (i.quantity || 0), 0);
      return { subtotal: sub, totalTax: 0, grandTotal: sub };
    }
    return calculateCartTax(cart, customer, dutiesAndTaxes, companyState);
  }, [cart, customer, dutiesAndTaxes, companyState]);

  // Base totals from local calculator
  let { subtotal, totalTax: tax, grandTotal: baseGrandTotal, breakdown } = taxResult;

  // If we have an ERP invoice (online), prefer its totals & taxes for display
  const hasErpInvoice = isOnline() && erpInvoice;
  if (hasErpInvoice) {
    subtotal = erpInvoice.net_total ?? subtotal;
    baseGrandTotal = erpInvoice.grand_total ?? baseGrandTotal;

    const erpTaxes = Array.isArray(erpInvoice.taxes_and_charges_applied)
      ? erpInvoice.taxes_and_charges_applied
      : [];

    if (erpTaxes.length > 0) {
      tax =
        erpInvoice.total_taxes_and_charges ??
        erpTaxes.reduce((sum, t) => sum + (t.tax_amount || 0), 0);

      breakdown = erpTaxes.map((t) => ({
        label: t.description || t.account_head || 'Tax',
        rate: t.rate ?? 0,
        amount: t.tax_amount ?? 0,
      }));
    }
  }
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

  const handleConfirmSubmit = async () => {
    const customerName = customer?.customer_name || customer?.name || 'Guest';
    const company = 'LDT TECH';
    const modeOfPayment = paymentMethod === 'cash' ? 'Cash' : paymentMethod;

    // Online mode with ERP invoice: submit & pay via API
    if (hasErpInvoice) {
      try {
        await submitAndPaySalesInvoicePOS({
          salesInvoice: erpInvoice.name,
          modeOfPayment,
        });
        // Success - proceed to show receipt
      } catch (error) {
        console.error('Failed to submit & pay Sales Invoice via API:', error);
        // Queue for retry when online
        try {
          await addToSyncQueue({
            type: 'invoice',
            action: 'submit_and_pay',
            data: {
              erpInvoiceName: erpInvoice.name,
              modeOfPayment,
              customerName,
              company,
              cartItems: cart,
            },
          });
          alert('Payment failed. Queued for retry. Showing local receipt.');
        } catch (queueError) {
          console.error('Failed to queue payment:', queueError);
          alert('Payment failed. Please try again later.');
        }
      }
    } else if (!isOnline()) {
      // Offline mode: save invoice locally and queue for sync when back online
      try {
        const localInvoice = {
          customer: customerName,
          date: new Date().toISOString().split('T')[0],
          items: cart.map(item => ({
            item_code: item.item_code,
            item_name: item.item_name,
            quantity: item.quantity,
            rate: item.rate,
            uom: item.uom || 'Nos',
          })),
          taxes: '',
          total: subtotal,
          grand_total: grandTotal,
          payment_method: modeOfPayment,
          paid_amount: paidAmount,
        };

        const localInvoiceId = await saveSalesInvoice(localInvoice);

        // If checkout was done offline, we already have create_draft in queue; queue submit_and_pay for that draft
        if (offlineCheckoutOrderId) {
          await addToSyncQueue({
            type: 'invoice',
            action: 'submit_and_pay',
            data: {
              orderId: offlineCheckoutOrderId,
              modeOfPayment,
              localInvoiceId,
            },
          });
          console.log('Payment queued for sync (will use draft from checkout queue)');
        } else {
          await addToSyncQueue({
            type: 'invoice',
            action: 'create_and_pay',
            data: {
              customerName,
              company,
              cartItems: cart,
              modeOfPayment,
              localInvoiceId,
            },
          });
          console.log('Invoice saved locally and queued for sync when online');
        }
      } catch (error) {
        console.error('Error saving invoice locally:', error);
        alert('Error saving invoice. Please try again.');
        return;
      }
    } else {
      // Online but no ERP invoice: create draft, then submit & pay
      try {
        // Create draft invoice
        const newErpInvoice = await createSalesInvoicePOS({
          customerName,
          company,
          cartItems: cart,
        });

        // Submit and pay
        await submitAndPaySalesInvoicePOS({
          salesInvoice: newErpInvoice.name,
          modeOfPayment,
        });
        // Success - proceed to show receipt
      } catch (error) {
        console.error('Failed to create and submit invoice:', error);
        // Queue for retry
        try {
          await addToSyncQueue({
            type: 'invoice',
            action: 'create_and_pay',
            data: {
              customerName,
              company,
              cartItems: cart,
              modeOfPayment,
            },
          });
          alert('Invoice creation failed. Queued for retry. Showing local receipt.');
        } catch (queueError) {
          console.error('Failed to queue invoice:', queueError);
          alert('Failed to create invoice. Please try again.');
        }
      }
    }

    // Prepare receipt data (UI only)
    const receipt = {
      storeName: 'Rahul Builders Store',
      invoiceNumber: (hasErpInvoice && erpInvoice.name) || 'DRAFT',
      soldBy: 'akash@yopmail.com', // TODO: get from user session/settings
      customer: customer?.customer_name || 'Guest',
      items: cart.map((item) => ({
        name: item.item_name || item.name,
        quantity: item.quantity,
        uom: item.uom || 'Kg',
        amount: item.rate * item.quantity,
      })),
      netTotal: subtotal,
      tax: tax,
      taxLabel: breakdown?.some((b) => b.label === 'CGST') ? 'CGST + SGST' : 'IGST',
      grandTotal: grandTotal,
      paymentMethod: paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1),
      paidAmount: paidAmount,
      status: 'Paid',
    };

    setReceiptData(receipt);
    setShowConfirmModal(false);
    setShowReceiptModal(true);
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

  const handleReceiptNewOrder = () => {
    clearCart();
    setCashAmount('');
    setDiscountPercentage(0);
    setDiscountInput('');
    setRedeemPoints(false);
    setShowReceiptModal(false);
    navigate('/pos');
  };

  const handlePrintReceipt = () => {
    // Implement print functionality
    // window.print();
  };

  const handleEmailReceipt = () => {
    // Implement email functionality
    // alert('Email receipt functionality will be implemented soon!');
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
            erpInvoice={hasErpInvoice ? erpInvoice : null}
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
        message="Permanently Submit?"
        confirmText="Yes"
        cancelText="No"
        confirmButtonColor="#2563eb"
      />

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        invoiceData={receiptData}
        onNewOrder={handleReceiptNewOrder}
        onPrintReceipt={handlePrintReceipt}
        onEmailReceipt={handleEmailReceipt}
      />
    </div>
  );
};

export default CompleteOrder;