import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/http';
import { useAuth } from '../context/AuthContext';

export default function CompleteProfilePage() {
  const navigate = useNavigate();
  const { setProfileComplete } = useAuth();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    dob: '',
    gender: '',
    university: '',
    major: '',
    graduationYear: '',
    country: '',
    city: '',
    dietaryRestrictions: '',
    githubUrl: '',
    linkedinUrl: '',
    portfolioUrl: '',
    activeHackathonId: '',
  });
  const [hackathons, setHackathons] = useState([]);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: profile info, 2: hackathon selection

  useEffect(() => {
    (async () => {
      try {
        const data = await api('/auth/me');
        const u = data.user || {};
        setForm((prev) => ({
          ...prev,
          firstName: u.first_name || prev.firstName,
          lastName: u.last_name || prev.lastName,
          phone: u.phone || prev.phone,
          dob: u.dob ? u.dob.split('T')[0] : prev.dob,
          gender: u.gender || prev.gender,
          university: u.university || prev.university,
          major: u.major || prev.major,
          graduationYear: u.graduation_year ? String(u.graduation_year) : prev.graduationYear,
          country: u.country || prev.country,
          city: u.city || prev.city,
          dietaryRestrictions: u.dietary_restrictions || prev.dietaryRestrictions,
          githubUrl: u.github_url || prev.githubUrl,
          linkedinUrl: u.linkedin_url || prev.linkedinUrl,
          portfolioUrl: u.portfolio_url || prev.portfolioUrl,
        }));
      } catch {
        // ignore prefill errors
      }

      // Load hackathons
      try {
        const hackData = await api('/hackathons');
        setHackathons(hackData.hackathons || []);
        if (hackData.hackathons?.[0]) {
          setForm(prev => ({ ...prev, activeHackathonId: hackData.hackathons[0].id }));
        }
      } catch {
        // ignore hackathon load errors
      }
    })();
  }, []);

  const submitProfileInfo = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validate all required fields for step 1
    const requiredFields = [
      'firstName', 'lastName', 'phone', 'dob', 'gender',
      'university', 'major', 'graduationYear',
      'dietaryRestrictions', 'githubUrl'
    ];
    
    const missingFields = requiredFields.filter(field => !form[field]);
    
    if (missingFields.length > 0) {
      setError('Please fill in all required fields to continue');
      return;
    }
    
    // Move to hackathon selection
    setStep(2);
  };

  const submitHackathonSelection = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!form.activeHackathonId) {
      setError('Please select a hackathon to continue');
      return;
    }
    
    try {
      await api('/profile/me', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          graduationYear: form.graduationYear ? Number(form.graduationYear) : null,
        }),
      });
      setProfileComplete(true);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="card">
      <h2>{step === 1 ? 'Complete Your Profile' : 'Select Active Hackathon'}</h2>
      <p className="form-subtitle">
        {step === 1 ? 'Fields marked with * are required. Please provide your information.' : 'Choose the hackathon you want to participate in.'}
      </p>
      
      {step === 1 ? (
        <form onSubmit={submitProfileInfo} className="profile-form">
          <div className="profile-grid">
            {/* Left Column */}
            <div className="profile-column">
              <h3>Personal Information</h3>
              
              <label>
                First Name <span className="required">*</span>
              </label>
              <input 
                type="text"
                placeholder="John" 
                value={form.firstName} 
                onChange={(e) => setForm({ ...form, firstName: e.target.value })} 
                required 
              />
              
              <label style={{ display: 'block', marginBottom: '0.5rem', marginTop: '1rem', fontWeight: '500' }}>
                Last Name <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input 
                type="text"
                placeholder="Doe" 
                value={form.lastName} 
                onChange={(e) => setForm({ ...form, lastName: e.target.value })} 
                required 
              />
              
              <label>
                Phone Number <span className="required">*</span>
              </label>
              <input 
                type="tel"
                placeholder="+1234567890" 
                value={form.phone} 
                onChange={(e) => setForm({ ...form, phone: e.target.value })} 
                required 
              />
              
              <label style={{ display: 'block', marginBottom: '0.5rem', marginTop: '1rem', fontWeight: '500' }}>
                Date of Birth <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input 
                type="date"
                value={form.dob} 
                onChange={(e) => setForm({ ...form, dob: e.target.value })} 
                max={new Date().toISOString().split('T')[0]}
                required 
              />
              
              <label>
                Gender <span className="required">*</span>
              </label>
              <select 
                value={form.gender} 
                onChange={(e) => setForm({ ...form, gender: e.target.value })} 
                required
              >
                <option value="">Select gender...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non-binary">Non-binary</option>
                <option value="other">Other</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
              
              <label style={{ display: 'block', marginBottom: '0.5rem', marginTop: '1rem', fontWeight: '500' }}>
                Country
              </label>
              <input 
                type="text"
                placeholder="United States" 
                value={form.country} 
                onChange={(e) => setForm({ ...form, country: e.target.value })} 
              />
              
              <label>
                City
              </label>
              <input 
                type="text"
                placeholder="Caldwell" 
                value={form.city} 
                onChange={(e) => setForm({ ...form, city: e.target.value })} 
              />
            </div>
            
            {/* Right Column */}
            <div className="profile-column">
              <h3>Academic & Other</h3>
              
              <label>
                University <span className="required">*</span>
              </label>
              <input 
                type="text"
                placeholder="Caldwell University" 
                value={form.university} 
                onChange={(e) => setForm({ ...form, university: e.target.value })} 
                required 
              />
              
              <label style={{ display: 'block', marginBottom: '0.5rem', marginTop: '1rem', fontWeight: '500' }}>
                Major <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input 
                type="text"
                placeholder="Computer Science" 
                value={form.major} 
                onChange={(e) => setForm({ ...form, major: e.target.value })} 
                required 
              />
              
              <label>
                Graduation Year <span className="required">*</span>
              </label>
              <input 
                type="number"
                placeholder="2025" 
                min="2020"
                max="2030"
                value={form.graduationYear} 
                onChange={(e) => setForm({ ...form, graduationYear: e.target.value })} 
                required 
              />
              
              <label style={{ display: 'block', marginBottom: '0.5rem', marginTop: '1rem', fontWeight: '500' }}>
                Dietary Restrictions <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input 
                type="text"
                placeholder="e.g., Vegetarian, Vegan, None, Nut allergy, etc." 
                value={form.dietaryRestrictions} 
                onChange={(e) => setForm({ ...form, dietaryRestrictions: e.target.value })} 
                required 
              />
              
              <label>
                GitHub URL <span className="required">*</span>
              </label>
              <input 
                type="url"
                placeholder="https://github.com/username" 
                value={form.githubUrl} 
                onChange={(e) => setForm({ ...form, githubUrl: e.target.value })} 
                required 
              />
              
              <label style={{ display: 'block', marginBottom: '0.5rem', marginTop: '1rem', fontWeight: '500' }}>
                LinkedIn URL 
              </label>
              <input 
                type="url"
                placeholder="https://linkedin.com/in/username" 
                value={form.linkedinUrl} 
                onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} 
                 
              />
              
              <label>
                Portfolio URL 
              </label>
              <input 
                type="url"
                placeholder="https://yourportfolio.com" 
                value={form.portfolioUrl} 
                onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })} 
                 
              />
            </div>
          </div>
          
          <button type="submit" className="submit-button">
            Next →
          </button>
        </form>
      ) : (
        <form onSubmit={submitHackathonSelection}>
          <label>
            Select Hackathon <span className="required">*</span>
          </label>
          <select 
            value={form.activeHackathonId} 
            onChange={(e) => setForm({ ...form, activeHackathonId: e.target.value })}
            required
          >
            <option value="">Choose a hackathon...</option>
            {hackathons.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} 
              </option>
            ))}
          </select>
          
          <div className="button-group">
            <button type="button" onClick={() => setStep(1)}>← Back</button>
            <button type="submit" className="button-primary">Complete Profile</button>
          </div>
        </form>
      )}
      
      {error && <p className="error">{error}</p>}
    </section>
  );
}
