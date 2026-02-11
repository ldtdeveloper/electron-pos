import React from 'react';
import './NumericKeypad.css';

const NumericKeypad = ({ onInput }) => {
  const buttons = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    '+/-', '0', 'delete'
  ];

  const handleClick = (value) => {
    if (onInput) {
      onInput(value);
    }
  };

  return (
    <div className="numeric-keypad">
      {buttons.map((btn) => (
        <button
          key={btn}
          className={`keypad-btn ${btn === 'delete' ? 'keypad-btn-delete' : ''}`}
          onClick={() => handleClick(btn)}
        >
          {btn === 'delete' ? 'Delete' : btn}
        </button>
      ))}
    </div>
  );
};

export default NumericKeypad;
