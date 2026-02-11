import React from 'react';
import './ProductList.css';

const ProductList = ({ products, onAddToCart, isLoading }) => {
  if (isLoading) {
    return (
      <div className="product-list-loading">
        <p>Loading products…</p>
      </div>
    );
  }

  if (!products?.length) {
    return (
      <div className="product-list-empty">
        <p>No products found.</p>
        <p style={{ fontSize: '0.95rem', marginTop: '0.5rem' }}>
          Please sync products from ERPNext.
        </p>
      </div>
    );
  }

  return (
    <div className="product-grid">
      {products.map((product) => {
        const qty = product.actual_qty ?? product.qty ?? 0;
        const price = product.rate || product.standard_rate || 0;

        return (
          <div
            key={product.item_code}
            className="product-card"
            onClick={() => onAddToCart(product)}
          >
            <div className="stock-badge">
              <span className={`stock-indicator ${qty > 0 ? 'in-stock' : 'out-of-stock'}`}>
                ●
              </span>
              <span className="stock-quantity">{qty}</span>
            </div>

            <div className="product-visual">
              <div className="product-abbr">
                {product.item_code.substring(0, 2).toUpperCase()}
              </div>
            </div>

            <div className="product-content">
              {product.description && (
                <div className="product-dimensions">
                  {product.description}
                </div>
              )}

              <div className="product-name">{product.item_name}</div>

              <div className="product-price-uom">
                ₹{price.toFixed(0)}
                <span className="product-qty">/{product.stock_uom || 'Nos'}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProductList;