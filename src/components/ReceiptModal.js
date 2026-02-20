import React from 'react';
import './ReceiptModal.css';

const ReceiptModal = ({ 
  isOpen, 
  onClose, 
  invoiceData,
  onNewOrder,
  onPrintReceipt,
  onEmailReceipt
}) => {
  if (!isOpen || !invoiceData) return null;

  const {
    storeName = 'Rahul Builders Store',
    invoiceNumber,
    soldBy,
    customer,
    items = [],
    netTotal,
    tax,
    taxLabel = 'IGST',
    grandTotal,
    paymentMethod = 'Cash',
    paidAmount,
    status = 'Paid'
  } = invoiceData;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handlePrint = () => {
    if (onPrintReceipt) {
      onPrintReceipt();
    } else {
      window.print();
    }
  };

  const handleEmail = () => {
    if (onEmailReceipt) {
      onEmailReceipt();
    } else {
      alert('Email receipt functionality coming soon!');
    }
  };

  const handleNewOrder = () => {
    if (onNewOrder) {
      onNewOrder();
    }
    onClose();
  };

  return (
    <div className="receipt-modal-overlay" onClick={handleBackdropClick}>
      <div className="receipt-modal-content">
        {/* Header Section */}
        <div className="receipt-header">
          <div className="receipt-header-left">
            <h2 className="receipt-store-name">{storeName}</h2>
            <p className="receipt-sold-by">Sold by: {soldBy}</p>
          </div>
          <div className="receipt-header-right">
            <div className="receipt-total-amount">₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="receipt-invoice-number">{invoiceNumber}</div>
            <span className="receipt-status-badge">{status}</span>
          </div>
        </div>

        {/* Items Section */}
        <div className="receipt-section">
          <h3 className="receipt-section-title">Items</h3>
          <div className="receipt-items">
            {items.map((item, index) => (
              <div key={index} className="receipt-item">
                <span className="receipt-item-name">{item.name}</span>
                <div className="receipt-item-details">
                  <span className="receipt-item-quantity">{item.quantity}{item.uom}</span>
                  <span className="receipt-item-amount">₹ {item.amount.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals Section */}
        <div className="receipt-section">
          <h3 className="receipt-section-title">Totals</h3>
          <div className="receipt-totals">
            <div className="receipt-total-row">
              <span>Net Total</span>
              <span>₹ {netTotal.toFixed(2)}</span>
            </div>
            <div className="receipt-total-row">
              <span>{taxLabel}</span>
              <span>₹ {tax.toFixed(2)}</span>
            </div>
            <div className="receipt-total-row receipt-grand-total">
              <span>Grand Total</span>
              <span>₹ {grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payments Section */}
        <div className="receipt-section">
          <h3 className="receipt-section-title">Payments</h3>
          <div className="receipt-payments">
            <div className="receipt-payment-row">
              <span>{paymentMethod}</span>
              <span>₹ {paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="receipt-actions">
          {/* For now only show New Order button as requested */}
          <button className="receipt-btn receipt-btn-primary" onClick={handleNewOrder}>
            New Order
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
