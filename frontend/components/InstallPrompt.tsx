'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => console.log('Service Worker registered with scope:', reg.scope))
          .catch((err) => console.error('Service Worker registration failed:', err));
      });
    }

    // Handle PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      const promptEvent = e as BeforeInstallPromptEvent;
      // Prevent the mini-infobar from appearing on mobile
      promptEvent.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(promptEvent);
      // Update UI notify the user they can install the PWA
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:w-96 bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl p-4 border border-zinc-200 dark:border-zinc-700 flex flex-col gap-3 z-50">
      <div>
        <h3 className="font-semibold text-zinc-900 dark:text-white">Install Aegis App</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Add to your home screen for quick access and push notifications.</p>
      </div>
      <div className="flex gap-2 mt-1">
        <button 
          onClick={() => setShowPrompt(false)}
          className="flex-1 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-xl transition-colors"
        >
          Later
        </button>
        <button 
          onClick={handleInstallClick}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
        >
          Install
        </button>
      </div>
    </div>
  );
}
