import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import { saveSetting, saveLoginSession } from '../services/storage';
import { setApiBaseURL, updateSavedCredentials } from '../services/api';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError('Please enter your username.');
      return;
    }

    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }

    try {
      setIsLoading(true);
      
      // Step 1: Get CSRF token, then Step 2: Login with token
      const response = await login(username.trim(), password);
      const msg = response && response.message;
      const successValue =
        (msg && (msg.success ?? msg.success_key)) ??
        response?.success ??
        response?.success_key ??
        0;

      const isSuccess = successValue === 1 || successValue === '1' || successValue === true;

      if (isSuccess) {
        // Normalise source of login data (sometimes nested under message)
        const src = msg && typeof msg === 'object' ? msg : response || {};

        // Save full login response data locally
        const loginData = {
          success_key: src.success_key ?? src.success ?? successValue,
          message: src.message,
          sid: src.sid,
          api_key: response.data.api_key,
          api_secret: response.data.api_secret,
          username: src.username,
          email: response.data.email,
          base_url: src.base_url || 'http://192.168.1.81:8000',
        };
        
        // Save login session data to storage
        await saveLoginSession(loginData);
        
        // Save base URL separately for easy access
        await saveSetting('erpnext_base_url', loginData.base_url);
        setApiBaseURL(loginData.base_url);
        
        // Update API service with credentials for immediate use
        if (loginData.api_key && loginData.api_secret) {
          updateSavedCredentials(loginData.api_key, loginData.api_secret);
        }
        
        // Navigate to POS profile selection screen after successful login
        navigate('/select-pos-profile');
      } else {
        const errorMessage =
          (msg &&
            (typeof msg === 'string'
              ? msg
              : msg.message)) ||
          'Authentication failed. Please check your username and password.';
        setError(errorMessage);
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Login</h1>
        <p className="login-subtitle">
          Please enter your credentials to continue
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="login-label">Username</label>
            <input
              type="text"
              className="login-input"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="login-label">Password</label>
            <input
              type="password"
              className="login-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button
            type="submit"
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;

