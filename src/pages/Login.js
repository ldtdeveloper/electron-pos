import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, checkOpeningEntry, getPOSClosingDataByOpeningEntry, savePOSClosingEntry, searchCustomersFromERPNext, searchProductsFromERPNext, fetchPOSProfileData, getPOSProfileDetails, createOpeningVoucher } from '../services/api';
import { saveSetting, saveLoginSession, saveCustomers, saveProducts, savePOSProfile, savePOSProfileData, getPOSProfileData, getPriceList, savePriceList, getPOSProfile } from '../services/storage';
import { setApiBaseURL, updateSavedCredentials } from '../services/api';
import OutdatedEntryModal from '../components/OutdatedEntryModal';
import POSOpeningEntryModal from '../components/POSOpeningEntryModal';
import { isOnline } from '../utils/onlineStatus';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showOutdatedModal, setShowOutdatedModal] = useState(false);
  const [isClosingEntry, setIsClosingEntry] = useState(false);
  const [closingError, setClosingError] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  
  // Opening entry modal state
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [profileDetails, setProfileDetails] = useState(null);
  const [isCreatingOpening, setIsCreatingOpening] = useState(false);
  const [openingError, setOpeningError] = useState(null);

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
        
        // Check POS opening entry before proceeding
        try {
          const openingEntryResponse = await checkOpeningEntry(loginData.email);
          console.log('Opening entry response:', openingEntryResponse);
          
          // Check if response has data and period_start_date
          if (openingEntryResponse && Array.isArray(openingEntryResponse) && openingEntryResponse.length > 0) {
            const openingEntry = openingEntryResponse[0];
            console.log('Opening entry:', openingEntry);
            
            if (openingEntry.period_start_date) {
              // Parse the period_start_date and check if it's from a previous day
              const periodStartDate = new Date(openingEntry.period_start_date);
              const today = new Date();
              
              console.log('Period start date (original):', openingEntry.period_start_date);
              console.log('Period start date (parsed):', periodStartDate);
              console.log('Today:', today);
              
              // Reset time to midnight for accurate date comparison
              periodStartDate.setHours(0, 0, 0, 0);
              today.setHours(0, 0, 0, 0);
              
              console.log('Period start date (midnight):', periodStartDate);
              console.log('Today (midnight):', today);
              console.log('Is outdated?', periodStartDate < today);
              
              // If the opening entry is from a previous day, show error modal
              if (periodStartDate < today) {
                console.log('Showing outdated modal');
                setUserEmail(loginData.email); // Store email for closing entry
                setShowOutdatedModal(true);
                setIsLoading(false); // Stop loading state
                return;
              }
              
              // If the opening entry is from today, prefetch data and navigate to POS
              if (periodStartDate.getTime() === today.getTime()) {
                console.log('Valid opening entry exists for today, prefetching data...');
                
                // Prefetch customers and products before navigating
                try {
                  if (isOnline()) {
                    // Get POS profile data
                    let profileData = await fetchPOSProfileData(loginData.email);
                    await savePOSProfileData(profileData);
                    
                    // Determine price list from POS profile
                    let profileArray = [];
                    if (Array.isArray(profileData)) {
                      profileArray = profileData;
                    } else if (Array.isArray(profileData?.data)) {
                      profileArray = profileData.data;
                    } else if (Array.isArray(profileData?.profiles)) {
                      profileArray = profileData.profiles;
                    } else if (Array.isArray(profileData?.pos_profiles)) {
                      profileArray = profileData.pos_profiles;
                    } else if (Array.isArray(profileData?.allowed_pos_profiles)) {
                      profileArray = profileData.allowed_pos_profiles;
                    }
                    
                    // Get the POS profile from opening entry
                    const posProfile = openingEntry.pos_profile;
                    await savePOSProfile(posProfile);
                    
                    const selectedProfileObj = profileArray.find(
                      (p) =>
                        (typeof p === 'object' && (p.name === posProfile || p.pos_profile === posProfile)) ||
                        p === posProfile
                    );
                    
                    const priceListFromProfile =
                      (selectedProfileObj && selectedProfileObj.selling_price_list) || '';
                    
                    if (priceListFromProfile) {
                      await savePriceList(priceListFromProfile);
                    }
                    
                    // Prefetch customers
                    console.log('Prefetching customers...');
                    const customers = await searchCustomersFromERPNext('', 10000);
                    await saveCustomers(customers);
                    console.log(`Prefetched ${customers.length} customers`);
                    
                    // Prefetch products
                    console.log('Prefetching products...');
                    const effectivePriceList = priceListFromProfile || '';
                    const items = await searchProductsFromERPNext(
                      '',
                      posProfile,
                      effectivePriceList,
                      '',
                      0,
                      10000
                    );
                    await saveProducts(items);
                    console.log(`Prefetched ${items.length} products`);
                  }
                } catch (prefetchError) {
                  console.error('Error prefetching data:', prefetchError);
                  // Continue to POS even if prefetch fails
                }
                
                navigate('/pos');
                return;
              }
            }
          }
        } catch (openingEntryError) {
          console.error('Error checking opening entry:', openingEntryError);
          // Continue to show opening entry modal even if opening entry check fails
        }
        
        // No valid opening entry - fetch profiles and show opening entry modal
        try {
          const profileData = await fetchPOSProfileData(loginData.email);
          await savePOSProfileData(profileData);
          
          let availableProfiles = [];
          if (Array.isArray(profileData)) {
            availableProfiles = profileData;
          } else if (Array.isArray(profileData?.profiles)) {
            availableProfiles = profileData.profiles;
          } else if (Array.isArray(profileData?.pos_profiles)) {
            availableProfiles = profileData.pos_profiles;
          } else if (Array.isArray(profileData?.allowed_pos_profiles)) {
            availableProfiles = profileData.allowed_pos_profiles;
          }
          
          const profileList = availableProfiles
            .map((p) => (typeof p === 'string' ? p : p?.name || p?.pos_profile))
            .filter(Boolean);
          
          const uniqueProfiles = Array.from(new Set(profileList));
          setProfiles(uniqueProfiles);
          
          if (uniqueProfiles.length > 0) {
            const firstProfile = uniqueProfiles[0];
            setSelectedProfile(firstProfile);
            await savePOSProfile(firstProfile);
            
            // Fetch profile details for the first profile
            const details = await getPOSProfileDetails(firstProfile);
            setProfileDetails(details);
            
            // Show opening entry modal
            setShowOpeningModal(true);
          }
        } catch (err) {
          console.error('Error loading profiles:', err);
          setError('Failed to load POS profiles. Please try again.');
        }
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

  const handleCloseEntry = async () => {
    try {
      setIsClosingEntry(true);
      setClosingError(null);

      // Step 1: Get the opening entry name
      const openingEntryResponse = await checkOpeningEntry(userEmail);
      
      if (!openingEntryResponse || !Array.isArray(openingEntryResponse) || openingEntryResponse.length === 0) {
        setClosingError('No opening entry found.');
        return;
      }

      const openingEntryName = openingEntryResponse[0].name;

      // Step 2: Get closing data
      const closingData = await getPOSClosingDataByOpeningEntry(openingEntryName);

      if (!closingData || !closingData.opening_entry) {
        setClosingError('Failed to fetch closing data.');
        return;
      }

      // Step 3: Build closing entry document
      const closingDoc = {
        doctype: 'POS Closing Entry',
        pos_opening_entry: closingData.opening_entry.name,
        period_start_date: closingData.period.start_date,
        period_end_date: closingData.period.end_date,
        posting_date: closingData.opening_entry.posting_date,
        pos_profile: closingData.pos_profile,
        user: closingData.user,
        company: closingData.company,
        grand_total: closingData.totals?.grand_total || 0,
        net_total: closingData.totals?.net_total || 0,
        total_quantity: closingData.totals?.total_quantity || 0,
        total_taxes_and_charges: closingData.totals?.total_taxes_and_charges || 0,
        
        // Payment reconciliation
        payment_reconciliation: (closingData.payment_reconciliation || []).map((payment, idx) => ({
          idx: idx + 1,
          mode_of_payment: payment.mode_of_payment,
          opening_amount: payment.opening_amount || 0,
          expected_amount: payment.expected_amount || 0,
          closing_amount: payment.closing_amount || 0,
          difference: payment.difference || 0,
          doctype: 'POS Closing Entry Detail',
        })),
        
        // Taxes
        taxes: (closingData.taxes || []).map((tax, idx) => ({
          idx: idx + 1,
          account_head: tax.account_head,
          tax_amount: tax.tax_amount || 0,
          doctype: 'POS Closing Entry Taxes',
        })),
        
        // Sales invoices
        sales_invoices: (closingData.invoices?.sales_invoices || []).map((invoice, idx) => ({
          idx: idx + 1,
          sales_invoice: invoice.invoice_name,
          grand_total: invoice.grand_total || 0,
          customer: invoice.customer,
          posting_date: invoice.posting_date,
          doctype: 'POS Closing Entry Invoice',
        })),
        
        // POS invoices
        pos_invoices: (closingData.invoices?.pos_invoices || []).map((invoice, idx) => ({
          idx: idx + 1,
          pos_invoice: invoice.invoice_name,
          grand_total: invoice.grand_total || 0,
          customer: invoice.customer,
          posting_date: invoice.posting_date,
          doctype: 'POS Closing Entry Invoice',
        })),
      };

      // Step 4: Submit the closing entry
      await savePOSClosingEntry(closingDoc, 'Submit');

      // Step 5: Close modal and navigate to POS profile selection
      // User will then select a profile and create a new opening entry
      setShowOutdatedModal(false);
      navigate('/select-pos-profile');
    } catch (err) {
      console.error('Error closing entry:', err);
      setClosingError(err.message || 'Failed to close POS opening entry. Please try again.');
    } finally {
      setIsClosingEntry(false);
    }
  };

  const handleCancelModal = () => {
    setShowOutdatedModal(false);
    setClosingError(null);
    // User stays on login page
  };

  const handleProfileChangeInModal = async (newProfile) => {
    setSelectedProfile(newProfile);
    await savePOSProfile(newProfile);
    
    // Fetch new profile details for the selected profile
    try {
      const details = await getPOSProfileDetails(newProfile);
      setProfileDetails(details);
    } catch (err) {
      console.error('Error fetching new profile details:', err);
    }
  };

  const handleBackToLoginFromModal = () => {
    setShowOpeningModal(false);
    setOpeningError(null);
    // User stays on login page
  };

  const handleOpeningSubmit = async (balanceDetails) => {
    try {
      setIsCreatingOpening(true);
      setOpeningError(null);

      // Create opening voucher
      await createOpeningVoucher(
        selectedProfile,
        profileDetails.company,
        balanceDetails
      );

      // Prefetch data
      if (isOnline()) {
        try {
          const session = await import('../services/storage').then(m => m.getLoginSession());
          const loginData = await session;
          
          // Get POS profile data
          let profileData = await fetchPOSProfileData(loginData.email);
          await savePOSProfileData(profileData);
          
          // Determine price list from POS profile
          let profileArray = [];
          if (Array.isArray(profileData)) {
            profileArray = profileData;
          } else if (Array.isArray(profileData?.data)) {
            profileArray = profileData.data;
          } else if (Array.isArray(profileData?.profiles)) {
            profileArray = profileData.profiles;
          } else if (Array.isArray(profileData?.pos_profiles)) {
            profileArray = profileData.pos_profiles;
          } else if (Array.isArray(profileData?.allowed_pos_profiles)) {
            profileArray = profileData.allowed_pos_profiles;
          }
          
          const selectedProfileObj = profileArray.find(
            (p) =>
              (typeof p === 'object' && (p.name === selectedProfile || p.pos_profile === selectedProfile)) ||
              p === selectedProfile
          );
          
          const priceListFromProfile =
            (selectedProfileObj && selectedProfileObj.selling_price_list) || '';
          
          if (priceListFromProfile) {
            await savePriceList(priceListFromProfile);
          }
          
          // Prefetch customers
          console.log('Prefetching customers...');
          const customers = await searchCustomersFromERPNext('', 10000);
          await saveCustomers(customers);
          console.log(`Prefetched ${customers.length} customers`);
          
          // Prefetch products
          console.log('Prefetching products...');
          const effectivePriceList = priceListFromProfile || '';
          const items = await searchProductsFromERPNext(
            '',
            selectedProfile,
            effectivePriceList,
            '',
            0,
            10000
          );
          await saveProducts(items);
          console.log(`Prefetched ${items.length} products`);
        } catch (prefetchError) {
          console.error('Error prefetching data:', prefetchError);
        }
      }

      // Close modal and navigate to POS
      setShowOpeningModal(false);
      navigate('/pos');
    } catch (err) {
      console.error('Error creating opening entry:', err);
      setOpeningError(err?.message || 'Failed to create opening entry. Please try again.');
    } finally {
      setIsCreatingOpening(false);
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

      <OutdatedEntryModal 
        isOpen={showOutdatedModal}
        onClose={handleCloseEntry}
        onCancel={handleCancelModal}
        isLoading={isClosingEntry}
        error={closingError}
      />

      <POSOpeningEntryModal
        isOpen={showOpeningModal}
        onClose={() => setShowOpeningModal(false)}
        onSubmit={handleOpeningSubmit}
        onBackToLogin={handleBackToLoginFromModal}
        onProfileChange={handleProfileChangeInModal}
        company={profileDetails?.company || ''}
        posProfile={selectedProfile}
        profiles={profiles}
        paymentMethods={profileDetails?.payments || []}
        isLoading={isCreatingOpening}
        error={openingError}
      />
    </div>
  );
};

export default Login;
