import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginApi, loginGoogleApi, logoutApi, getProfileApi, updateProfileApi, registerBuyerApi, registerSellerApi, resolveMediaUrl } from '../services/api';

const AuthContext = createContext(null);

function normalizeUserMedia(profile) {
  if (!profile) return profile;
  return {
    ...profile,
    userProfileUrl: resolveMediaUrl(profile.userProfileUrl),
    logoUrl: resolveMediaUrl(profile.logoUrl),
    coverUrl: resolveMediaUrl(profile.coverUrl),
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('repuestop_user');
    return savedUser ? normalizeUserMedia(JSON.parse(savedUser)) : null;
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('repuestop_token') || null;
  });

  const [role, setRole] = useState(() => {
    return localStorage.getItem('repuestop_role') || (user?.role || 'BUYER');
  });

  const [isLoading, setIsLoading] = useState(false);

  // Validate session on mount if token exists
  useEffect(() => {
    if (token && !user) {
      getProfileApi()
        .then((profile) => {
          const normalizedProfile = normalizeUserMedia(profile);
          setUser(normalizedProfile);
          if (profile.role) setRole(profile.role);
          localStorage.setItem('repuestop_user', JSON.stringify(normalizedProfile));
        })
        .catch(() => {
          // Clear invalid token
          logoutLocal();
        });
    }
  }, [token]);

  const saveSession = (authResponse, preferredRole) => {
    const accessToken = authResponse.token || authResponse.accessToken;
    const baseUser = authResponse.usuario || authResponse.user || {
      userId: authResponse.userId,
      email: authResponse.email,
      userName: authResponse.userName,
      role: authResponse.role,
    };

    // El backend es la fuente de verdad del rol y de los datos de tienda (buyerId/sellerId/storeName),
    // igual que en mobile (auth-registration.ts buildSession). El rol preseleccionado en el modal
    // es solo un valor de respaldo si el backend no informa uno (ej. respuestas legadas).
    const userData = normalizeUserMedia({
      ...baseUser,
      buyerId: authResponse.buyerId ?? baseUser.buyerId,
      sellerId: authResponse.sellerId ?? baseUser.sellerId,
      storeName: authResponse.storeName ?? baseUser.storeName,
      region: authResponse.region ?? baseUser.region,
      comuna: authResponse.comuna ?? baseUser.comuna,
      address: authResponse.address ?? baseUser.address,
      shippingMethods: authResponse.shippingMethods ?? baseUser.shippingMethods,
    });

    const assignedRole = baseUser.role || authResponse.role || preferredRole || 'BUYER';

    setUser(userData);
    setToken(accessToken);
    setRole(assignedRole);

    if (accessToken) localStorage.setItem('repuestop_token', accessToken);
    localStorage.setItem('repuestop_user', JSON.stringify(userData));
    localStorage.setItem('repuestop_role', assignedRole);

    return userData;
  };

  const logoutLocal = () => {
    setUser(null);
    setToken(null);
    setRole('BUYER');
    localStorage.removeItem('repuestop_token');
    localStorage.removeItem('repuestop_user');
    localStorage.removeItem('repuestop_role');
  };

  const login = async ({ email, password, preferredRole = 'BUYER' }) => {
    setIsLoading(true);
    try {
      const response = await loginApi({ email, password });
      const savedUserData = saveSession(response, preferredRole);
      return { success: true, user: savedUserData };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (idToken) => {
    setIsLoading(true);
    try {
      const response = await loginGoogleApi({ idToken });
      const savedUserData = saveSession(response);
      return { success: true, user: savedUserData };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const registerBuyer = async (buyerData) => {
    setIsLoading(true);
    try {
      const response = await registerBuyerApi(buyerData);
      if (response.token || response.accessToken) {
        saveSession(response, 'BUYER');
      }
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const registerSeller = async (sellerData) => {
    setIsLoading(true);
    try {
      const response = await registerSellerApi(sellerData);
      if (response.token || response.accessToken) {
        saveSession(response, 'SELLER');
      }
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (token) {
      await logoutApi(token);
    }
    logoutLocal();
  };

  const updateProfile = async (payload) => {
    setIsLoading(true);
    try {
      const profile = await updateProfileApi(payload);
      // PerfilUsuarioDTO no devuelve todos los campos editables (ej. phone), así que
      // aplicamos el payload enviado como valor optimista y dejamos que la respuesta
      // del backend (autoritativa) sobreescriba solo los campos que sí trae.
      const mergedUser = normalizeUserMedia({ ...user, ...payload, ...profile });
      setUser(mergedUser);
      localStorage.setItem('repuestop_user', JSON.stringify(mergedUser));
      return { success: true, user: mergedUser };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    token,
    role,
    isLoggedIn: !!token && !!user,
    isLoading,
    login,
    loginWithGoogle,
    logout,
    registerBuyer,
    registerSeller,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
