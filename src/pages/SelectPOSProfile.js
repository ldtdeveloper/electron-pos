import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLoginSession, savePOSProfile, getPOSProfile } from '../services/storage';
import { fetchPOSProfileData } from '../services/api';
import './SelectPOSProfile.css';

const DEFAULT_PROFILE = 'pos3';

const SelectPOSProfile = () => {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(DEFAULT_PROFILE);
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

        // Fetch POS profile data to determine which profiles are available to this user
        // Backend may return:
        // - a plain array: [{ name, warehouse, company }, ...]
        // - or an object with profiles / pos_profiles / allowed_pos_profiles
        const profileData = await fetchPOSProfileData(session.email);

        let availableProfiles = [];

        // 1) If API returned an array (e.g. [{ name: 'pos3', ... }, ...])
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

        // Normalize to list of strings; always include DEFAULT_PROFILE as fallback
        const uniqueProfiles = new Set(
          availableProfiles
            .map(p => (typeof p === 'string' ? p : p.name || p.pos_profile))
            .filter(Boolean)
        );
        uniqueProfiles.add(DEFAULT_PROFILE);

        // Ensure DEFAULT_PROFILE is always the first option in the dropdown
        const profileList = [
          ...Array.from(uniqueProfiles).filter(p => p !== DEFAULT_PROFILE),
        ];

        setProfiles(profileList);
      } catch (err) {
        console.error('Error loading POS profiles:', err);
        setError('Failed to load POS profiles. Please try again or contact admin.');
        setProfiles([DEFAULT_PROFILE]);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [navigate]);

  const handleContinue = async () => {
    try {
      await savePOSProfile(selectedProfile || DEFAULT_PROFILE);
      navigate('/pos');
    } catch (err) {
      console.error('Error saving POS profile:', err);
      setError('Failed to save POS profile. Please try again.');
    }
  };

  const handleLogout = () => {
    navigate('/login');
  };

  return (
    <div className="pos-profile-container">
      <div className="pos-profile-card">
        <h1 className="pos-profile-title">Select POS Profile</h1>
        <p className="pos-profile-subtitle">
          Choose the POS profile attached to your user. Default is <strong>{DEFAULT_PROFILE}</strong>.
        </p>

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




