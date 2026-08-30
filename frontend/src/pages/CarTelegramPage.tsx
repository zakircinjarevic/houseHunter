import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

interface CarBotUser {
  id: number;
  telegramId: string;
  username?: string;
  createdAt: string;
}

export default function CarTelegramPage() {
  const [users, setUsers] = useState<CarBotUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/car-users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Error loading car bot users:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900">🚗 Car Bot Users</h2>
        <p className="mt-2 text-sm text-gray-600">
          Users registered via the car Telegram bot. They receive alerts for used cars priced over 5,000 KM.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading users...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <p className="text-gray-600 mb-2">No car bot users yet.</p>
          <p className="text-sm text-gray-500">Send <code className="bg-gray-100 px-1 py-0.5 rounded">/start</code> to the car Telegram bot to register.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4">Registered Users ({users.length})</h3>
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.id} className="border border-gray-200 rounded-lg p-4">
                <p className="font-semibold text-gray-900">
                  {user.username || `User #${user.id}`}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Telegram ID: <code className="bg-gray-100 px-2 py-1 rounded">{user.telegramId}</code>
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Registered: {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
