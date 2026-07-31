import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../common/Navbar';
import SiteFooter from '../common/SiteFooter';

const AdminLayout = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <SiteFooter />
    </div>
  );
};

export default AdminLayout;
