import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Loader } from 'lucide-react';

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Completa todos los campos');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7F7F5] via-white to-[#F1F1EF] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="bg-white border border-[#EDEDEB] rounded-xl px-8 py-10 shadow-lg">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-white border border-[#EDEDEB] rounded-xl flex items-center justify-center mx-auto mb-4 p-1">
              <img src="/logo.png" alt="Iceberg Agency" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-xl font-bold text-[#37352F] tracking-tight">Iceberg Agency</h1>
            <p className="text-[13px] text-[#91918E] mt-1">Accede a tu panel de gestión</p>
          </div>

          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={loginWithGoogle}
              className="w-full py-2.5 bg-white border border-[#EDEDEB] text-[#37352F] text-sm font-semibold rounded-lg hover:bg-[#F7F7F5] transition-all cursor-pointer flex items-center justify-center gap-2.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continuar con Google
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#EDEDEB]"></div>
            </div>
            <div className="relative flex justify-center text-[11px]">
              <span className="bg-white px-3 text-[#91918E] uppercase tracking-wider font-medium">o</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-[#5A5A57] mb-1.5">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full px-3.5 py-2.5 text-sm border border-[#EDEDEB] rounded-lg bg-white text-[#37352F] placeholder-[#BEBEBA] focus:outline-none focus:ring-2 focus:ring-[#37352F]/10 focus:border-[#37352F] transition-all"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#5A5A57] mb-1.5">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#EDEDEB] rounded-lg bg-white text-[#37352F] placeholder-[#BEBEBA] focus:outline-none focus:ring-2 focus:ring-[#37352F]/10 focus:border-[#37352F] transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#91918E] hover:text-[#37352F] cursor-pointer transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#37352F] text-white text-sm font-semibold rounded-lg hover:bg-[#2a2823] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader className="w-4 h-4 animate-spin" /> Verificando...</>
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>
        </div>

        <p className="text-[11px] text-[#91918E] text-center mt-6">
          &copy; {new Date().getFullYear()} Iceberg Agency. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
