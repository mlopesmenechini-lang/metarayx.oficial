import React from 'react';
import { Info, AlertCircle } from 'lucide-react';

export const InfoTooltip = ({ text }: { text: string }) => {
  return (
    <div className="group relative inline-block ml-1.5 align-middle">
      <Info className="w-3.5 h-3.5 text-zinc-500 hover:text-amber-500 transition-colors cursor-help" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 z-[100]">
        <div className="bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-300 p-3 rounded-2xl shadow-2xl backdrop-blur-xl leading-relaxed">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-800" />
        </div>
      </div>
    </div>
  );
};

// Error Boundary Component
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, errorMsg: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorMsg: error?.message || 'Unknown error' };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-black text-center p-6">
          <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-3xl flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black mb-2 uppercase">Ops! Algo deu errado</h1>
          <p className="text-zinc-400 max-w-xs mb-8 text-sm">
            {this.state.errorMsg}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-gradient-to-r from-amber-600 to-amber-400 text-black font-black rounded-xl hover:scale-105 transition-all uppercase"
          >
            Recarregar Hub
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const NavItem = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm
      ${active ? 'gold-bg text-black shadow-lg shadow-amber-500/20' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'}
    `}
  >
    {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5 flex-shrink-0' })}
    {label}
  </button>
);
