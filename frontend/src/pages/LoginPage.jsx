import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Network, Eye, EyeOff, Lock, User } from 'lucide-react';
import frankfurtImg from '../assets/Frankfurt_University.png';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    // The inputs have 'required' attributes so the browser will ensure they are filled
    navigate('/ingestion');
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Side: 3D Visual */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-indigo-900/40 mix-blend-multiply z-10" />
        <img
          src={frankfurtImg}
          alt="Frankfurt University"
          className="absolute inset-0 w-full h-full object-cover opacity-90"
        />
        <div className="relative z-20 flex flex-col justify-end p-16 h-full text-white">
          <div className="max-w-md">
            <h2 className="text-4xl text-white font-medium mb-4 leading-tight">
              Empowering your data with intelligent analysis.
            </h2>
            <p className="text-indigo-100 text-lg">
              Sentiment Analyzer provides real-time sentiment tracking and deep network insights for modern enterprises.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 md:p-16">
        <div className="w-full max-w-md space-y-8">
          {/* Logo & Header */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/30">
                <Network className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Sentiment Analyzer</h1>
            </div>
            
            <h2 className="text-3xl text-slate-900 mb-2">Welcome back</h2>
            <p className="text-slate-500">Please enter your details to sign in.</p>
          </div>

          {/* Form */}
          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              {/* Username Field */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2" htmlFor="username">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-colors sm:text-sm"
                    placeholder="Enter your username"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="block w-full pl-10 pr-10 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-colors sm:text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-600 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600 cursor-pointer">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
                  Forgot password?
                </a>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 transition-colors"
              >
                Sign In
              </button>
            </div>
          </form>

          {/* Register Link */}
          <div className="pt-6 text-center text-sm">
            <span className="text-slate-500">Don't have an account? </span>
            <a href="#" className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
              Register New Account
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
