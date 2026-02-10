import React from 'react';
import './ProductList.css';

const ProductList = ({ products, onAddToCart, isLoading }) => {
  if (isLoading) {
    return (
      <div className="product-list-loading">
        <p>Loading products...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="product-list-empty">
        <p>No products found. Please sync products from ERPNext.</p>
      </div>
    );
  }

  return (
    <div className="product-list">
      {products.map((product) => (
        <div
          key={product.item_code}
          className="product-list-item"
          onClick={() => onAddToCart(product)}
        >
          <div className="product-info">
            <div className="product-main-info">
              <h3>{product.item_name}</h3>
              <p className="product-code">{product.item_code}</p>
            </div>
            <p className="product-price">₹{(product.rate || product.standard_rate || 0).toFixed(2)}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProductList;

