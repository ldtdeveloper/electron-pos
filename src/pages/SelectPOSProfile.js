import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getLoginSession,
  savePOSProfile,
  getPOSProfile,
  getPOSProfileData,
  savePOSProfileData,
  saveCustomers,
  saveProducts,
  getPriceList,
  savePriceList,
} from '../services/storage';
import {
  fetchPOSProfileData,
  searchCustomersFromERPNext,
  searchProductsFromERPNext,
  getPOSProfileDetails,
  createOpeningVoucher,
  checkOpeningEntry,
} from '../services/api';
import POSOpeningEntryModal from '../components/POSOpeningEntryModal';
import { isOnline } from '../utils/onlineStatus';
import './SelectPOSProfile.css';

const SelectPOSProfile = () => {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [profileDetails, setProfileDetails] = useState(null);
  const [isCreatingOpening, setIsCreatingOpening] = useState(false);
  const [openingError, setOpeningError] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const session = await getLoginSession();
        if (!session) {
          navigate('/login');
          return;
        }

        // Try to load previously selected profile
        const savedProfile = await getPOSProfile();
        if (savedProfile) {
          setSelectedProfile(savedProfile);
        }

        // Load POS profiles:
        // - online: fetch from API and cache
        // - offline: read from local cache
        let profileData = null;
        if (isOnline()) {
          profileData = await fetchPOSProfileData(session.email);
          await savePOSProfileData(profileData);
        } else {
          profileData = await getPOSProfileData();
        }

        let availableProfiles = [];

        // 1) If API returned an array (e.g. [{ name: 'Ambika-Ventures(Dera Bassi)', ... }, ...])
        if (Array.isArray(profileData)) {
          availableProfiles = profileData;
        }
        // 2) Try common shapes where allowed profiles might be listed
        else if (Array.isArray(profileData.profiles)) {
          availableProfiles = profileData.profiles;
        } else if (Array.isArray(profileData.pos_profiles)) {
          availableProfiles = profileData.pos_profiles;
        } else if (Array.isArray(profileData.allowed_pos_profiles)) {
          availableProfiles = profileData.allowed_pos_profiles;
        }

        // Normalize to list of strings
        const profileList = availableProfiles
          .map((p) => (typeof p === 'string' ? p : p?.name || p?.pos_profile))
          .filter(Boolean);

        const uniqueProfiles = Array.from(new Set(profileList));
        setProfiles(uniqueProfiles);

        // If nothing selected yet, default to first available profile
        if (!savedProfile && uniqueProfiles.length > 0) {
          setSelectedProfile(uniqueProfiles[0]);
        }
      } catch (err) {
        console.error('Error loading POS profiles:', err);
        setError('Failed to load POS profiles. Please try again.');
        setProfiles([]);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [navigate]);

  // Helper function to prefetch customers and products data
  const prefetchData = async () => {
    if (!isOnline()) {
      return; // Skip prefetching in offline mode
    }

    try {
      const session = await getLoginSession();
      
      // Fetch and save POS profile data
      let profileData = null;
      if (session?.email) {
        profileData = await fetchPOSProfileData(session.email);
        await savePOSProfileData(profileData);
      }

      // Determine price list from selected POS profile
      if (!profileData) {
        profileData = await getPOSProfileData();
      }

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

      // Save price list derived from POS profile
      if (priceListFromProfile) {
        await savePriceList(priceListFromProfile);
      }

      // Prefetch customers
      console.log('Prefetching customers...');
      const customers = await searchCustomersFromERPNext('', 10000);
      await saveCustomers(customers);
      console.log(`Prefetched ${customers.length} customers`);

      // Prefetch products/items
      console.log('Prefetching products...');
      const effectivePriceList = priceListFromProfile || (await getPriceList()) || '';
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
    } catch (error) {
      console.error('Error prefetching data:', error);
      // Don't throw - allow navigation to continue even if prefetch fails
    }
  };

  const handleContinue = async () => {
    try {
      if (!selectedProfile) {
        setError('Please select a POS profile.');
        return;
      }

      // Persist selected profile for later API calls
      await savePOSProfile(selectedProfile);

      // Always fetch profile details and show opening entry modal
      if (isOnline()) {
        const details = await getPOSProfileDetails(selectedProfile);
        setProfileDetails(details);
        setShowOpeningModal(true);
      } else {
        // In offline mode, navigate directly to POS
        navigate('/pos');
      }
    } catch (err) {
      console.error('Error fetching profile details:', err);
      setError(err.message || 'Failed to load profile details.');
    }
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

  const handleBackToLogin = () => {
    setShowOpeningModal(false);
    navigate('/login');
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

      // Always prefetch fresh data after creating opening entry
      await prefetchData();

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

  const handleLogout = () => {
    navigate('/login');
  };

  return (
    <div className="pos-profile-container">
      <div className="pos-profile-card">
        <h1 className="pos-profile-title">Select POS Profile</h1>
        <p className="pos-profile-subtitle">Choose the POS profile attached to your user.</p>

        {error && <div className="pos-profile-error">{error}</div>}

        <div className="pos-profile-field">
          <label className="pos-profile-label">POS Profile</label>
          <select
            className="pos-profile-select"
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            disabled={isLoading}
          >
            {profiles.map((profile) => (
              <option key={profile} value={profile}>
                {profile}
              </option>
            ))}
          </select>
        </div>

        <div className="pos-profile-actions">
          <button
            className="pos-profile-button secondary"
            type="button"
            onClick={handleLogout}
            disabled={isLoading}
          >
            Back to Login
          </button>
          <button
            className="pos-profile-button primary"
            type="button"
            onClick={handleContinue}
            disabled={isLoading || !selectedProfile}
          >
            {isLoading ? 'Loading…' : 'Continue to POS'}
          </button>
        </div>
      </div>

      <POSOpeningEntryModal
        isOpen={showOpeningModal}
        onClose={() => setShowOpeningModal(false)}
        onSubmit={handleOpeningSubmit}
        onBackToLogin={handleBackToLogin}
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

export default SelectPOSProfile;
