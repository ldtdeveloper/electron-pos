import React from 'react';
import './OutdatedEntryModal.css';

const OutdatedEntryModal = ({ isOpen, onClose, onCancel, isLoading = false, error = null }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">⚠️ Outdated POS Opening Entry</h2>
          {!isLoading && (
            <button
              className="modal-close"
              onClick={onCancel}
              aria-label="Close modal"
            >
              ✕
            </button>
          )}
        </div>
        <div className="modal-body">
          <p>
            The current POS opening entry is outdated. Please close it and create a new one.
          </p>
          {error && (
            <div className="modal-error">
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button
            className="modal-button secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className="modal-button primary"
            onClick={onClose}
            disabled={isLoading}
          >
            {isLoading ? 'Closing...' : 'Close Entry'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OutdatedEntryModal;
