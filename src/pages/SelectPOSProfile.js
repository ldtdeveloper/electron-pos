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
} from '../services/api';
import { isOnline } from '../utils/onlineStatus';
import './SelectPOSProfile.css';

const SelectPOSProfile = () => {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const handleContinue = async () => {
    try {
      if (!selectedProfile) {
        setError('Please select a POS profile.');
        return;
      }

      // Persist selected profile for later API calls (items search needs it)
      await savePOSProfile(selectedProfile);

      // Prefetch/cache required data for offline mode
      // - POS Profile data (allowed profiles etc.)
      // - Customers
      // - Products/Items (for selected POS profile)
      // - Price list from the selected POS profile
      if (isOnline()) {
        const session = await getLoginSession();
        let profileData = null;
        if (session?.email) {
          profileData = await fetchPOSProfileData(session.email);
          await savePOSProfileData(profileData);
        }

        // Determine price list from selected POS profile
        // profileData can be:
        // - array of profiles
        // - or an object with data/message holding the array
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

        // Save price list derived from POS profile for later searches
        if (priceListFromProfile) {
          await savePriceList(priceListFromProfile);
        }

        // Customers: use ERPNext search endpoint with empty txt + large page_length
        const customers = await searchCustomersFromERPNext('', 10000);
        await saveCustomers(customers);

        // Items: use POS get_items endpoint with selected profile
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
      }

      navigate('/pos');
    } catch (err) {
      console.error('Error saving POS profile:', err);
      setError(err?.message || 'Failed to save POS profile / offline data. Please try again.');
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
    </div>
  );
};

export default SelectPOSProfile;




