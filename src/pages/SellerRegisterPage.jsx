import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import FounderRegistration from '../components/FounderRegistration';
import { ROUTES } from '../routes/paths';

export default function SellerRegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // "Volver" debe devolver a la página desde donde se abrió el registro; si se
  // entró por URL directa (sin historial propio) se cae al home.
  const handleBack = () => {
    if (location.key === 'default') navigate(ROUTES.home, { replace: true });
    else navigate(-1);
  };

  return (
    <div className="repuestop-about-page">
      <FounderRegistration onBack={handleBack} />
    </div>
  );
}
