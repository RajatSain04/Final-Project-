import React, { useState, useMemo, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import ProductList from './components/ProductList';
import InstallBanner from './components/InstallBanner';
import Settings from './components/Settings';
import Cart from './components/Cart';
import Toast from './components/Toast';
import AdminPanel from './components/AdminPanel';
import SaleBanner from './components/SaleBanner';
import { usePwaInstall } from './hooks/usePwaInstall';
import { usePushManager } from './hooks/usePushManager';
import { sendOrderConfirmationNotification, getSaleStatus } from './services/api';
import type { Product, CartItem } from './types';

/* -------------------------------------------------------------------------- */
/* 🔐 Admin Login Page */
/* -------------------------------------------------------------------------- */
const AdminLogin: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = () => {
    if (password === 'flashadmin123') {
      localStorage.setItem('isAdmin', 'true');
      navigate('/admin', { replace: true });
    } else {
      setError('Invalid password');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-3xl font-bold mb-4 text-indigo-700">Admin Login</h1>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Enter admin password"
        className="p-2 border border-gray-300 rounded w-64 mb-2 text-center"
      />
      <button
        onClick={handleLogin}
        className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
      >
        Login
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 🏪 Storefront (User Side) */
/* -------------------------------------------------------------------------- */
const Storefront: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cart, setCart] = useState<Map<number, CartItem>>(new Map());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' }>({ message: '', type: 'success' });
  const [searchQuery, setSearchQuery] = useState('');
  const [saleInfo, setSaleInfo] = useState<{ isActive: boolean; discount: number }>({ isActive: false, discount: 0 });

  const { canInstall, isAppInstalled, triggerInstall } = usePwaInstall();
  const { isSubscribed, isSupported, permissionStatus, subscribe, unsubscribe, isProcessing } = usePushManager();

  // 🧩 Fetch current sale state every few seconds (auto-update flash sale)
  useEffect(() => {
    const fetchSaleState = async () => {
      const currentSale = await getSaleStatus();
      if (currentSale) setSaleInfo(currentSale);
    };
    fetchSaleState();
    const interval = setInterval(fetchSaleState, 5000); // auto-refresh every 5 sec
    return () => clearInterval(interval);
  }, []);

  const handleAddToCart = (product: Product) => {
    setCart(prevCart => {
      const newCart = new Map<number, CartItem>(prevCart);
      const existingItem = newCart.get(product.id);
      if (existingItem) {
        newCart.set(product.id, { ...existingItem, quantity: existingItem.quantity + 1 });
      } else {
        newCart.set(product.id, { product, quantity: 1 });
      }
      return newCart;
    });
    setIsCartOpen(true);
  };

  const handleRemoveFromCart = (productId: number) => {
    setCart(prevCart => {
      const newCart = new Map(prevCart);
      newCart.delete(productId);
      return newCart;
    });
  };

  const handleClearCart = () => setCart(new Map());
  const cartItemsArray = useMemo(() => Array.from(cart.values()), [cart]);
  const cartItemCount = useMemo(() => cartItemsArray.reduce((t, i) => t + i.quantity, 0), [cartItemsArray]);
  const cartTotal = useMemo(() => cartItemsArray.reduce((t, i) => t + i.product.price * i.quantity, 0), [cartItemsArray]);

  const handleCheckout = async (paymentMethod: string) => {
    if (cartItemsArray.length === 0) return;
    setToast({ message: `Order placed with ${paymentMethod}!`, type: 'success' });

    if (isSubscribed) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await sendOrderConfirmationNotification(subscription, { total: cartTotal, paymentMethod });
        }
      } catch (e) {
        console.error('Error sending order confirmation notification:', e);
      }
    }

    handleClearCart();
    setIsCartOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <Header
        onSettingsClick={() => setIsSettingsOpen(true)}
        onCartClick={() => setIsCartOpen(true)}
        cartItemCount={cartItemCount}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      {saleInfo.isActive && (
        <SaleBanner discount={saleInfo.discount} />
      )}
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />
      <main className="container mx-auto p-4 md:p-6">
        <ProductList onAddToCart={handleAddToCart} searchQuery={searchQuery} saleInfo={saleInfo} />
      </main>
      {canInstall && !isAppInstalled && <InstallBanner onInstall={triggerInstall} />}
      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isSupported={isSupported}
        isSubscribed={isSubscribed}
        permissionStatus={permissionStatus}
        onSubscribe={subscribe}
        onUnsubscribe={unsubscribe}
        isProcessing={isProcessing}
      />
      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItemsArray}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={handleClearCart}
        onCheckout={handleCheckout}
        cartTotal={cartTotal}
      />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 🔒 Protected Route Wrapper */
/* -------------------------------------------------------------------------- */
const ProtectedRoute: React.FC<{ element: React.ReactElement }> = ({ element }) => {
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  return isAdmin ? element : <Navigate to="/login" replace />;
};

/* -------------------------------------------------------------------------- */
/* 🌐 Main App */
/* -------------------------------------------------------------------------- */
const App: React.FC = () => {
  const [saleUpdateTrigger, setSaleUpdateTrigger] = useState(0);

  return (
    <Router>
      <Routes>
        {/* Storefront Page */}
        <Route
          path="/"
          element={<Storefront key={saleUpdateTrigger} />}
        />

        {/* Admin Login */}
        <Route path="/login" element={<AdminLogin />} />

        {/* Protected Admin Panel */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute
              element={
                <AdminPanel
                  isOpen={true}
                  onClose={() => {}}
                  showToast={() => {}}
                  onSaleUpdate={() => setSaleUpdateTrigger(prev => prev + 1)}
                  initialSaleState={{ isActive: false, discount: 0 }}
                />
              }
            />
          }
        />

        {/* Redirect */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
};

export default App;
