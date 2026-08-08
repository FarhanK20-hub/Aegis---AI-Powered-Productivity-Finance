"use client";

import { useState, useEffect } from 'react';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

// VAPID Public Key
const VAPID_PUBLIC_KEY = "BKiXlOEHdWagFIDW4SeUX2Zy_pc1mhPDLC8sfnaQmSb-cf7BKfA4Sv98XMxpZ7xE1IUm61XMAqRXJZs-nWA0_1k";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    notify_email: true,
    notify_web_push: false,
    notify_telegram: false,
    telegram_chat_id: "",
    notify_whatsapp: false,
    whatsapp_phone_number: "",
  });
  
  const [whatsappConfirm, setWhatsappConfirm] = useState(false);
  
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoReadAloud, setAutoReadAloud] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchHistory();
    const storedAutoRead = localStorage.getItem('auto_read_aloud');
    if (storedAutoRead === 'true') {
      setAutoReadAloud(true);
    }
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('http://localhost:8000/notifications/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings({
          notify_email: data.notify_email || false,
          notify_web_push: data.notify_web_push || false,
          notify_telegram: data.notify_telegram || false,
          telegram_chat_id: data.telegram_chat_id || "",
          notify_whatsapp: data.notify_whatsapp || false,
          whatsapp_phone_number: data.whatsapp_phone_number || "",
        });
        if (data.notify_whatsapp) {
          setWhatsappConfirm(true);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('http://localhost:8000/notifications/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateSettings = async (newSettings: typeof settings) => {
    setSettings(newSettings);
    try {
      await fetch('http://localhost:8000/notifications/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
    } catch (e) {
      console.error("Failed to update settings", e);
    }
  };

  const toggleEmail = (e: React.ChangeEvent<HTMLInputElement>) => updateSettings({ ...settings, notify_email: e.target.checked });
  
  const toggleTelegram = (e: React.ChangeEvent<HTMLInputElement>) => updateSettings({ ...settings, notify_telegram: e.target.checked });

  const saveTelegramChatId = () => {
    updateSettings({ ...settings, telegram_chat_id: settings.telegram_chat_id });
  };

  const toggleWhatsapp = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (checked && !whatsappConfirm) {
      alert("Please confirm the WhatsApp fee caveat first.");
      return;
    }
    updateSettings({ ...settings, notify_whatsapp: checked });
  };

  const saveWhatsappPhoneNumber = () => {
    updateSettings({ ...settings, whatsapp_phone_number: settings.whatsapp_phone_number });
  };

  const toggleAutoReadAloud = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setAutoReadAloud(checked);
    localStorage.setItem('auto_read_aloud', checked.toString());
  };

  const toggleWebPush = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (checked) {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert("Push notifications are not supported by your browser.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert("Permission denied");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        await fetch('http://localhost:8000/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.toJSON().keys?.p256dh,
              auth: subscription.toJSON().keys?.auth,
            }
          })
        });

        updateSettings({ ...settings, notify_web_push: true });

      } catch (e) {
        console.error("Subscription failed", e);
      }
    } else {
      updateSettings({ ...settings, notify_web_push: false });
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="container mx-auto p-8 max-w-4xl text-black">
      <h1 className="text-3xl font-bold mb-8 text-white">Settings</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Notification Channels */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h2 className="text-xl font-bold mb-6">Notification Channels</h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-lg font-medium block">Email Notifications</label>
                <p className="text-sm text-gray-500">Receive tasks and calendar reminders via email.</p>
              </div>
              <input type="checkbox" className="w-5 h-5" checked={settings.notify_email} onChange={toggleEmail} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-lg font-medium block">Web Push Notifications</label>
                <p className="text-sm text-gray-500">Receive desktop notifications.</p>
              </div>
              <input type="checkbox" className="w-5 h-5" checked={settings.notify_web_push} onChange={toggleWebPush} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-lg font-medium block">Telegram Notifications</label>
                <p className="text-sm text-gray-500">Receive instant messages via Telegram.</p>
              </div>
              <input type="checkbox" className="w-5 h-5" checked={settings.notify_telegram} onChange={toggleTelegram} />
            </div>

            {settings.notify_telegram && (
              <div className="pt-4 space-y-2 border-t">
                <label className="block font-medium">Telegram Chat ID</label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    className="flex-1 border rounded px-3 py-2 text-sm"
                    value={settings.telegram_chat_id}
                    onChange={(e) => setSettings({...settings, telegram_chat_id: e.target.value})}
                    placeholder="Enter your chat ID"
                  />
                  <button 
                    onClick={saveTelegramChatId}
                    className="bg-black text-white px-4 py-2 rounded text-sm hover:bg-gray-800"
                  >
                    Save
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Message @userinfobot to get your ID, then type /start to the Aegis bot.
                </p>
              </div>
            )}

            <div className="flex items-start justify-between border-t pt-6">
              <div>
                <label className="text-lg font-medium block">WhatsApp Notifications</label>
                <p className="text-sm text-gray-500 mb-2">Receive updates and briefings via WhatsApp.</p>
                <div className="flex items-center gap-2 mb-2">
                  <input 
                    type="checkbox" 
                    id="wa-confirm" 
                    className="w-4 h-4"
                    checked={whatsappConfirm}
                    onChange={(e) => {
                      setWhatsappConfirm(e.target.checked);
                      if (!e.target.checked && settings.notify_whatsapp) {
                        updateSettings({ ...settings, notify_whatsapp: false });
                      }
                    }}
                  />
                  <label htmlFor="wa-confirm" className="text-xs text-orange-600">
                    I understand that business-initiated messages outside the 24-hour window may incur Meta&apos;s per-message fee.
                  </label>
                </div>
                <p className="text-xs text-gray-400">
                  Tip: To receive notifications without fees, simply send &apos;hi&apos; to the bot to open a free 24-hour window. Pending notifications will be queued until you do.
                </p>
              </div>
              <input 
                type="checkbox" 
                className="w-5 h-5 mt-1" 
                checked={settings.notify_whatsapp} 
                onChange={toggleWhatsapp} 
                disabled={!whatsappConfirm}
              />
            </div>

            {settings.notify_whatsapp && (
              <div className="pt-2 space-y-2">
                <label className="block font-medium">WhatsApp Phone Number</label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    className="flex-1 border rounded px-3 py-2 text-sm"
                    value={settings.whatsapp_phone_number}
                    onChange={(e) => setSettings({...settings, whatsapp_phone_number: e.target.value})}
                    placeholder="Enter with country code (e.g. 1234567890)"
                  />
                  <button 
                    onClick={saveWhatsappPhoneNumber}
                    className="bg-black text-white px-4 py-2 rounded text-sm hover:bg-gray-800"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Accessibility Settings */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h2 className="text-xl font-bold mb-6">Accessibility Settings</h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-lg font-medium block">Auto-Read Aloud</label>
                <p className="text-sm text-gray-500">Automatically read new agent responses aloud using system voice.</p>
              </div>
              <input type="checkbox" className="w-5 h-5" checked={autoReadAloud} onChange={toggleAutoReadAloud} />
            </div>
          </div>
        </div>

        {/* History */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h2 className="text-xl font-bold mb-6">Notification History</h2>
          <div>
            {history.length === 0 ? (
              <p className="text-gray-500">No notifications sent yet.</p>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {history.map((item: { id: number; payload?: { title?: string; body?: string }; created_at: string; delivered_channels?: string[] }) => (
                  <div key={item.id} className="border-b pb-2">
                    <p className="font-semibold text-sm">{item.payload?.title}</p>
                    <p className="text-sm text-gray-600">{item.payload?.body}</p>
                    <div className="flex justify-between mt-1 text-xs text-gray-400">
                      <span>{new Date(item.created_at).toLocaleString()}</span>
                      <span>{item.delivered_channels?.join(', ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
