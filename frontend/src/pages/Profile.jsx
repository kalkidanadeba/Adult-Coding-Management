import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import Navbar from '../components/common/Navbar';
import SiteFooter from '../components/common/SiteFooter';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { resolveUserAvatarUrl } from '../utils/profile';

const Profile = () => {
  const { user, updateProfile, changePassword, loading } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const previewUrl = useMemo(() => {
    if (!profilePhoto) {
      return '';
    }

    return URL.createObjectURL(profilePhoto);
  }, [profilePhoto]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const currentPhoto = useMemo(() => {
    if (previewUrl) {
      return previewUrl;
    }

    return resolveUserAvatarUrl(user);
  }, [previewUrl, user]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormError('');
    setSuccessMessage('');
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
    setFormError('');
    setSuccessMessage('');
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    setProfilePhoto(file);
    setFormError('');
    setSuccessMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');

    if (!formData.name.trim()) {
      setFormError('Your name is required.');
      return;
    }

    // Validate password fields if filled
    if (passwordData.newPassword || passwordData.confirmPassword) {
      if (!passwordData.currentPassword) {
        setFormError('Current password is required to set a new password.');
        return;
      }

      if (passwordData.newPassword.length < 8) {
        setFormError('Password must be at least 8 characters long.');
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setFormError('Passwords do not match.');
        return;
      }
    }

    try {
      // Update profile (name and photo)
      const profileResult = await updateProfile({
        name: formData.name.trim(),
        photo: profilePhoto || undefined,
      });

      if (!profileResult.success) {
        setFormError(profileResult.error || 'Unable to update profile.');
        return;
      }

      // If password fields are filled, also change password
      if (passwordData.newPassword) {
        const passwordResult = await changePassword({
          currentPassword: passwordData.currentPassword || '',
          newPassword: passwordData.newPassword,
        });

        if (!passwordResult.success) {
          setFormError(passwordResult.error || 'Password update failed.');
          // Profile was updated, so show partial success
          setSuccessMessage('Profile updated, but password change failed.');
          return;
        }
      }

      setSuccessMessage('Your profile was updated successfully.');
      setProfilePhoto(null);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch {
      setFormError('An unexpected error occurred.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 py-10">
        <div className="w-full max-w-4xl px-4 mx-auto">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700">
            <FaArrowLeft aria-hidden="true" /> Back to dashboard
          </Link>

          <Card className="max-w-3xl mx-auto mt-6" noPadding>
            <div className="p-8">
              <div className="mb-8">
                <h1 className="text-3xl font-semibold text-gray-900">Profile</h1>
                <p className="mt-2 text-sm text-gray-600">
                  Update your display name, password, or profile photo.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                  <div>
                    <Input
                      label="Name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Enter your name"
                      required
                    />
                  </div>
                  <div>
                    <Input
                      label="Email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Your email address"
                      disabled
                    />
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1fr_1fr_1fr]">
                  <div>
                    <Input
                      label="Current password"
                      name="currentPassword"
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      placeholder="Enter current password"
                      showPasswordToggle
                    />
                  </div>
                  <div>
                    <Input
                      label="New password"
                      name="newPassword"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      placeholder="Leave blank to keep current password"
                      showPasswordToggle
                    />
                  </div>
                  <div>
                    <Input
                      label="Confirm new password"
                      name="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      placeholder="Confirm new password"
                      showPasswordToggle
                    />
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1fr_180px] items-start">
                  <div>
                    <label className="input-label" htmlFor="photo">
                      Profile photo
                    </label>
                    <input
                      id="photo"
                      name="photo"
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="mt-2 block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />
                    <p className="mt-2 text-sm text-gray-500">
                      Upload a new avatar image for your account.
                    </p>
                  </div>

                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto h-40 w-40 overflow-hidden rounded-3xl bg-gray-100 border border-gray-200 flex items-center justify-center">
                        {currentPhoto ? (
                          <img
                            src={currentPhoto}
                            alt="Profile preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-gray-400">No photo</span>
                        )}
                      </div>
                      <p className="mt-3 text-sm text-gray-500">Current profile photo</p>
                    </div>
                  </div>
                </div>

                {formError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {formError}
                  </div>
                )}
                {successMessage && (
                  <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    {successMessage}
                  </div>
                )}

                <div className="pt-2">
                  <Button type="submit" loading={loading} className="w-full">
                    Save changes
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
        <SiteFooter />
      </main>
    </div>
  );
};

export default Profile;
