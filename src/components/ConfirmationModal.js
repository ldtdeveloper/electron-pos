import React from 'react';
import './ConfirmationModal.css';

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirm',
  message,
  confirmText = 'Yes',
  cancelText = 'No',
  confirmButtonColor = '#000000' // black by default
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handleBackdropClick = (e) => {
    // Close modal when clicking on backdrop
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="confirmation-modal-overlay" onClick={handleBackdropClick}>
      <div className="confirmation-modal">
        <div className="confirmation-modal-header">
          <h2 className="confirmation-modal-title">{title}</h2>
          <button 
            className="confirmation-modal-close" 
            onClick={handleCancel}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        
        <div className="confirmation-modal-body">
          <p className="confirmation-modal-message">{message}</p>
        </div>
        
        <div className="confirmation-modal-footer">
          <button 
            className="confirmation-modal-btn confirmation-modal-btn-cancel"
            onClick={handleCancel}
          >
            {cancelText}
          </button>
          <button 
            className="confirmation-modal-btn confirmation-modal-btn-confirm"
            onClick={handleConfirm}
            style={{ backgroundColor: confirmButtonColor }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;