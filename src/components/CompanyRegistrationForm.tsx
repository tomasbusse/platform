import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface CompanyFormData {
  name: string;
  contactEmail: string;
  contactPhone: string;
  domain: string;
  description: string;
  maxStudents: number;
  address: string;
}

interface CompanyRegistrationFormProps {
  onSubmit: (data: CompanyFormData) => void;
  isLoading?: boolean;
}

const CompanyRegistrationForm: React.FC<CompanyRegistrationFormProps> = ({
  onSubmit,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<CompanyFormData>({
    name: '',
    contactEmail: '',
    contactPhone: '',
    domain: '',
    description: '',
    maxStudents: 50,
    address: '',
  });

  const [errors, setErrors] = useState<Partial<CompanyFormData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<CompanyFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Company name is required';
    }

    if (!formData.contactEmail.trim()) {
      newErrors.contactEmail = 'Contact email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      newErrors.contactEmail = 'Please enter a valid email address';
    }

    if (formData.domain && !/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(formData.domain)) {
      newErrors.domain = 'Please enter a valid domain';
    }

    if (formData.maxStudents < 1) {
      newErrors.maxStudents = 'Max students must be at least 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'maxStudents' ? parseInt(value) || 0 : value,
    }));
    
    // Clear error when user starts typing
    if (errors[name as keyof CompanyFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Register Your Company
        </h2>
        <p className="text-gray-600">
          Set up your organization's language training program. Get started with a 30-day trial.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Company Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your company name"
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>

        {/* Contact Email */}
        <div>
          <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-2">
            Contact Email *
          </label>
          <input
            type="email"
            id="contactEmail"
            name="contactEmail"
            value={formData.contactEmail}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.contactEmail ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="admin@yourcompany.com"
          />
          {errors.contactEmail && <p className="mt-1 text-sm text-red-600">{errors.contactEmail}</p>}
        </div>

        {/* Contact Phone */}
        <div>
          <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700 mb-2">
            Contact Phone
          </label>
          <input
            type="tel"
            id="contactPhone"
            name="contactPhone"
            value={formData.contactPhone}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="+1 (555) 123-4567"
          />
        </div>

        {/* Domain */}
        <div>
          <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-2">
            Company Domain
          </label>
          <input
            type="text"
            id="domain"
            name="domain"
            value={formData.domain}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.domain ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="yourcompany.com"
          />
          {errors.domain && <p className="mt-1 text-sm text-red-600">{errors.domain}</p>}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Company Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            value={formData.description}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Brief description of your organization and training goals"
          />
        </div>

        {/* Max Students */}
        <div>
          <label htmlFor="maxStudents" className="block text-sm font-medium text-gray-700 mb-2">
            Maximum Students *
          </label>
          <select
            id="maxStudents"
            name="maxStudents"
            value={formData.maxStudents}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.maxStudents ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value={25}>25 students</option>
            <option value={50}>50 students</option>
            <option value={100}>100 students</option>
            <option value={250}>250 students</option>
            <option value={500}>500 students</option>
            <option value={1000}>1000+ students</option>
          </select>
          {errors.maxStudents && <p className="mt-1 text-sm text-red-600">{errors.maxStudents}</p>}
        </div>

        {/* Address */}
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
            Company Address
          </label>
          <textarea
            id="address"
            name="address"
            rows={2}
            value={formData.address}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Street address, city, state, country"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Account...
              </div>
            ) : (
              'Create Company Account'
            )}
          </button>
        </div>

        {/* Trial Information */}
        <div className="mt-6 p-4 bg-blue-50 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">30-Day Free Trial</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>Start with a 30-day trial. No credit card required. Upgrade anytime to continue your language training program.</p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CompanyRegistrationForm;