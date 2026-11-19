import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { t } from '../i18n';
import { useAppStore } from '../store/useAppStore';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    public props: Props;
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // You can also log the error to an error reporting service here
        useAppStore.getState().addLog('error', "Uncaught error", {
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
        });
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[400px] flex items-center justify-center p-6 bg-slate-900/50 rounded-2xl border border-red-500/20">
                    <div className="text-center max-w-md">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="w-8 h-8 text-red-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">
                            Beklenmeyen Bir Hata Oluştu / An Unexpected Error Occurred
                        </h2>
                        <p className="text-slate-400 mb-6 font-mono text-sm bg-black/50 p-3 rounded-lg text-left overflow-auto max-h-32">
                            {this.state.error?.message || "Bilinmeyen Hata"}
                        </p>
                        <button
                            onClick={this.handleReload}
                            className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl transition-all border border-red-500/30"
                        >
                            <RefreshCcw className="w-4 h-4" />
                            <span>Sayfayı Yenile / Reload Page</span>
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
