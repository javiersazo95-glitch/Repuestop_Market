import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import OfficialPatentHero from './components/OfficialPatentHero';
import PromoGridBanners from './components/PromoGridBanners';
import LatestAddedPartsSection from './components/LatestAddedPartsSection';
import NewOnboardedStoresSection from './components/NewOnboardedStoresSection';
import CategoryGrid from './components/CategoryGrid';
import SocialProofTestimonials from './components/SocialProofTestimonials';
import ProductQuickViewModal from './components/ProductQuickViewModal';
import SellerRegisterModal from './components/SellerRegisterModal';
import CartDrawer from './components/CartDrawer';
import Footer from './components/Footer';

import { PRODUCTS } from './data/products';
import { SAMPLE_PATENTES } from './data/sampleVehicles';

export default function App() {
  // Active Vehicle Garage State
  const [activeVehicle, setActiveVehicle] = useState(() => {
    const saved = localStorage.getItem('repuestop_active_vehicle');
    return saved ? JSON.parse(saved) : SAMPLE_PATENTES['BBCL12']; // Toyota RAV4 default
  });

  useEffect(() => {
    if (activeVehicle) {
      localStorage.setItem('repuestop_active_vehicle', JSON.stringify(activeVehicle));
    } else {
      localStorage.removeItem('repuestop_active_vehicle');
    }
  }, [activeVehicle]);

  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Modals & Cart Drawer State
  const [isSellerModalOpen, setIsSellerModalOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState([
    { ...PRODUCTS[0], quantity: 1 }
  ]);

  const handleAddToCart = (product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const handleUpdateQuantity = (productId, newQty) => {
    if (newQty <= 0) {
      setCartItems(prev => prev.filter(item => item.id !== productId));
      return;
    }
    setCartItems(prev => prev.map(item => item.id === productId ? { ...item, quantity: newQty } : item));
  };

  const handleRemoveFromCart = (productId) => {
    setCartItems(prev => prev.filter(item => item.id !== productId));
  };

  const scrollToSection = () => {
    const el = document.querySelector('.latest-parts-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="repuestop-high-trust-app">
      {/* 1. Header with Top Security Bar & Active Garage Subbar */}
      <Header 
        activeVehicle={activeVehicle}
        onOpenSellerModal={() => setIsSellerModalOpen(true)}
        cartCount={cartItems.reduce((a, b) => a + b.quantity, 0)}
        onOpenCart={() => setIsCartOpen(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearchSubmit={scrollToSection}
        selectedCategory={selectedCategory}
        onSelectCategory={(catId) => {
          setSelectedCategory(catId);
          scrollToSection();
        }}
      />

      {/* 2. Official Patent Hero Console */}
      <OfficialPatentHero 
        activeVehicle={activeVehicle}
        onSelectVehicle={(veh) => {
          setActiveVehicle(veh);
          scrollToSection();
        }}
        onOpenSellerModal={() => setIsSellerModalOpen(true)}
        selectedCategory={selectedCategory}
        onSelectCategory={(catId) => {
          setSelectedCategory(catId);
          scrollToSection();
        }}
      />

      {/* 3. PROMO GRID BANNERS */}
      <PromoGridBanners onScrollToCatalog={scrollToSection} />

      {/* 4. LATEST ADDED SPARE PARTS IN REAL-TIME */}
      <LatestAddedPartsSection 
        onAddToCart={handleAddToCart} 
        onQuickView={(prod) => setQuickViewProduct(prod)} 
      />

      {/* 5. NEW ONBOARDED AUTO PARTS STORES & WRECKING YARDS */}
      <NewOnboardedStoresSection 
        onOpenSellerModal={() => setIsSellerModalOpen(true)} 
      />

      {/* 6. Illustrated Category Grid Section */}
      <CategoryGrid 
        selectedCategory={selectedCategory} 
        onSelectCategory={(catId) => {
          setSelectedCategory(catId);
          scrollToSection();
        }} 
      />

      {/* 7. Social Proof Testimonials Section */}
      <SocialProofTestimonials />

      {/* 8. Footer Component */}
      <Footer onOpenSellerModal={() => setIsSellerModalOpen(true)} />

      {/* Modals & Drawers */}
      <SellerRegisterModal 
        isOpen={isSellerModalOpen} 
        onClose={() => setIsSellerModalOpen(false)} 
      />

      <ProductQuickViewModal 
        product={quickViewProduct} 
        activeVehicle={activeVehicle} 
        onClose={() => setQuickViewProduct(null)} 
        onAddToCart={handleAddToCart} 
      />

      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveFromCart}
        activeVehicle={activeVehicle}
      />
    </div>
  );
}
