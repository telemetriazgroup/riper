import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Plus, User, Mail, Shield } from 'lucide-react';
import { useSettings } from '@/app/contexts/SettingsContext';

export const UsersList: React.FC = () => {
  const { t } = useSettings();

  const users = [
    { id: 1, name: 'Juan Pérez', email: 'juan@empresa.com', role: 'Operador', status: 'active' },
    { id: 2, name: 'María Garcia', email: 'maria@empresa.com', role: 'Administrador', status: 'active' },
    { id: 3, name: 'Carlos Ruiz', email: 'carlos@empresa.com', role: 'Visualizador', status: 'inactive' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">{t('user_management')}</h2>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t('new_user')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('system_users')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                <tr>
                  <th className="px-4 py-3">{t('user')}</th>
                  <th className="px-4 py-3">{t('email')}</th>
                  <th className="px-4 py-3">{t('role')}</th>
                  <th className="px-4 py-3">{t('status')}</th>
                  <th className="px-4 py-3 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
                        <User className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-gray-900">{user.name}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" /> {user.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Shield className="h-3 w-3" /> {user.role}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {t(user.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm">{t('edit')}</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
