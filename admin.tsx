import React from 'react';
import ReactDOM from 'react-dom/client';
import AdminDashboard from './components/AdminDashboard';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Wrapper component to provide consistent styling for the standalone page
const AdminPageContainer: React.FC = () => (
    <div className="w-full min-h-screen flex items-center justify-center p-2 sm:p-4">
        <AdminDashboard />
    </div>
);

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AdminPageContainer />
  </React.StrictMode>
);
